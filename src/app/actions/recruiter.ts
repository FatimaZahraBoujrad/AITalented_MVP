"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recruiterHasAccess } from "@/lib/access";
import { audit } from "@/lib/audit";
import { enqueueEmail } from "@/lib/email";
import { appUrl } from "@/lib/url";
import { filterJsonFromQueryString } from "@/lib/recruiter-filters";
import { INTEREST_TTL_DAYS, interestCooldownRemaining } from "@/lib/interests";
import { expireStaleInterests } from "@/lib/interests";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

async function currentRecruiter() {
  const user = await requireRole("recruiter");
  if (!user.recruiter) redirect("/recruiter/billing");
  if (!recruiterHasAccess(user.recruiter)) redirect("/recruiter/billing?locked=1");
  return { user, account: user.recruiter };
}

export async function sendInterestAction(formData: FormData): Promise<void> {
  const { user, account } = await currentRecruiter();
  const profileId = String(formData.get("profileId") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const back = `/recruiter/candidates/${profileId}`;

  if (!message) fail(back, "Add a short message (280 characters max)");
  if (message.length > 280) fail(back, "Message must be 280 characters or fewer");

  const profile = await db.candidateProfile.findUnique({
    where: { id: profileId },
    include: { user: true },
  });
  if (!profile || !profile.visible) fail(back, "This candidate is not available");

  const cooldown = await interestCooldownRemaining(account.id, profileId);
  if (cooldown > 0) fail(back, `You can contact this candidate again in ${cooldown} day(s)`);

  const interest = await db.interestRequest.create({
    data: {
      recruiterAccountId: account.id,
      profileId,
      message,
      status: "sent",
      expiresAt: new Date(Date.now() + INTEREST_TTL_DAYS * 86_400_000),
    },
  });

  await enqueueEmail({
    to: profile.user.email,
    kind: "interest",
    subject: `${account.orgName} is interested in your profile`,
    body: `${account.orgName} sent you an interest request:\n\n"${message}"\n\nReview it in your inbox: ${appUrl()}/candidate/inbox\n\nYou choose whether to share your contact email. The request expires in ${INTEREST_TTL_DAYS} days.\n\n— AITalented`,
  });

  await audit({
    actorUserId: user.id,
    action: "recruiter.interest_sent",
    entityType: "interest",
    entityId: interest.id,
    metadata: { profileId, recruiterAccountId: account.id },
  });
  revalidatePath(back);
  revalidatePath("/candidate/inbox");
  ok(back, "Interest sent to the candidate");
}

export async function addToShortlistAction(formData: FormData): Promise<void> {
  const { user, account } = await currentRecruiter();
  const profileId = String(formData.get("profileId") ?? "");
  const shortlistId = String(formData.get("shortlistId") ?? "");
  const back = String(formData.get("back") ?? "/recruiter");

  let target = shortlistId
    ? await db.shortlist.findFirst({ where: { id: shortlistId, recruiterAccountId: account.id } })
    : await db.shortlist.findFirst({
        where: { recruiterAccountId: account.id },
        orderBy: { createdAt: "asc" },
      });

  if (!target) {
    target = await db.shortlist.create({
      data: { recruiterAccountId: account.id, name: "Shortlist" },
    });
  }

  const exists = await db.shortlistItem.findUnique({
    where: { shortlistId_profileId: { shortlistId: target.id, profileId } },
  });
  if (!exists) {
    await db.shortlistItem.create({ data: { shortlistId: target.id, profileId } });
  }
  await audit({
    actorUserId: user.id,
    action: "recruiter.shortlist_add",
    entityType: "profile",
    entityId: profileId,
    metadata: { shortlistId: target.id },
  });
  revalidatePath(back);
  ok(back, "Added to shortlist");
}

export async function removeFromShortlistAction(formData: FormData): Promise<void> {
  const { account } = await currentRecruiter();
  const shortlistId = String(formData.get("shortlistId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  const shortlist = await db.shortlist.findFirst({
    where: { id: shortlistId, recruiterAccountId: account.id },
  });
  if (!shortlist) fail("/recruiter/shortlists", "Shortlist not found");
  await db.shortlistItem.deleteMany({ where: { shortlistId, profileId } });
  revalidatePath("/recruiter/shortlists");
  ok("/recruiter/shortlists", "Removed from shortlist");
}

export async function createShortlistAction(formData: FormData): Promise<void> {
  const { account } = await currentRecruiter();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) fail("/recruiter/shortlists", "Give the shortlist a name");
  const existing = await db.shortlist.findFirst({
    where: { recruiterAccountId: account.id, name },
  });
  if (existing) fail("/recruiter/shortlists", "A shortlist with that name already exists");
  await db.shortlist.create({ data: { recruiterAccountId: account.id, name } });
  revalidatePath("/recruiter/shortlists");
  ok("/recruiter/shortlists", "Shortlist created");
}

const saveSearchSchema = z.object({
  name: z.string().trim().min(2, "Name your saved search").max(60),
  filters: z.string(),
});

export async function saveSearchAction(formData: FormData): Promise<void> {
  const { account } = await currentRecruiter();
  const parsed = saveSearchSchema.safeParse({
    name: formData.get("name"),
    filters: formData.get("filters") ?? "",
  });
  const back = "/recruiter/saved-searches";
  if (!parsed.success) fail(back, parsed.error.issues[0].message);

  await db.savedSearch.create({
    data: {
      recruiterAccountId: account.id,
      name: parsed.data.name,
      filterJson: filterJsonFromQueryString(parsed.data.filters),
    },
  });
  revalidatePath(back);
  ok(back, "Saved search created — weekly digest enabled");
}

export async function deleteSearchAction(formData: FormData): Promise<void> {
  const { account } = await currentRecruiter();
  const searchId = String(formData.get("searchId") ?? "");
  await db.savedSearch.deleteMany({ where: { id: searchId, recruiterAccountId: account.id } });
  revalidatePath("/recruiter/saved-searches");
  ok("/recruiter/saved-searches", "Saved search deleted");
}

export async function toggleDigestAction(formData: FormData): Promise<void> {
  const { account } = await currentRecruiter();
  const searchId = String(formData.get("searchId") ?? "");
  const search = await db.savedSearch.findFirst({
    where: { id: searchId, recruiterAccountId: account.id },
  });
  if (!search) fail("/recruiter/saved-searches", "Saved search not found");
  await db.savedSearch.update({
    where: { id: search.id },
    data: { digestEnabled: !search.digestEnabled },
  });
  revalidatePath("/recruiter/saved-searches");
  ok("/recruiter/saved-searches", search.digestEnabled ? "Digest paused" : "Digest resumed");
}

export async function expireInterestsAction(): Promise<void> {
  await requireRole("recruiter");
  await expireStaleInterests();
  revalidatePath("/recruiter/outreach");
  ok("/recruiter/outreach", "Expired requests updated");
}
