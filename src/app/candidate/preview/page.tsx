import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileView } from "@/components/ProfileView";
import { Flash, PageHeader } from "@/components/ui";

export default async function CandidatePreview({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const user = await requireRole("candidate");
  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    include: { skills: true, projects: true, credentials: true },
  });
  if (!profile) return null;

  return (
    <div className="shell">
      <PageHeader
        kicker="Recruiter view"
        title="This is exactly what a recruiter sees"
        sub="Same template for every candidate. Your public contact email is hidden until you accept an interest request."
      >
        <Link className="btn" href="/candidate/profile">
          Edit profile
        </Link>
      </PageHeader>
      <Flash error={params.error} success={params.success} />
      {!profile.visible ? (
        <div className="flash flash--warn">
          <span aria-hidden>!</span>
          <span>Your profile is hidden — recruiters cannot find it in search, digests or exports.</span>
        </div>
      ) : null}
      <ProfileView profile={profile} contactEmail={null} showNotes={false} />
    </div>
  );
}
