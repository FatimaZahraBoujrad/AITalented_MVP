import { db } from "./db";
import { enqueueEmail } from "./email";
import { recruiterHasAccess } from "./auth";
import { searchCandidates } from "./search";
import { normalizeFilters } from "./recruiter-filters";
import { appUrl } from "./url";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Weekly saved-search digest (§7.8). Called by the worker every few minutes and guarded
 * per search by lastDigestAt, so it is idempotent and self-healing after downtime.
 * Only visible, verified-email candidates updated in the last 7 days are included.
 */
export async function runWeeklyDigests(options: { force?: boolean } = {}): Promise<{ sent: number }> {
  const now = new Date();
  const searches = await db.savedSearch.findMany({
    where: {
      digestEnabled: true,
      ...(options.force
        ? {}
        : {
            OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: new Date(now.getTime() - WEEK_MS) } }],
          }),
    },
    include: { recruiterAccount: { include: { user: true } } },
    take: 50,
  });

  let sent = 0;
  for (const search of searches) {
    const account = search.recruiterAccount;
    if (!recruiterHasAccess(account)) continue;

    const since = search.lastDigestAt ? new Date(Math.max(search.lastDigestAt.getTime(), now.getTime() - WEEK_MS)) : new Date(now.getTime() - WEEK_MS);
    const filters = normalizeFilters(search.filterJson);
    const results = await searchCandidates(filters, { page: 1, perPage: 20, updatedSince: since });

    if (results.cards.length > 0) {
      const lines = results.cards
        .map(
          (card) =>
            `• ${card.fullName} — ${card.headline || "AI/ML engineer"} (${card.verifiedSkillCount} verified skills${
              card.hasVerifiedDeployment ? ", verified deployment" : ""
            })\n  ${appUrl()}/recruiter/candidates/${card.id}`,
        )
        .join("\n\n");

      await enqueueEmail({
        to: account.user.email,
        subject: `${results.cards.length} new match${results.cards.length === 1 ? "" : "es"} for "${search.name}"`,
        kind: "digest",
        body: `Your saved search "${search.name}" has ${results.cards.length} new verified match${
          results.cards.length === 1 ? "" : "es"
        } since ${since.toLocaleDateString("en-GB")}.\n\n${lines}\n\nUnsubscribe from this search: ${appUrl()}/digest/unsubscribe?token=${
          search.digestToken
        }\n\n— AITalented`,
      });
      sent += 1;
    }

    await db.savedSearch.update({
      where: { id: search.id },
      data: { lastDigestAt: now, lastRunAt: now },
    });
  }

  return { sent };
}
