import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { filtersToQuery } from "@/lib/search";
import { describeFilters, normalizeFilters, pageQuery } from "@/lib/recruiter-filters";
import { formatDate } from "@/lib/labels";
import { deleteSearchAction, toggleDigestAction } from "@/app/actions/recruiter";
import { Empty, Flash, PageHeader } from "@/components/ui";

export default async function SavedSearchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const user = await requireRole("recruiter");
  const account = user.recruiter;
  if (!account) return null;

  const searches = await db.savedSearch.findMany({
    where: { recruiterAccountId: account.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="shell">
      <PageHeader
        kicker="Recruiter workspace"
        title="Saved searches"
        sub="Weekly digest: only profiles matching the saved filter and updated in the last 7 days. Every search has its own unsubscribe link."
      />
      <Flash error={params.error} success={params.success} />

      {searches.length === 0 ? (
        <Empty title="No saved searches">
          Run a search and choose “Save + weekly digest”. Digests are delivered weekly while the
          subscription is active.
        </Empty>
      ) : (
        <div className="stack">
          {searches.map((search) => {
            const filters = normalizeFilters(search.filterJson);
            return (
              <section className="card" key={search.id}>
                <div className="card__head">
                  <div>
                    <h2 className="card__title">{search.name}</h2>
                    <p className="card__hint">{describeFilters(filters)}</p>
                  </div>
                  <span className={`chip`}>{search.digestEnabled ? "Digest on" : "Digest off"}</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="faint" style={{ fontSize: 12 }}>
                    Created {formatDate(search.createdAt)} · last digest{" "}
                    {search.lastDigestAt ? formatDate(search.lastDigestAt) : "never"}
                  </div>
                  <div className="actions">
                    <Link className="btn btn--sm" href={`/recruiter${pageQuery(filters, 1)}`}>
                      Run search
                    </Link>
                    <form action={toggleDigestAction}>
                      <input type="hidden" name="searchId" value={search.id} />
                      <button className="btn btn--sm" type="submit">
                        {search.digestEnabled ? "Pause digest" : "Resume digest"}
                      </button>
                    </form>
                    <Link className="btn btn--ghost btn--sm" href={`/digest/unsubscribe?token=${search.digestToken}`}>
                      Unsubscribe link
                    </Link>
                    <form action={deleteSearchAction}>
                      <input type="hidden" name="searchId" value={search.id} />
                      <button className="btn btn--danger btn--sm" type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                {filtersToQuery(filters) ? (
                  <p className="faint" style={{ fontSize: 11.5, marginTop: 10, wordBreak: "break-all" }}>
                    /recruiter?{filtersToQuery(filters)}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
