import type {
  CandidateProfile,
  Credential,
  Project,
  SkillClaim,
} from "@prisma/client";
import {
  CATEGORY_LABEL,
  SCALE_LABEL,
  SENIORITY_LABEL,
  STATUS_LABEL,
  formatDate,
} from "@/lib/labels";
import { Badge } from "./ui";

export type PortfolioProfile = CandidateProfile & {
  skills: SkillClaim[];
  projects: Project[];
  credentials: Credential[];
};

const CATEGORY_ORDER = ["model_type", "framework", "deployment", "data", "other"] as const;

export function ProfileView({
  profile,
  contactEmail,
  showNotes = true,
}: {
  profile: PortfolioProfile;
  contactEmail?: string | null;
  showNotes?: boolean;
}) {
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    skills: profile.skills
      .filter((s) => s.skillCategory === category)
      .sort((a, b) => a.skillName.localeCompare(b.skillName)),
  })).filter((group) => group.skills.length > 0);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card">
        <div className="card__head" style={{ marginBottom: 8 }}>
          <div>
            <div className="kicker">Verified portfolio</div>
            <h2 style={{ fontSize: 26, marginTop: 6 }}>{profile.fullName}</h2>
            <p className="page-sub" style={{ marginTop: 6 }}>
              {profile.headline || "No headline yet"}
            </p>
          </div>
          <div className="actions">
            <span className="badge badge--verified">{profile.skills.filter((s) => s.verificationStatus === "verified").length} verified</span>
            <span className="chip">{profile.completenessScore}% complete</span>
          </div>
        </div>
        <div className="cand__meta" style={{ marginTop: 12 }}>
          <span>{SENIORITY_LABEL[profile.seniorityBand]}</span>
          <span>{profile.yearsExperience} yrs experience</span>
          {profile.location ? <span>{profile.location}</span> : null}
          <span>{STATUS_LABEL[profile.currentStatus]}</span>
          {contactEmail ? <span className="link">{contactEmail}</span> : null}
        </div>
        <p className="faint" style={{ fontSize: 11.5, marginTop: 12 }}>
          Repo badges confirm a public repository exists, has commits and shows matching
          dependencies. Authorship is not verified in the MVP.
        </p>
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Skill matrix</h2>
            <p className="card__hint">Verified claims are evidenced; self-reported claims are declared.</p>
          </div>
        </div>
        {grouped.length === 0 ? (
          <p className="muted">No skills listed yet.</p>
        ) : (
          <div className="stack" style={{ gap: 18 }}>
            {grouped.map((group) => (
              <div key={group.category}>
                <div className="kicker" style={{ marginBottom: 8 }}>
                  {CATEGORY_LABEL[group.category]}
                </div>
                <div className="stack" style={{ gap: 0 }}>
                  {group.skills.map((skill) => (
                    <div
                      key={skill.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "8px 0",
                        borderBottom: "1px solid rgba(34,48,64,.55)",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{skill.skillName}</span>
                        {skill.evidenceRef ? (
                          <a
                            className="link"
                            style={{ marginLeft: 8, fontSize: 11.5 }}
                            href={skill.evidenceRef}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            evidence ↗
                          </a>
                        ) : (
                          <span className="faint" style={{ marginLeft: 8, fontSize: 11.5 }}>
                            self-reported
                          </span>
                        )}
                        {showNotes && skill.failureReason ? (
                          <div className="faint" style={{ fontSize: 11.5, marginTop: 3 }}>
                            {skill.failureReason}
                          </div>
                        ) : null}
                      </div>
                      <Badge status={skill.verificationStatus} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Projects</h2>
            <p className="card__hint">Structured problem → approach → result, with evidence.</p>
          </div>
        </div>
        {profile.projects.length === 0 ? (
          <p className="muted">No projects listed yet.</p>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {profile.projects.map((project) => (
              <article
                key={project.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: 14,
                  background: "rgba(10,15,21,.45)",
                }}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 14.5 }}>{project.title}</h3>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="chip">{SCALE_LABEL[project.projectScale]}</span>
                    {project.repoUrl ? <Badge status={project.repoStatus} label={`Repo ${project.repoStatus}`} /> : null}
                    {project.deploymentUrl ? (
                      <Badge status={project.deploymentStatus} label={`Deploy ${project.deploymentStatus}`} />
                    ) : null}
                  </div>
                </div>
                <div className="grid grid--3" style={{ gap: 12, marginTop: 10 }}>
                  <div>
                    <div className="kicker">Problem</div>
                    <p className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.55 }}>
                      {project.problem || "—"}
                    </p>
                  </div>
                  <div>
                    <div className="kicker">Approach</div>
                    <p className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.55 }}>
                      {project.approach || "—"}
                    </p>
                  </div>
                  <div>
                    <div className="kicker">Result</div>
                    <p className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.55 }}>
                      {project.result || "—"}
                    </p>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10, gap: 12, fontSize: 12 }}>
                  {project.repoUrl ? (
                    <a className="link" href={project.repoUrl} target="_blank" rel="noopener noreferrer">
                      Repository ↗
                    </a>
                  ) : null}
                  {project.deploymentUrl ? (
                    <a className="link" href={project.deploymentUrl} target="_blank" rel="noopener noreferrer">
                      Deployment ↗
                    </a>
                  ) : null}
                </div>
                {showNotes ? (
                  <>
                    {project.repoNote ? <p className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>Repo check: {project.repoNote}</p> : null}
                    {project.deploymentNote ? (
                      <p className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>Deployment check: {project.deploymentNote}</p>
                    ) : null}
                  </>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Credentials</h2>
            <p className="card__hint">All credentials are reviewed manually in the MVP.</p>
          </div>
        </div>
        {profile.credentials.length === 0 ? (
          <p className="muted">No credentials listed yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Credential</th>
                  <th>Issuer</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {profile.credentials.map((credential) => (
                  <tr key={credential.id}>
                    <td>
                      <strong>{credential.title}</strong>
                      <div className="faint" style={{ fontSize: 11.5 }}>
                        {credential.type === "degree" ? "Degree" : "Certificate"}
                        {showNotes && credential.failureReason ? ` · ${credential.failureReason}` : ""}
                      </div>
                    </td>
                    <td>{credential.issuer}</td>
                    <td className="mono">{credential.year}</td>
                    <td>
                      <Badge status={credential.verificationStatus} />
                    </td>
                    <td>
                      {credential.evidenceRef ? (
                        <a className="link" href={credential.evidenceRef} target="_blank" rel="noopener noreferrer">
                          Link ↗
                        </a>
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="faint" style={{ fontSize: 11.5 }}>
        Last updated {formatDate(profile.updatedAt)} · Same structured template for every candidate.
      </p>
    </div>
  );
}
