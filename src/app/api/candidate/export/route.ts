import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GDPR data export (§6.7): the candidate's own structured profile as JSON. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "candidate") {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    include: {
      skills: true,
      projects: true,
      credentials: true,
      interests: { include: { recruiterAccount: { select: { orgName: true } } } },
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      createdAt: user.createdAt,
    },
    profile,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="aitalented-export-${user.id}.json"`,
      "cache-control": "no-store",
    },
  });
}
