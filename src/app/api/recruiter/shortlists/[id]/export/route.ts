import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/url";
import { SCALE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.role !== "recruiter" || !user.recruiter) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const { id } = await params;

  const shortlist = await db.shortlist.findFirst({
    where: { id, recruiterAccountId: user.recruiter.id },
    include: {
      items: {
        include: {
          profile: {
            include: { user: true, skills: true, projects: true },
          },
        },
      },
    },
  });
  if (!shortlist) return Response.json({ error: "Shortlist not found" }, { status: 404 });

  const accepted = await db.interestRequest.findMany({
    where: {
      recruiterAccountId: user.recruiter.id,
      status: "accepted",
      profileId: { in: shortlist.items.map((i) => i.profileId) },
    },
    select: { profileId: true },
  });
  const acceptedIds = new Set(accepted.map((a) => a.profileId));

  const header = [
    "name",
    "headline",
    "seniority",
    "years_experience",
    "verified_skills",
    "self_reported_skills",
    "strongest_project",
    "project_scale",
    "repo_links",
    "deployment_links",
    "contact_email_if_accepted",
    "profile_url",
  ];

  const rows = shortlist.items.map((item) => {
    const profile = item.profile;
    const verified = profile.skills.filter((s) => s.verificationStatus === "verified");
    const selfReported = profile.skills.filter((s) => s.verificationStatus === "unverified");
    const project = [...profile.projects].sort((a, b) => Number(b.deploymentVerified) - Number(a.deploymentVerified))[0];
    return [
      profile.fullName,
      profile.headline,
      profile.seniorityBand,
      profile.yearsExperience,
      verified.map((s) => s.skillName).join("; "),
      selfReported.map((s) => s.skillName).join("; "),
      project?.result || project?.title || "",
      project ? SCALE_LABEL[project.projectScale] : "",
      profile.projects.map((p) => p.repoUrl).filter(Boolean).join(" "),
      profile.projects.map((p) => p.deploymentUrl).filter(Boolean).join(" "),
      acceptedIds.has(profile.id) ? profile.contactEmailPublic ?? "" : "",
      `${appUrl()}/recruiter/candidates/${profile.id}`,
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="shortlist-${shortlist.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv"`,
      "cache-control": "no-store",
    },
  });
}
