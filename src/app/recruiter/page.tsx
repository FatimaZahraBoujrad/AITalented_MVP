import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { recruiterHasAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { filtersToQuery, parseFilters, searchCandidates } from "@/lib/search";
import { daysLeft } from "@/lib/labels";
import { pageQuery } from "@/lib/recruiter-filters";
import { saveSearchAction } from "@/app/actions/recruiter";
import { FilterPanel } from "@/components/FilterPanel";
import { CandidateResult } from "@/components/CandidateResult";
import { Empty, Flash, PageHeader } from "@/components/ui";

export default async function RecruiterSearch({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireRole("recruiter");
  const account = user.recruiter;
  if (!account) {
    return (
      <div className="shell">
        <Empty title="No recruiter account attached">Ask the AITalented team to provision your seat.</Empty>
      </div>
    );
  }

  const hasAccess = recruiterHasAccess(account);
  const filters = parseFilters(params);
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const taxonomy = await db.skillTaxonomy.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const results = hasAccess
    ? await searchCandidates(filters, { page })
    : { cards: [], total: 0, page: 1, perPage: 20, totalPages: 1 };
  const query = filtersToQuery(filters);

  return (
    <div className="shell">
      <PageHeader
        kicker="Recruiter workspace"
        title="Search the verified index"
        sub={`${account.orgName} · ${account.seatCount} seat(s) · ${
          account.billingStatus === "trial" ? `${daysLeft(account.trialEndsAt)} day(s) left in trial` : account.billingStatus
        }`}
      >
        <Link className="btn" href="/recruiter/saved-searches">
          Saved searches
        </Link>
        <Link className="btn btn--ghost" href="/recruiter/billing">
          Billing
        </Link>
      </PageHeader>

      <Flash
        error={typeof params.error === "string" ? params.error : undefined}
        success={typeof params.success === "string" ? params.success : undefined}
      />

      {!hasAccess ? (
        <section className="card">
          <h2 className="card__title">Your trial has ended</h2>
          <p className="page-sub">
            Search, profiles and outreach are locked until the pilot subscription is active
            ($199 per seat / month). Existing shortlists and saved searches are kept.
          </p>
          <div className="actions" style={{ marginTop: 16 }}>
            <Link className="btn btn--primary" href="/recruiter/billing">
              Go to billing
            </Link>
          </div>
        </section>
      ) : (
        <div className="search-layout">
          <FilterPanel filters={filters} taxonomy={taxonomy} total={results.total} />

          <div>
            <div className="card" style={{ marginBottom: 12, padding: 14 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="row" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{results.total} candidate(s)</strong>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Ranked by verified skills, project depth, deployment, completeness, recency
                  </span>
                </div>
                <form action={saveSearchAction} className="row" style={{ gap: 6 }}>
                  <input type="hidden" name="filters" value={query} />
                  <input
                    className="input"
                    style={{ width: 168 }}
                    name="name"
                    placeholder="Name this search"
                    required
                    aria-label="Saved search name"
                  />
                  <button className="btn btn--sm" type="submit">
                    Save + weekly digest
                  </button>
                </form>
              </div>
            </div>

            {results.cards.length === 0 ? (
              <Empty title="No candidates match these filters">
                Loosen the verification mode or clear a skill filter. Hidden profiles never appear
                here, and profiles need a verified email, at least one skill and one project.
              </Empty>
            ) : (
              <div className="results">
                {results.cards.map((card) => (
                  <CandidateResult
                    key={card.id}
                    card={card}
                    back={`/recruiter${pageQuery(filters, page)}`}
                  />
                ))}
              </div>
            )}

            <div className="pagination">
              <span>
                Page {results.page} of {results.totalPages} · 20 per page
              </span>
              <div className="actions">
                {results.page > 1 ? (
                  <Link className="btn btn--sm" href={`/recruiter${pageQuery(filters, results.page - 1)}`}>
                    ← Previous
                  </Link>
                ) : (
                  <span className="btn btn--sm" aria-disabled="true" style={{ opacity: 0.4 }}>
                    ← Previous
                  </span>
                )}
                {results.page < results.totalPages ? (
                  <Link className="btn btn--sm" href={`/recruiter${pageQuery(filters, results.page + 1)}`}>
                    Next →
                  </Link>
                ) : (
                  <span className="btn btn--sm" aria-disabled="true" style={{ opacity: 0.4 }}>
                    Next →
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
