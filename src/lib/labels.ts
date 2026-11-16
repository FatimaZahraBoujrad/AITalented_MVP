import type {
  CurrentStatus,
  ProjectScale,
  SeniorityBand,
  SkillCategory,
  VerificationStatus,
} from "@prisma/client";

export const SENIORITY_LABEL: Record<SeniorityBand, string> = {
  junior: "Junior (0-2 yrs)",
  mid: "Mid (3-4 yrs)",
};

export const STATUS_LABEL: Record<CurrentStatus, string> = {
  open: "Open to work",
  employed: "Employed",
  not_looking: "Not looking",
};

export const SCALE_LABEL: Record<ProjectScale, string> = {
  toy: "Toy",
  coursework: "Coursework",
  production: "Production",
  oss: "Open source",
};

export const CATEGORY_LABEL: Record<SkillCategory, string> = {
  model_type: "Model types",
  framework: "Frameworks",
  deployment: "Deployment",
  data: "Data engineering",
  other: "Other",
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  pending: "Pending",
  verified: "Verified",
  failed: "Failed",
  manual_review: "Manual review",
};

export function scoreBand(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 55) return "Solid";
  if (score >= 30) return "Thin";
  return "Incomplete";
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysLeft(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
}
