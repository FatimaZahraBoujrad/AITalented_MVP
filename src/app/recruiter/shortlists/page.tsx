import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { SCALE_LABEL } from "@/lib/labels";
import {
  createShortlistAction,
  removeFromShortlistAction,
} from "@/app/actions/recruiter";
import { Empty, Flash, PageHeader } from "@/components/ui";

export default async function ShortlistsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const user = await requireRole("recruiter");
  const account = user.recruiter;
  if (!account) return null;

  const shortlists = await db.shortlist.findMany({
    where: { recruiterAccountId: account.id },
    include: {
      items: {
        include: {
          profile: { include: { skills: true, projects: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="shell">
      <PageHeader
        kicker="Recruiter workspace"
        title="Shortlists"
        sub="Named lists of candidates. CSV export includes name, headline, verified skills, links and the contact email only where the candidate accepted."
      />
      <Flash error={params.error} success={params.success} />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div>
            <h2 className="card__title">New shortlist</h2>
            <p className="card__hint">Every candidate shortlisted from search lands in your first list by default.</p>
          </div>
        </div>
        <form action={createShortlistAction} className="row" style={{ gap: 8 }}>
          <input className="input" style={{ maxWidth: 280 }} name="name" placeholder="e.g. Retrieval engineers — Q1" required />
          <button className="btn btn--primary btn--sm" type="submit">
            Create shortlist
          </button>
        </form>
      </section>

      {shortlists.length === 0 ? (
        <Empty title="No shortlists yet">
          Add candidates from search or from a profile page.
        </Empty>
      ) : (
        <div className="stack">
          {shortlists.map((shortlist) => (
            <section className="card" key={shortlist.id}>
              <div className="card__head">
                <div>
                  <h2 className="card__title">{shortlist.name}</h2>
                  <p className="card__hint">{shortlist.items.length} candidate(s)</p>
                </div>
                {shortlist.items.length > 0 ? (
                  <a className="btn btn--sm" href={`/api/recruiter/shortlists/${shortlist.id}/export`} download>
                    Export CSV
                  </a>
                ) : null}
              </div>
              {shortlist.items.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>Empty list.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Candidate</th>
                        <th>Verified skills</th>
                        <th>Strongest project</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {shortlist.items.map((item) => {
                        const verified = item.profile.skills.filter((s) => s.verificationStatus === "verified");
                        const strongest = item.profile.projects[0];
                        return (
                          <tr key={item.id}>
                            <td>
                              <Link className="link" href={`/recruiter/candidates/${item.profileId}`}>
                                {item.profile.fullName}
                              </Link>
                              <div className="faint" style={{ fontSize: 11.5 }}>{item.profile.headline}</div>
                            </td>
                            <td>
                              {verified.length === 0 ? (
                                <span className="faint">None</span>
                              ) : (
                                <div className="tag-list">
                                  {verified.slice(0, 4).map((skill) => (
                                    <span className="badge badge--verified" key={skill.id}>{skill.skillName}</span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {strongest ? (
                                <>
                                  <strong>{strongest.title}</strong>
                                  <div className="faint" style={{ fontSize: 11.5 }}>{SCALE_LABEL[strongest.projectScale]}</div>
                                </>
                              ) : (
                                <span className="faint">—</span>
                              )}
                            </td>
                            <td>
                              <form action={removeFromShortlistAction}>
                                <input type="hidden" name="shortlistId" value={shortlist.id} />
                                <input type="hidden" name="profileId" value={item.profileId} />
                                <button className="btn btn--ghost btn--sm" type="submit">Remove</button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
