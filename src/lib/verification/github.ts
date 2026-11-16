import type { VerificationOutcome } from "./types";

/**
 * GitHub verifier (§9.1). Verifies that a public repo exists, has commits, and (for
 * skill claims) that the repo's language or dependency markers support the claim.
 * Authorship is deliberately NOT verified in the MVP — the badge reads
 * "repo-exists verified".
 */

type RepoMeta = {
  full_name: string;
  id: number;
  private: boolean;
  language: string | null;
  pushed_at: string;
  html_url: string;
};

const metaCache = new Map<string, { at: number; meta: RepoMeta | null }>();
const CACHE_TTL = 10 * 60 * 1000;

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "aitalented-verifier",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function parseRepo(repoUrl: string): { owner: string; repo: string } | null {
  let url: URL;
  try {
    url = new URL(repoUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

async function gh(path: string): Promise<{ status: number; data: unknown; link: string | null }> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: headers(),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const link = res.headers.get("link");
  if (res.status === 404) return { status: 404, data: null, link };
  if (res.status === 403 || res.status === 429) {
    throw new Error(`GitHub API rate limited (${res.status})`);
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return { status: res.status, data: await res.json(), link };
}

async function cachedMeta(owner: string, repo: string): Promise<RepoMeta | null> {
  const key = `${owner}/${repo}`.toLowerCase();
  const hit = metaCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.meta;
  const res = await gh(`/repos/${owner}/${repo}`);
  const meta = res.status === 404 ? null : (res.data as RepoMeta);
  metaCache.set(key, { at: Date.now(), meta });
  return meta;
}

/** Framework / model markers scanned from dependency manifests in the repo root. */
const SKILL_MARKERS: Record<string, RegExp> = {
  pytorch: /(^|\W)(torch|pytorch)(\W|$)/i,
  tensorflow: /tensorflow/i,
  keras: /keras/i,
  jax: /(^|\W)(jax|flax)(\W|$)/i,
  "scikit-learn": /(scikit-learn|sklearn)/i,
  "hugging face": /(transformers|huggingface|sentence-transformers)/i,
  transformers: /(transformers|huggingface)/i,
  langchain: /langchain/i,
  llama: /(llama|llama-index|llama_index)/i,
  "openai api": /(openai|anthropic)/i,
  vllm: /vllm/i,
  rag: /(faiss|chromadb|pgvector|pinecone|weaviate|retriev)/i,
  "fine-tuning": /(peft|fine[-_ ]?tun|lora|trl)/i,
  cuda: /(cuda|triton)/i,
  onnx: /onnx/i,
  ray: /(^|\W)ray(\W|$)/i,
  fastapi: /fastapi/i,
  docker: /docker/i,
  kubernetes: /(kubernetes|k8s|helm)/i,
  mlflow: /mlflow/i,
  airflow: /airflow/i,
  dbt: /(^|\W)dbt(\W|$)/i,
  spark: /(pyspark|apache-spark|spark-sql)/i,
  sql: /(sqlalchemy|psycopg|asyncpg|postgres|duckdb)/i,
  "aws sagemaker": /(sagemaker|boto3)/i,
  "vertex ai": /(google-cloud-aiplatform|vertex)/i,
  pandas: /pandas/i,
  numpy: /numpy/i,
  "data pipelines": /(airflow|dagster|prefect|dbt|kafka)/i,
};

const MANIFESTS = ["requirements.txt", "pyproject.toml", "package.json", "environment.yml", "Dockerfile"];
const MAX_MANIFEST_BYTES = 60_000;

async function rootManifests(owner: string, repo: string): Promise<string[]> {
  let entries: { name: string; path: string; type: string }[] = [];
  try {
    const listing = await gh(`/repos/${owner}/${repo}/contents/`);
    if (listing.status !== 200) return [];
    entries = listing.data as { name: string; path: string; type: string }[];
  } catch {
    return [];
  }
  const wanted = entries
    .filter((e) => e.type === "file" && MANIFESTS.includes(e.name))
    .slice(0, 4);
  const texts: string[] = [];
  for (const entry of wanted) {
    try {
      const file = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(entry.name)}`);
      const data = file.data as { content?: string; encoding?: string } | null;
      if (data?.content) {
        texts.push(Buffer.from(data.content, "base64").toString("utf8").slice(0, MAX_MANIFEST_BYTES));
      }
    } catch {
      // A manifest we cannot read just contributes no evidence.
    }
  }
  return texts;
}

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

function markerFor(skill: string): RegExp | null {
  const key = normalizeSkill(skill);
  if (SKILL_MARKERS[key]) return SKILL_MARKERS[key];
  const partial = Object.keys(SKILL_MARKERS).find((k) => key.includes(k) || k.includes(key));
  return partial ? SKILL_MARKERS[partial] : null;
}

export async function verifyGithubRepo(
  repoUrl: string | null | undefined,
  skillName?: string,
): Promise<VerificationOutcome> {
  if (!repoUrl?.trim()) return { ok: false, reason: "No repository URL provided", retryable: false };
  const parsed = parseRepo(repoUrl);
  if (!parsed) {
    return { ok: false, reason: "Not a valid public GitHub repository URL", retryable: false };
  }

  let meta: RepoMeta | null;
  try {
    meta = await cachedMeta(parsed.owner, parsed.repo);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "GitHub request failed",
      retryable: true,
    };
  }

  if (!meta) return { ok: false, reason: "Repository not found (404) or not public", retryable: false };
  if (meta.private) return { ok: false, reason: "Repository is private; public proof required", retryable: false };

  let commitCount = 0;
  try {
    const commits = await gh(`/repos/${parsed.owner}/${parsed.repo}/commits?per_page=1`);
    if (commits.status === 404) {
      return { ok: false, reason: "Repository has no commits", retryable: false };
    }
    const link = commits.link ?? "";
    const lastMatch = /[?&]page=(\d+)>; rel="last"/.exec(link);
    commitCount = lastMatch ? Number(lastMatch[1]) : Array.isArray(commits.data) ? commits.data.length : 0;
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Cannot read commit history",
      retryable: true,
    };
  }
  if (commitCount === 0) return { ok: false, reason: "Repository has no commits", retryable: false };

  let languages: string[] = [];
  try {
    const langs = await gh(`/repos/${parsed.owner}/${parsed.repo}/languages`);
    languages = langs.status === 200 ? Object.keys(langs.data as Record<string, number>) : [];
  } catch {
    languages = meta.language ? [meta.language] : [];
  }

  const manifests = await rootManifests(parsed.owner, parsed.repo);
  const haystack = manifests.join("\n");
  const detected = Object.entries(SKILL_MARKERS)
    .filter(([, pattern]) => pattern.test(haystack))
    .map(([name]) => name);

  const evidence = {
    repo: meta.full_name,
    repoId: meta.id,
    url: meta.html_url,
    commits: commitCount,
    languages,
    detectedMarkers: detected.slice(0, 12),
    authorshipVerified: false,
  };

  if (!skillName) {
    return { ok: true, evidence };
  }

  const pattern = markerFor(skillName);
  const languageMatch = languages.some((l) => l.toLowerCase().includes(normalizeSkill(skillName)));
  const markerMatch = pattern ? pattern.test(haystack) : detected.includes(normalizeSkill(skillName));

  if (!markerMatch && !languageMatch) {
    return {
      ok: false,
      reason: `No ${skillName} evidence detected in the repository (checked languages and dependency manifests)`,
      retryable: false,
    };
  }

  return { ok: true, evidence: { ...evidence, matchedSkill: skillName, matchType: markerMatch ? "manifest" : "language" } };
}

export { parseRepo };
