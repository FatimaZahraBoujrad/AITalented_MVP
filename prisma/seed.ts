import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const TAXONOMY: [string, string][] = [
  ["PyTorch", "model_type"],
  ["TensorFlow", "model_type"],
  ["JAX", "model_type"],
  ["scikit-learn", "model_type"],
  ["Hugging Face", "model_type"],
  ["Transformers", "framework"],
  ["LangChain", "framework"],
  ["LlamaIndex", "framework"],
  ["vLLM", "framework"],
  ["RAG", "framework"],
  ["Fine-tuning", "framework"],
  ["FastAPI", "framework"],
  ["Ray", "framework"],
  ["OpenAI API", "framework"],
  ["CUDA", "deployment"],
  ["Docker", "deployment"],
  ["Kubernetes", "deployment"],
  ["Triton Inference Server", "deployment"],
  ["AWS SageMaker", "deployment"],
  ["Vertex AI", "deployment"],
  ["MLflow", "deployment"],
  ["ONNX", "deployment"],
  ["Airflow", "data"],
  ["dbt", "data"],
  ["Spark", "data"],
  ["SQL", "data"],
  ["Pandas", "data"],
  ["NumPy", "other"],
  ["Evaluation", "other"],
  ["Prompt engineering", "other"],
];

type SkillSpec = {
  name: string;
  status: "verified" | "unverified" | "pending" | "failed" | "manual_review";
  evidence?: string;
  reason?: string;
};

type ProjectSpec = {
  title: string;
  problem: string;
  approach: string;
  result: string;
  scale: "toy" | "coursework" | "production" | "oss";
  repo?: string;
  deploy?: string;
  repoStatus?: "verified" | "pending" | "failed" | "unverified";
  deployStatus?: "verified" | "pending" | "failed" | "unverified";
  repoNote?: string;
  deployNote?: string;
};

type CandidateSpec = {
  email: string;
  password?: string;
  fullName: string;
  headline: string;
  location: string;
  years: number;
  seniority: "junior" | "mid";
  status: "open" | "employed" | "not_looking";
  visible?: boolean;
  skills: SkillSpec[];
  projects: ProjectSpec[];
  credentials: {
    type: "degree" | "cert";
    issuer: string;
    title: string;
    year: number;
    status: "verified" | "manual_review" | "failed";
    evidence?: string;
    reason?: string;
  }[];
};

const CANDIDATES: CandidateSpec[] = [
  {
    email: "candidate@aitalented.dev",
    password: "candidate123",
    fullName: "Alex Rivera",
    headline: "ML engineer — retrieval systems, evaluation, and inference cost",
    location: "Berlin, DE",
    years: 3,
    seniority: "mid",
    status: "open",
    skills: [
      { name: "PyTorch", status: "verified", evidence: "https://github.com/pytorch/pytorch" },
      { name: "RAG", status: "verified", evidence: "https://github.com/run-llama/llama_index" },
      { name: "FastAPI", status: "verified", evidence: "https://github.com/tiangolo/fastapi" },
      { name: "Kubernetes", status: "pending", evidence: "https://github.com/kubernetes/kubernetes" },
      { name: "Airflow", status: "unverified" },
    ],
    projects: [
      {
        title: "RAG evaluation harness",
        problem: "Teams ship retrieval pipelines without a repeatable way to prove quality.",
        approach: "Built a golden-set harness scoring recall@k, groundedness and latency across retriever configs.",
        result: "Caught a 22% groundedness regression before launch; adopted across three teams.",
        scale: "production",
        repo: "https://github.com/pytorch/pytorch",
        deploy: "https://example.com",
        repoStatus: "verified",
        deployStatus: "verified",
        repoNote: "repo pytorch/pytorch · 82k commits · markers: torch, rag, fastapi",
        deployNote: "HTTP 200 · 184ms · authorship not verified",
      },
      {
        title: "Quantised embedding service",
        problem: "Embedding inference cost dominated the retrieval bill.",
        approach: "ONNX export with INT8 quantisation behind a batched FastAPI service.",
        result: "4.1x throughput on the same hardware at <0.5% recall loss.",
        scale: "oss",
        repo: "https://github.com/huggingface/transformers",
        repoStatus: "verified",
        repoNote: "repo huggingface/transformers · 140k commits · markers: transformers, onnx",
      },
    ],
    credentials: [
      { type: "degree", issuer: "TU Berlin", title: "MSc Machine Learning", year: 2023, status: "verified" },
      {
        type: "cert",
        issuer: "DeepLearning.AI",
        title: "MLOps Specialization",
        year: 2024,
        status: "manual_review",
        evidence: "https://www.coursera.org/account/accomplishments/specialization/example",
      },
    ],
  },
  {
    email: "lea@demo.dev",
    password: "demo12345",
    fullName: "Léa Moreau",
    headline: "ML engineer — retrieval & evaluation. Ships RAG systems that survive production.",
    location: "Paris, FR",
    years: 4,
    seniority: "mid",
    status: "open",
    skills: [
      { name: "PyTorch", status: "verified", evidence: "https://github.com/pytorch/pytorch" },
      { name: "RAG", status: "verified", evidence: "https://github.com/run-llama/llama_index" },
      { name: "vLLM", status: "verified", evidence: "https://github.com/vllm-project/vllm" },
      { name: "Kubernetes", status: "verified", evidence: "https://github.com/kubernetes/kubernetes" },
      { name: "Evaluation", status: "unverified" },
    ],
    projects: [
      {
        title: "Production RAG for legal review",
        problem: "Lawyers spent hours locating precedent across 2M documents.",
        approach: "Hybrid BM25 + dense retrieval, reranking, and citation-grounded generation on vLLM.",
        result: "Cut document review time 38% across a 40-person pilot.",
        scale: "production",
        repo: "https://github.com/vllm-project/vllm",
        deploy: "https://example.com",
        repoStatus: "verified",
        deployStatus: "verified",
        repoNote: "repo vllm-project/vllm · 9k commits · markers: vllm, torch",
        deployNote: "HTTP 200 · 241ms",
      },
    ],
    credentials: [{ type: "degree", issuer: "École Polytechnique", title: "MSc Data Science", year: 2021, status: "verified" }],
  },
  {
    email: "sam@demo.dev",
    fullName: "Sam Okafor",
    headline: "Junior ML engineer focused on tabular models and clean data contracts.",
    location: "London, UK",
    years: 1,
    seniority: "junior",
    status: "open",
    skills: [
      { name: "scikit-learn", status: "verified", evidence: "https://github.com/scikit-learn/scikit-learn" },
      { name: "Pandas", status: "unverified" },
      { name: "Docker", status: "verified", evidence: "https://github.com/docker/compose" },
    ],
    projects: [
      {
        title: "Churn model with leakage checks",
        problem: "A retention model looked great offline and failed in production.",
        approach: "Rebuilt the feature pipeline with time-aware splits and leakage tests.",
        result: "Offline and online AUC converged within 0.02.",
        scale: "coursework",
        repo: "https://github.com/scikit-learn/scikit-learn",
        repoStatus: "verified",
      },
    ],
    credentials: [],
  },
  {
    email: "priya@demo.dev",
    fullName: "Priya Nair",
    headline: "ML platform engineer — Vertex AI, Spark, and reliable training pipelines.",
    location: "Bangalore, IN",
    years: 4,
    seniority: "mid",
    status: "employed",
    skills: [
      { name: "TensorFlow", status: "verified", evidence: "https://github.com/tensorflow/tensorflow" },
      { name: "Vertex AI", status: "verified", evidence: "https://github.com/googleapis/python-aiplatform" },
      { name: "Airflow", status: "verified", evidence: "https://github.com/apache/airflow" },
      { name: "Spark", status: "verified", evidence: "https://github.com/apache/spark" },
    ],
    projects: [
      {
        title: "Feature backfill orchestration",
        problem: "Backfills took 11 hours and frequently deadlocked.",
        approach: "Airflow DAGs with Spark partitions and idempotent writes to the feature store.",
        result: "11h → 70 minutes, zero partial writes over six months.",
        scale: "production",
        repo: "https://github.com/apache/airflow",
        deploy: "https://example.com",
        repoStatus: "verified",
        deployStatus: "verified",
      },
    ],
    credentials: [{ type: "degree", issuer: "IIT Madras", title: "B.Tech Computer Science", year: 2019, status: "verified" }],
  },
  {
    email: "tomas@demo.dev",
    fullName: "Tomás Silva",
    headline: "Research engineer — JAX, fine-tuning, and CUDA kernels.",
    location: "Lisbon, PT",
    years: 2,
    seniority: "junior",
    status: "open",
    skills: [
      { name: "JAX", status: "verified", evidence: "https://github.com/google/jax" },
      { name: "CUDA", status: "verified", evidence: "https://github.com/NVIDIA/cuda-samples" },
      { name: "Fine-tuning", status: "failed", evidence: "https://example.com", reason: "No fine-tuning evidence detected in the repository (checked languages and dependency manifests)" },
    ],
    projects: [
      {
        title: "Kernel-level attention benchmark",
        problem: "Attention variants were compared on wall-clock time only.",
        approach: "Reproduced FlashAttention-style tiling in JAX with roofline analysis.",
        result: "2.3x speedup on A100 for sequence length 4k.",
        scale: "oss",
        repo: "https://github.com/google/jax",
        repoStatus: "verified",
      },
    ],
    credentials: [],
  },
  {
    email: "mei@demo.dev",
    fullName: "Mei Chen",
    headline: "Applied AI engineer — agentic workflows with real evaluation gates.",
    location: "Singapore, SG",
    years: 3,
    seniority: "mid",
    status: "open",
    skills: [
      { name: "LangChain", status: "verified", evidence: "https://github.com/langchain-ai/langchain" },
      { name: "OpenAI API", status: "verified", evidence: "https://github.com/openai/openai-python" },
      { name: "RAG", status: "verified", evidence: "https://github.com/run-llama/llama_index" },
      { name: "FastAPI", status: "unverified" },
    ],
    projects: [
      {
        title: "Support triage agent",
        problem: "Agents confidently routed tickets to the wrong team.",
        approach: "Tool-use agent with offline evals and a human escalation gate.",
        result: "Routing accuracy 71% → 92%, escalation rate down 30%.",
        scale: "production",
        repo: "https://github.com/langchain-ai/langchain",
        deploy: "https://example.com",
        repoStatus: "verified",
        deployStatus: "verified",
      },
    ],
    credentials: [{ type: "cert", issuer: "Google Cloud", title: "Professional ML Engineer", year: 2023, status: "verified" }],
  },
  {
    email: "omar@demo.dev",
    fullName: "Omar Haddad",
    headline: "Junior engineer — transformers, evaluation, and careful baselines.",
    location: "Tunis, TN",
    years: 1,
    seniority: "junior",
    status: "open",
    skills: [
      { name: "Hugging Face", status: "verified", evidence: "https://github.com/huggingface/transformers" },
      { name: "Transformers", status: "verified", evidence: "https://github.com/huggingface/transformers" },
      { name: "Docker", status: "unverified" },
    ],
    projects: [
      {
        title: "Arabic sentiment baselines",
        problem: "No reproducible baseline existed for dialectal Arabic sentiment.",
        approach: "Fine-tuned small transformers and published data splits and seeds.",
        result: "F1 0.81 with a 6x smaller model than the published baseline.",
        scale: "coursework",
        repo: "https://github.com/huggingface/transformers",
        repoStatus: "verified",
      },
    ],
    credentials: [],
  },
  {
    email: "nina@demo.dev",
    fullName: "Nina Kowalski",
    headline: "MLOps engineer — model registry, drift monitoring, and rollback paths.",
    location: "Warsaw, PL",
    years: 4,
    seniority: "mid",
    status: "employed",
    skills: [
      { name: "MLflow", status: "verified", evidence: "https://github.com/mlflow/mlflow" },
      { name: "Airflow", status: "verified", evidence: "https://github.com/apache/airflow" },
      { name: "Kubernetes", status: "verified", evidence: "https://github.com/kubernetes/kubernetes" },
      { name: "scikit-learn", status: "verified", evidence: "https://github.com/scikit-learn/scikit-learn" },
    ],
    projects: [
      {
        title: "Shadow deployment pipeline",
        problem: "Model rollouts were manual and had no rollback path.",
        approach: "MLflow registry + Kubernetes canary with automated drift gates.",
        result: "Mean time to rollback 45 minutes → 3 minutes.",
        scale: "production",
        repo: "https://github.com/mlflow/mlflow",
        deploy: "https://example.com",
        repoStatus: "verified",
        deployStatus: "verified",
      },
    ],
    credentials: [{ type: "degree", issuer: "University of Warsaw", title: "MSc Computer Science", year: 2020, status: "verified" }],
  },
  {
    email: "hidden@demo.dev",
    fullName: "Hidden Candidate",
    headline: "Not currently looking — profile intentionally hidden.",
    location: "Amsterdam, NL",
    years: 2,
    seniority: "junior",
    status: "not_looking",
    visible: false,
    skills: [{ name: "PyTorch", status: "verified", evidence: "https://github.com/pytorch/pytorch" }],
    projects: [
      {
        title: "Private prototype",
        problem: "Should never appear in search.",
        approach: "Hidden profile fixture.",
        result: "Excluded from search, digests and exports.",
        scale: "toy",
      },
    ],
    credentials: [],
  },
];

function completeness(spec: CandidateSpec): number {
  let score = 0;
  if (spec.headline && spec.location && spec.fullName) score += 30;
  if (spec.skills.length > 0) score += 15;
  if (spec.projects.length > 0) score += 25;
  if (spec.skills.some((s) => s.status === "verified") || spec.credentials.some((c) => c.status === "verified")) score += 20;
  if (spec.credentials.length > 0) score += 5;
  score += 5; // public contact email is seeded for every demo candidate
  return score;
}

async function main() {
  console.log("Seeding AITalented MVP…");

  for (const [name, category] of TAXONOMY) {
    await db.skillTaxonomy.upsert({
      where: { name },
      update: { category: category as never },
      create: { name, category: category as never },
    });
  }
  console.log(`Taxonomy: ${TAXONOMY.length} skills`);

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@aitalented.dev").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin12345";
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "admin", emailVerified: true, status: "active" },
    create: {
      email: adminEmail,
      role: "admin",
      emailVerified: true,
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });

  const recruiter = await db.user.upsert({
    where: { email: "recruiter@aitalented.dev" },
    update: {},
    create: {
      email: "recruiter@aitalented.dev",
      role: "recruiter",
      emailVerified: true,
      passwordHash: await bcrypt.hash("recruiter123", 10),
    },
  });
  let recruiterAccount = await db.recruiterAccount.findUnique({ where: { userId: recruiter.id } });
  if (!recruiterAccount) {
    recruiterAccount = await db.recruiterAccount.create({
      data: {
        userId: recruiter.id,
        orgName: "Northwind AI Talent",
        seatCount: 2,
        billingStatus: "trial",
        trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
      },
    });
  }

  const profileByEmail = new Map<string, string>();

  for (const spec of CANDIDATES) {
    const user = await db.user.upsert({
      where: { email: spec.email },
      update: { role: "candidate", emailVerified: true },
      create: {
        email: spec.email,
        role: "candidate",
        emailVerified: true,
        passwordHash: await bcrypt.hash(spec.password ?? "demo12345", 10),
      },
    });

    let profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await db.candidateProfile.create({
        data: {
          userId: user.id,
          fullName: spec.fullName,
          headline: spec.headline,
          location: spec.location,
          yearsExperience: spec.years,
          seniorityBand: spec.seniority,
          currentStatus: spec.status,
          contactEmailPublic: spec.email,
          visible: spec.visible ?? true,
          completenessScore: completeness(spec),
        },
      });
    }
    profileByEmail.set(spec.email, profile.id);

    const existingProjects = await db.project.count({ where: { profileId: profile.id } });
    const existingSkills = await db.skillClaim.count({ where: { profileId: profile.id } });
    if (existingSkills > 0 || existingProjects > 0) continue;

    for (const skill of spec.skills) {
      const category = TAXONOMY.find(([name]) => name === skill.name)?.[1] ?? "other";
      const claim = await db.skillClaim.create({
        data: {
          profileId: profile.id,
          skillName: skill.name,
          skillCategory: category as never,
          selfReported: skill.status === "unverified" || !skill.evidence,
          evidenceRef: skill.evidence ?? null,
          verificationStatus: skill.status,
          verificationMethod: skill.evidence
            ? skill.evidence.includes("github.com")
              ? "repo"
              : "deployment"
            : null,
          failureReason: skill.reason ?? null,
          verifiedAt: skill.status === "verified" ? new Date() : null,
        },
      });
      if (skill.status === "failed") {
        await db.verificationJob.create({
          data: {
            entityType: "skill",
            entityId: claim.id,
            method: claim.verificationMethod ?? "repo",
            status: "failed",
            attempts: 3,
            lastError: skill.reason ?? "Verification failed",
          },
        });
      }
      if (skill.status === "pending") {
        await db.verificationJob.create({
          data: {
            entityType: "skill",
            entityId: claim.id,
            method: claim.verificationMethod ?? "repo",
            status: "queued",
            attempts: 0,
            nextRunAt: new Date(),
          },
        });
      }
    }

    for (const project of spec.projects) {
      const created = await db.project.create({
        data: {
          profileId: profile.id,
          title: project.title,
          problem: project.problem,
          approach: project.approach,
          result: project.result,
          repoUrl: project.repo ?? null,
          deploymentUrl: project.deploy ?? null,
          projectScale: project.scale as never,
          repoStatus: project.repo ? project.repoStatus ?? "verified" : "unverified",
          deploymentStatus: project.deploy ? project.deployStatus ?? "verified" : "unverified",
          repoVerified: project.repoStatus === "verified",
          deploymentVerified: project.deployStatus === "verified",
          repoNote: project.repoNote ?? (project.repo ? "repo-exists verified (seeded demo evidence)" : null),
          deploymentNote: project.deployNote ?? (project.deploy ? "HTTP 200 (seeded demo evidence)" : null),
        },
      });
      await db.verificationJob.create({
        data: {
          entityType: "project",
          entityId: created.id,
          method: "repo",
          status: project.repo ? project.repoStatus === "failed" ? "failed" : "passed" : "passed",
          attempts: 1,
          lastError: project.repo ? null : "No repository URL provided",
        },
      });
      if (project.deploy) {
        await db.verificationJob.create({
          data: {
            entityType: "project",
            entityId: created.id,
            method: "deployment",
            status: "passed",
            attempts: 1,
          },
        });
      }
    }

    for (const credential of spec.credentials) {
      const created = await db.credential.create({
        data: {
          profileId: profile.id,
          type: credential.type,
          issuer: credential.issuer,
          title: credential.title,
          year: credential.year,
          evidenceRef: credential.evidence ?? null,
          verificationStatus: credential.status,
          failureReason: credential.reason ?? null,
          verifiedAt: credential.status === "verified" ? new Date() : null,
        },
      });
      if (credential.status === "manual_review") {
        await db.verificationJob.create({
          data: {
            entityType: "credential",
            entityId: created.id,
            method: "credential",
            status: "manual_review",
            attempts: 0,
          },
        });
      }
    }
  }
  console.log(`Candidates: ${CANDIDATES.length}`);

  const demoProfileId = profileByEmail.get("candidate@aitalented.dev");
  const leaProfileId = profileByEmail.get("lea@demo.dev");
  const samProfileId = profileByEmail.get("sam@demo.dev");
  const meiProfileId = profileByEmail.get("mei@demo.dev");

  if (recruiterAccount && demoProfileId) {
    const existingInterests = await db.interestRequest.count({
      where: { recruiterAccountId: recruiterAccount.id },
    });
    if (existingInterests === 0 && leaProfileId && samProfileId) {
      await db.interestRequest.create({
        data: {
          recruiterAccountId: recruiterAccount.id,
          profileId: demoProfileId,
          message:
            "Your RAG eval harness is exactly the work we need for a retrieval platform role in Berlin. Open to a short intro?",
          status: "sent",
          expiresAt: new Date(Date.now() + 14 * 86_400_000),
        },
      });
      await db.interestRequest.create({
        data: {
          recruiterAccountId: recruiterAccount.id,
          profileId: leaProfileId,
          message: "Retrieval + eval depth is rare. We are hiring for a senior RAG role in Paris.",
          status: "accepted",
          respondedAt: new Date(Date.now() - 2 * 86_400_000),
          expiresAt: new Date(Date.now() + 12 * 86_400_000),
        },
      });
      await db.interestRequest.create({
        data: {
          recruiterAccountId: recruiterAccount.id,
          profileId: samProfileId,
          message: "Looking for a junior ML engineer with strong data hygiene. Interested?",
          status: "declined",
          respondedAt: new Date(Date.now() - 5 * 86_400_000),
          expiresAt: new Date(Date.now() + 9 * 86_400_000),
        },
      });
    }

    let shortlist = await db.shortlist.findFirst({
      where: { recruiterAccountId: recruiterAccount.id, name: "Retrieval engineers" },
    });
    if (!shortlist) {
      shortlist = await db.shortlist.create({
        data: { recruiterAccountId: recruiterAccount.id, name: "Retrieval engineers" },
      });
      for (const profileId of [leaProfileId, meiProfileId, demoProfileId]) {
        if (profileId) await db.shortlistItem.create({ data: { shortlistId: shortlist.id, profileId } });
      }
    }

    const saved = await db.savedSearch.findFirst({
      where: { recruiterAccountId: recruiterAccount.id, name: "Verified PyTorch, production" },
    });
    if (!saved) {
      await db.savedSearch.create({
        data: {
          recruiterAccountId: recruiterAccount.id,
          name: "Verified PyTorch, production",
          filterJson: {
            modelTypes: ["PyTorch"],
            frameworks: [],
            seniority: [],
            deployment: false,
            dataExposure: false,
            minScale: "production",
            yearsMin: null,
            yearsMax: null,
            verification: "has_verified",
            q: "",
          },
        },
      });
    }

    await db.emailOutbox.create({
      data: {
        to: recruiter.email,
        kind: "digest",
        subject: "3 new matches for \"Verified PyTorch, production\"",
        body:
          "Your saved search \"Verified PyTorch, production\" has 3 new verified matches.\n\n" +
          "• Léa Moreau — retrieval & evaluation (4 verified skills, verified deployment)\n" +
          "• Alex Rivera — retrieval systems, evaluation (3 verified skills, verified deployment)\n" +
          "• Mei Chen — agentic workflows with evaluation gates (3 verified skills)\n\n" +
          "Open the index: /recruiter\n\n— AITalented",
      },
    });
  }

  await db.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "admin.seed",
      entityType: "system",
      metadataJson: { candidates: CANDIDATES.length, taxonomy: TAXONOMY.length },
    },
  });

  // Search-path indexes: FTS + the filter columns called out in the requirements book.
  const indexes = [
    `CREATE INDEX IF NOT EXISTS candidate_headline_fts
       ON "CandidateProfile" USING GIN (to_tsvector('english', coalesce("headline", '')))`,
    `CREATE INDEX IF NOT EXISTS project_text_fts
       ON "Project" USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("result", '')))`,
    `CREATE INDEX IF NOT EXISTS skill_name_status_idx
       ON "SkillClaim" ("skillName", "verificationStatus")`,
    `CREATE INDEX IF NOT EXISTS project_scale_idx ON "Project" ("projectScale")`,
    `CREATE INDEX IF NOT EXISTS profile_band_years_idx
       ON "CandidateProfile" ("seniorityBand", "yearsExperience")`,
  ];
  for (const statement of indexes) {
    await db.$executeRawUnsafe(statement);
  }

  console.log("Seed complete.");
  console.log(`  Admin:     ${adminEmail} / ${adminPassword}`);
  console.log("  Recruiter: recruiter@aitalented.dev / recruiter123");
  console.log("  Candidate: candidate@aitalented.dev / candidate123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
