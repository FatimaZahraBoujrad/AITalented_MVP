"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function unsubscribeDigestAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/digest/unsubscribe?error=Missing%20token");

  const search = await db.savedSearch.findUnique({
    where: { digestToken: token },
    include: { recruiterAccount: true },
  });
  if (!search) redirect("/digest/unsubscribe?error=Unknown%20search");

  await db.savedSearch.update({ where: { id: search.id }, data: { digestEnabled: false } });
  await audit({
    actorUserId: null,
    action: "recruiter.digest_unsubscribed",
    entityType: "savedSearch",
    entityId: search.id,
    metadata: { recruiterAccountId: search.recruiterAccountId },
  });
  redirect(`/digest/unsubscribe?token=${token}&success=1`);
}
