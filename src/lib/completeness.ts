import { db } from "./db";

/**
 * Profile completeness (0-100), requirements §6.3.
 *   basics filled ................ 30
 *   at least one skill ........... 15
 *   at least one project ......... 25
 *   at least one verified claim .. 20
 *   at least one credential ......  5
 *   public contact email .........  5
 * Recomputed after every profile mutation so search ranking stays truthful.
 */
export async function recomputeCompleteness(profileId: string): Promise<number> {
  const profile = await db.candidateProfile.findUnique({
    where: { id: profileId },
    include: { skills: true, projects: true, credentials: true },
  });
  if (!profile) return 0;

  let score = 0;
  const basicsFilled =
    profile.headline.trim().length > 0 &&
    profile.location.trim().length > 0 &&
    profile.fullName.trim().length > 0;
  if (basicsFilled) score += 30;
  if (profile.skills.length > 0) score += 15;
  if (profile.projects.length > 0) score += 25;
  if (profile.skills.some((s) => s.verificationStatus === "verified")) score += 20;
  else if (profile.credentials.some((c) => c.verificationStatus === "verified")) score += 20;
  if (profile.credentials.length > 0) score += 5;
  if (profile.contactEmailPublic?.trim()) score += 5;

  await db.candidateProfile.update({
    where: { id: profileId },
    data: { completenessScore: score },
  });
  return score;
}
