import { Prisma } from "@prisma/client";
import type {
  CandidateProfile,
  Project,
  ProjectScale,
  SeniorityBand,
  SkillClaim,
  User,
} from "@prisma/client";
import { db } from "./db";

export type VerificationFilter = "all" | "verified_only" | "has_verified";

export type SearchFilters = {
  modelTypes: string[];
  frameworks: string[];
  seniority: SeniorityBand[];
  deployment: boolean;
  dataExposure: boolean;
  minScale: ProjectScale | null;
  yearsMin: number | null;
  yearsMax: number | null;
  verification: VerificationFilter;
  q: string;
};

export const EMPTY_FILTERS: SearchFilters = {
  modelTypes: [],
  frameworks: [],
  seniority: [],
  deployment: false,
  dataExposure: false,
  minScale: null,
  yearsMin: null,
  yearsMax: null,
  verification: "all",
  q: "",
};

/**
 * Ranking (§7.3). Deliberately dumb and documented — no ML ranker in the MVP.
 *
 *   score = w1 * min(verifiedSkillCount, cap)     verified skills, capped at 8
 *         + w2 * projectDepthWeight                toy 1 · coursework 2 · production 3 · oss 4
 *         + w3 * hasVerifiedDeployment             1 when a project deployment or a
 *                                                  deployment-category skill is verified
 *         + w4 * (completeness / 100)
 *         + w5 * exp(-daysSinceUpdate / halfLife)  recency tiebreaker
 *
 * Every weight is configurable through env vars so the pilot can be tuned without a deploy.
 */
const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const rankingConfig = {
  verifiedSkills: num(process.env.RANK_W_VERIFIED_SKILLS, 3),
  projectDepth: num(process.env.RANK_W_PROJECT_DEPTH, 2),
  deployment: num(process.env.RANK_W_DEPLOYMENT, 1.5),
  completeness: num(process.env.RANK_W_COMPLETENESS, 1),
  recency: num(process.env.RANK_W_RECENCY, 0.5),
  recencyHalfLifeDays: num(process.env.RANK_RECENCY_HALF_LIFE_DAYS, 60),
  verifiedSkillCap: 8,
} as const;

const SCALE_ORDER: ProjectScale[] = ["toy", "coursework", "production", "oss"];

export function scaleWeight(scale: ProjectScale): number {
  return SCALE_ORDER.indexOf(scale) + 1;
}

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): SearchFilters {
  const one = (key: string) => asArray(params[key])[0];
  const int = (key: string) => {
    const value = Number(one(key));
    return Number.isFinite(value) && one(key) !== undefined ? value : null;
  };
  const verificationRaw = one("verification");
  const verification: VerificationFilter =
    verificationRaw === "verified_only" || verificationRaw === "has_verified"
      ? verificationRaw
      : "all";
  const minScaleRaw = one("minScale");
  const minScale = SCALE_ORDER.includes(minScaleRaw as ProjectScale)
    ? (minScaleRaw as ProjectScale)
    : null;
  const seniority = asArray(params.seniority).filter(
    (s): s is SeniorityBand => s === "junior" || s === "mid",
  );

  return {
    modelTypes: asArray(params.modelTypes),
    frameworks: asArray(params.frameworks),
    seniority,
    deployment: one("deployment") === "1",
    dataExposure: one("dataExposure") === "1",
    minScale,
    yearsMin: int("yearsMin"),
    yearsMax: int("yearsMax"),
    verification,
    q: (one("q") ?? "").trim(),
  };
}

export function filtersToQuery(filters: SearchFilters): string {
  const params = new URLSearchParams();
  filters.modelTypes.forEach((v) => params.append("modelTypes", v));
  filters.frameworks.forEach((v) => params.append("frameworks", v));
  filters.seniority.forEach((v) => params.append("seniority", v));
  if (filters.deployment) params.set("deployment", "1");
  if (filters.dataExposure) params.set("dataExposure", "1");
  if (filters.minScale) params.set("minScale", filters.minScale);
  if (filters.yearsMin !== null) params.set("yearsMin", String(filters.yearsMin));
  if (filters.yearsMax !== null) params.set("yearsMax", String(filters.yearsMax));
  if (filters.verification !== "all") params.set("verification", filters.verification);
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return filtersToQuery({ ...filters, verification: "all" }) !== "";
}

function buildConditions(filters: SearchFilters, updatedSince?: Date): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."visible" = true`,
    Prisma.sql`u."role" = 'candidate'`,
    Prisma.sql`u."emailVerified" = true`,
    Prisma.sql`u."status" = 'active'`,
    // Index readiness: a recruiter card without a skill or a project is noise (§7.4).
    Prisma.sql`EXISTS (SELECT 1 FROM "SkillClaim" s WHERE s."profileId" = p."id")`,
    Prisma.sql`EXISTS (SELECT 1 FROM "Project" pr WHERE pr."profileId" = p."id")`,
  ];

  const skillNames = Array.from(new Set([...filters.modelTypes, ...filters.frameworks]));
  if (skillNames.length > 0) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "SkillClaim" s
      WHERE s."profileId" = p."id"
        AND s."skillName" IN (${Prisma.join(skillNames)})
        AND s."verificationStatus" <> 'failed'
    )`);
  }

  if (filters.deployment) {
    conditions.push(Prisma.sql`(
      EXISTS (SELECT 1 FROM "Project" pr WHERE pr."profileId" = p."id" AND pr."deploymentVerified" = true)
      OR EXISTS (
        SELECT 1 FROM "SkillClaim" s
        WHERE s."profileId" = p."id" AND s."verificationStatus" = 'verified' AND s."skillCategory" = 'deployment'
      )
    )`);
  }

  if (filters.dataExposure) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "SkillClaim" s
      WHERE s."profileId" = p."id" AND s."skillCategory" = 'data' AND s."verificationStatus" <> 'failed'
    )`);
  }

  if (filters.minScale) {
    const allowed = SCALE_ORDER.slice(SCALE_ORDER.indexOf(filters.minScale));
    conditions.push(
      // Enum columns are cast to text so the parameter array binds as text (Prisma sends text[]).
      Prisma.sql`EXISTS (
        SELECT 1 FROM "Project" pr
        WHERE pr."profileId" = p."id" AND pr."projectScale"::text IN (${Prisma.join(allowed)})
      )`,
    );
  }

  if (filters.seniority.length > 0) {
    conditions.push(Prisma.sql`p."seniorityBand"::text IN (${Prisma.join(filters.seniority)})`);
  }

  if (filters.yearsMin !== null) conditions.push(Prisma.sql`p."yearsExperience" >= ${filters.yearsMin}`);
  if (filters.yearsMax !== null) conditions.push(Prisma.sql`p."yearsExperience" <= ${filters.yearsMax}`);

  if (filters.verification === "has_verified") {
    conditions.push(Prisma.sql`(
      EXISTS (SELECT 1 FROM "SkillClaim" s WHERE s."profileId" = p."id" AND s."verificationStatus" = 'verified')
      OR EXISTS (SELECT 1 FROM "Credential" c WHERE c."profileId" = p."id" AND c."verificationStatus" = 'verified')
    )`);
  } else if (filters.verification === "verified_only") {
    conditions.push(Prisma.sql`
      EXISTS (SELECT 1 FROM "SkillClaim" s WHERE s."profileId" = p."id" AND s."verificationStatus" = 'verified')
      AND NOT EXISTS (
        SELECT 1 FROM "SkillClaim" s2
        WHERE s2."profileId" = p."id" AND s2."verificationStatus" <> 'verified'
      )
    `);
  }

  if (filters.q) {
    conditions.push(Prisma.sql`(
      to_tsvector('english', coalesce(p."headline", '')) @@ plainto_tsquery('english', ${filters.q})
      OR EXISTS (
        SELECT 1 FROM "Project" pr
        WHERE pr."profileId" = p."id"
          AND to_tsvector('english', coalesce(pr."title", '') || ' ' || coalesce(pr."result", ''))
              @@ plainto_tsquery('english', ${filters.q})
      )
    )`);
  }

  if (updatedSince) {
    conditions.push(Prisma.sql`p."updatedAt" >= ${updatedSince}`);
  }

  return Prisma.join(conditions, " AND ");
}

function baseCte(where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT
      p."id",
      p."completenessScore",
      p."updatedAt",
      (SELECT count(*)::int FROM "SkillClaim" s
        WHERE s."profileId" = p."id" AND s."verificationStatus" = 'verified') AS verified_skills,
      (SELECT COALESCE(max(CASE pr."projectScale"
          WHEN 'oss' THEN 4 WHEN 'production' THEN 3 WHEN 'coursework' THEN 2 WHEN 'toy' THEN 1 ELSE 0 END), 0)::int
        FROM "Project" pr WHERE pr."profileId" = p."id") AS depth,
      (CASE WHEN EXISTS (
          SELECT 1 FROM "Project" pr WHERE pr."profileId" = p."id" AND pr."deploymentVerified" = true
        ) OR EXISTS (
          SELECT 1 FROM "SkillClaim" s
          WHERE s."profileId" = p."id" AND s."verificationStatus" = 'verified' AND s."skillCategory" = 'deployment'
        ) THEN 1 ELSE 0 END) AS deploy
    FROM "CandidateProfile" p
    JOIN "User" u ON u."id" = p."userId"
    WHERE ${where}
  `;
}

type RankedRow = {
  id: string;
  score: number;
  verified_skills: number;
  depth: number;
  deploy: number;
};

export type CandidateCard = {
  id: string;
  fullName: string;
  headline: string;
  location: string;
  yearsExperience: number;
  seniorityBand: SeniorityBand;
  currentStatus: CandidateProfile["currentStatus"];
  completenessScore: number;
  updatedAt: Date;
  verifiedSkills: SkillClaim[];
  topSkills: SkillClaim[];
  strongestProject: Project | null;
  verifiedSkillCount: number;
  verifiedCredentialCount: number;
  hasVerifiedDeployment: boolean;
  user: Pick<User, "email">;
};

function categoryPriority(claim: SkillClaim): number {
  switch (claim.skillCategory) {
    case "model_type":
      return 0;
    case "framework":
      return 1;
    case "deployment":
      return 2;
    case "data":
      return 3;
    default:
      return 4;
  }
}

export async function loadCards(ids: string[]): Promise<CandidateCard[]> {
  if (ids.length === 0) return [];
  const profiles = await db.candidateProfile.findMany({
    where: { id: { in: ids } },
    include: {
      user: true,
      skills: true,
      credentials: true,
      projects: true,
    },
  });

  const byId = new Map(profiles.map((p) => [p.id, p]));

  return ids
    .map((id) => byId.get(id))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
    .map((profile) => {
      const verifiedSkills = profile.skills
        .filter((s) => s.verificationStatus === "verified")
        .sort((a, b) => categoryPriority(a) - categoryPriority(b) || a.skillName.localeCompare(b.skillName));
      const strongestProject =
        [...profile.projects].sort(
          (a, b) =>
            scaleWeight(b.projectScale) - scaleWeight(a.projectScale) ||
            Number(b.deploymentVerified) - Number(a.deploymentVerified) ||
            Number(b.repoVerified) - Number(a.repoVerified),
        )[0] ?? null;
      const hasVerifiedDeployment =
        profile.projects.some((p) => p.deploymentVerified) ||
        profile.skills.some((s) => s.verificationStatus === "verified" && s.skillCategory === "deployment");

      return {
        id: profile.id,
        fullName: profile.fullName,
        headline: profile.headline,
        location: profile.location,
        yearsExperience: profile.yearsExperience,
        seniorityBand: profile.seniorityBand,
        currentStatus: profile.currentStatus,
        completenessScore: profile.completenessScore,
        updatedAt: profile.updatedAt,
        verifiedSkills,
        topSkills: verifiedSkills.slice(0, 3),
        strongestProject,
        verifiedSkillCount: verifiedSkills.length,
        verifiedCredentialCount: profile.credentials.filter((c) => c.verificationStatus === "verified").length,
        hasVerifiedDeployment,
        user: { email: profile.user.email },
      };
    });
}

export type SearchPage = {
  cards: CandidateCard[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export async function searchCandidates(
  filters: SearchFilters,
  options: { page?: number; perPage?: number; updatedSince?: Date } = {},
): Promise<SearchPage> {
  const perPage = options.perPage ?? 20;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * perPage;

  const where = buildConditions(filters, options.updatedSince);
  const cte = baseCte(where);

  const w = rankingConfig;
  const score = Prisma.sql`(
    ${w.verifiedSkills} * LEAST(verified_skills, ${w.verifiedSkillCap})
    + ${w.projectDepth} * depth
    + ${w.deployment} * deploy
    + ${w.completeness} * ("completenessScore" / 100.0)
    + ${w.recency} * EXP(-EXTRACT(EPOCH FROM (now() - "updatedAt")) / 86400.0 / ${w.recencyHalfLifeDays})
  )::float8`;

  const ranked = await db.$queryRaw<RankedRow[]>(Prisma.sql`
    WITH base AS (${cte})
    SELECT "id", verified_skills, depth, deploy, ${score} AS score
    FROM base
    ORDER BY score DESC, "updatedAt" DESC
    LIMIT ${perPage} OFFSET ${offset}
  `);

  const totals = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT count(*)::int AS count
    FROM "CandidateProfile" p
    JOIN "User" u ON u."id" = p."userId"
    WHERE ${where}
  `);

  const total = totals[0]?.count ?? 0;
  const cards = await loadCards(ranked.map((r) => r.id));

  return { cards, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getCandidateCard(profileId: string): Promise<CandidateCard | null> {
  const [card] = await loadCards([profileId]);
  return card ?? null;
}
