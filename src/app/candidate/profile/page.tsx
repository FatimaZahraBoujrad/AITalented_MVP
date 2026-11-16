import Link from "next/link";
import type { SkillCategory } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_LABEL, SCALE_LABEL, SENIORITY_LABEL, formatDate } from "@/lib/labels";
import {
  addCredentialAction,
  addProjectAction,
  addSkillAction,
  deleteProjectAction,
  removeSkillAction,
  resubmitCredentialAction,
  resubmitSkillAction,
  saveBasicsAction,
} from "@/app/actions/candidate";
import { Badge, Flash, PageHeader } from "@/components/ui";

const CATEGORY_ORDER: SkillCategory[] = ["model_type", "framework", "deployment", "data", "other"];

export default async function ProfileBuilder({
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

  const taxonomy = await db.skillTaxonomy.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const taxonomyByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    skills: taxonomy.filter((t) => t.category === category),
  })).filter((group) => group.skills.length > 0);

  const claimedNames = new Set(profile.skills.map((s) => s.skillName));
  const available = taxonomy.filter((t) => !claimedNames.has(t.name));

  return (
    <div className="shell">
      <PageHeader
        kicker="Profile builder"
        title="Your verified portfolio"
        sub="Structured fields only — no free-form HTML or CSS. Attach evidence to a claim and it becomes pending, then verified or failed with a reason."
      >
        <Link className="btn" href="/candidate/preview">
          Preview
        </Link>
        <Link className="btn btn--ghost" href="/candidate">
          Dashboard
        </Link>
      </PageHeader>

      <Flash error={params.error} success={params.success} />

      <div className="split">
        <div className="stack">
          <section className="card" id="basics">
            <div className="card__head">
              <div>
                <h2 className="card__title">Basics</h2>
                <p className="card__hint">Headline is capped at 120 characters so cards stay comparable.</p>
              </div>
              <span className="chip">{profile.completenessScore}% complete</span>
            </div>
            <form action={saveBasicsAction} className="stack" style={{ gap: 14 }}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="fullName">Full name</label>
                  <input id="fullName" className="input" name="fullName" defaultValue={profile.fullName} required />
                </div>
                <div className="field">
                  <label htmlFor="headline">Headline</label>
                  <input
                    id="headline"
                    className="input"
                    name="headline"
                    maxLength={120}
                    defaultValue={profile.headline}
                    placeholder="ML engineer — retrieval & evaluation"
                  />
                  <span className="hint">Max 120 characters.</span>
                </div>
                <div className="field">
                  <label htmlFor="location">Location</label>
                  <input id="location" className="input" name="location" defaultValue={profile.location} placeholder="Paris, FR" />
                </div>
                <div className="field">
                  <label htmlFor="yearsExperience">Years of experience</label>
                  <input
                    id="yearsExperience"
                    className="input"
                    type="number"
                    name="yearsExperience"
                    min={0}
                    max={40}
                    defaultValue={profile.yearsExperience}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="seniorityBand">Seniority band</label>
                  <select id="seniorityBand" className="input" name="seniorityBand" defaultValue={profile.seniorityBand}>
                    <option value="junior">{SENIORITY_LABEL.junior}</option>
                    <option value="mid">{SENIORITY_LABEL.mid}</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="currentStatus">Current status</label>
                  <select id="currentStatus" className="input" name="currentStatus" defaultValue={profile.currentStatus}>
                    <option value="open">Open to work</option>
                    <option value="employed">Employed</option>
                    <option value="not_looking">Not looking</option>
                  </select>
                </div>
                <div className="field field--full">
                  <label htmlFor="contactEmailPublic">Public contact email (optional)</label>
                  <input
                    id="contactEmailPublic"
                    className="input"
                    type="email"
                    name="contactEmailPublic"
                    defaultValue={profile.contactEmailPublic ?? ""}
                    placeholder="you@example.com"
                  />
                  <span className="hint">
                    Revealed only to a recruiter whose interest request you accept.
                  </span>
                </div>
              </div>
              <div className="row">
                <button className="btn btn--primary" type="submit">
                  Save basics
                </button>
              </div>
            </form>
          </section>

          <section className="card" id="skills">
            <div className="card__head">
              <div>
                <h2 className="card__title">Skills</h2>
                <p className="card__hint">
                  Controlled vocabulary only. Attach a GitHub repo (marker scan) or a deployment URL
                  (HTTP probe) to verify.
                </p>
              </div>
              <span className="chip">{profile.skills.length} claimed</span>
            </div>

            {profile.skills.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No skills yet.</p>
            ) : (
              <div className="stack" style={{ gap: 16 }}>
                {CATEGORY_ORDER.map((category) => {
                  const skills = profile.skills.filter((s) => s.skillCategory === category);
                  if (skills.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="kicker" style={{ marginBottom: 8 }}>{CATEGORY_LABEL[category]}</div>
                      <div className="stack" style={{ gap: 10 }}>
                        {skills.map((skill) => (
                          <div
                            key={skill.id}
                            style={{
                              border: "1px solid var(--line)",
                              borderRadius: 10,
                              padding: "11px 12px",
                              background: "rgba(10,15,21,.4)",
                            }}
                          >
                            <div className="row" style={{ justifyContent: "space-between" }}>
                              <div className="row">
                                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{skill.skillName}</span>
                                <Badge status={skill.verificationStatus} />
                                {skill.evidenceRef ? (
                                  <a className="link" style={{ fontSize: 11.5 }} href={skill.evidenceRef} target="_blank" rel="noopener noreferrer">
                                    evidence ↗
                                  </a>
                                ) : (
                                  <span className="faint" style={{ fontSize: 11.5 }}>self-reported</span>
                                )}
                              </div>
                              <form action={removeSkillAction}>
                                <input type="hidden" name="skillId" value={skill.id} />
                                <button className="btn btn--ghost btn--sm" type="submit">
                                  Remove
                                </button>
                              </form>
                            </div>
                            {skill.failureReason ? (
                              <p className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                                {skill.failureReason}
                              </p>
                            ) : null}
                            {["failed", "unverified", "pending"].includes(skill.verificationStatus) ? (
                              <form action={resubmitSkillAction} className="row" style={{ marginTop: 8, gap: 8 }}>
                                <input type="hidden" name="skillId" value={skill.id} />
                                <input
                                  className="input"
                                  style={{ flex: 1, minWidth: 200 }}
                                  name="evidenceRef"
                                  placeholder="https://github.com/… or https://your-app…"
                                  defaultValue={skill.evidenceRef ?? ""}
                                  aria-label={`Evidence for ${skill.skillName}`}
                                />
                                <button className="btn btn--sm" type="submit">
                                  {skill.verificationStatus === "failed" ? "Resubmit" : "Verify"}
                                </button>
                              </form>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="divider" />
            {available.length === 0 ? (
              <p className="form-note">Every active vocabulary skill is already claimed.</p>
            ) : (
              <form action={addSkillAction} className="stack" style={{ gap: 10 }}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="taxonomyId">Add a skill</label>
                    <select id="taxonomyId" className="input" name="taxonomyId" required>
                      <option value="">Choose from the vocabulary…</option>
                      {taxonomyByCategory.map((group) => (
                        <optgroup key={group.category} label={CATEGORY_LABEL[group.category]}>
                          {group.skills
                            .filter((t) => !claimedNames.has(t.name))
                            .map((skill) => (
                              <option key={skill.id} value={skill.id}>
                                {skill.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="evidenceRef">Evidence URL (optional)</label>
                    <input id="evidenceRef" className="input" name="evidenceRef" placeholder="https://github.com/you/project" />
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn--primary" type="submit">
                    Add skill
                  </button>
                  <span className="form-note">Without evidence the claim stays self-reported.</span>
                </div>
              </form>
            )}
          </section>

          <section className="card" id="projects">
            <div className="card__head">
              <div>
                <h2 className="card__title">Projects</h2>
                <p className="card__hint">1–5 projects. Problem, approach, result — the recruiter card shows one line.</p>
              </div>
              <span className="chip">{profile.projects.length}/5</span>
            </div>

            {profile.projects.length > 0 ? (
              <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
                {profile.projects.map((project) => (
                  <div
                    key={project.id}
                    style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "12px 13px", background: "rgba(10,15,21,.4)" }}
                  >
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div className="row">
                        <strong style={{ fontSize: 13.5 }}>{project.title}</strong>
                        <span className="chip">{SCALE_LABEL[project.projectScale]}</span>
                        {project.repoUrl ? <Badge status={project.repoStatus} label={`Repo ${project.repoStatus}`} /> : null}
                        {project.deploymentUrl ? <Badge status={project.deploymentStatus} label={`Deploy ${project.deploymentStatus}`} /> : null}
                      </div>
                      <form action={deleteProjectAction}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <button className="btn btn--ghost btn--sm" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                    <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                      {project.result || project.problem || "No summary yet."}
                    </p>
                    {project.repoNote ? <p className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>Repo: {project.repoNote}</p> : null}
                    {project.deploymentNote ? (
                      <p className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>Deployment: {project.deploymentNote}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {profile.projects.length < 5 ? (
              <form action={addProjectAction} className="stack" style={{ gap: 12 }}>
                <div className="form-grid">
                  <div className="field field--full">
                    <label htmlFor="title">Project title</label>
                    <input id="title" className="input" name="title" required maxLength={120} />
                  </div>
                  <div className="field">
                    <label htmlFor="problem">Problem</label>
                    <textarea id="problem" name="problem" maxLength={1200} placeholder="What was broken or missing?" />
                  </div>
                  <div className="field">
                    <label htmlFor="approach">Approach</label>
                    <textarea id="approach" name="approach" maxLength={1200} placeholder="What did you build and why?" />
                  </div>
                  <div className="field field--full">
                    <label htmlFor="result">Result (one line for the card)</label>
                    <input id="result" className="input" name="result" maxLength={600} placeholder="Cut p95 latency 4x with INT8 quantisation" />
                  </div>
                  <div className="field">
                    <label htmlFor="repoUrl">Repo URL (optional)</label>
                    <input id="repoUrl" className="input" name="repoUrl" placeholder="https://github.com/you/project" />
                  </div>
                  <div className="field">
                    <label htmlFor="deploymentUrl">Deployment URL (optional)</label>
                    <input id="deploymentUrl" className="input" name="deploymentUrl" placeholder="https://your-app.example.com" />
                  </div>
                  <div className="field">
                    <label htmlFor="projectScale">Project scale</label>
                    <select id="projectScale" className="input" name="projectScale" defaultValue="coursework">
                      <option value="toy">Toy</option>
                      <option value="coursework">Coursework</option>
                      <option value="production">Production</option>
                      <option value="oss">Open source</option>
                    </select>
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn--primary" type="submit">
                    Add project
                  </button>
                  <span className="form-note">Repo and deployment URLs queue async verification automatically.</span>
                </div>
              </form>
            ) : (
              <p className="form-note">Maximum of 5 projects reached.</p>
            )}
          </section>

          <section className="card" id="credentials">
            <div className="card__head">
              <div>
                <h2 className="card__title">Credentials</h2>
                <p className="card__hint">Degrees and certificates are reviewed manually in the MVP.</p>
              </div>
            </div>

            {profile.credentials.length > 0 ? (
              <div className="table-wrap" style={{ marginBottom: 16 }}>
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
                            {credential.type === "degree" ? "Degree" : "Certificate"} · added {formatDate(credential.createdAt)}
                          </div>
                          {credential.failureReason ? (
                            <div className="faint" style={{ fontSize: 11.5, marginTop: 3 }}>{credential.failureReason}</div>
                          ) : null}
                        </td>
                        <td>{credential.issuer}</td>
                        <td className="mono">{credential.year}</td>
                        <td><Badge status={credential.verificationStatus} /></td>
                        <td>
                          {credential.evidenceRef ? (
                            <a className="link" href={credential.evidenceRef} target="_blank" rel="noopener noreferrer">Link ↗</a>
                          ) : (
                            <span className="faint">—</span>
                          )}
                          {credential.verificationStatus !== "verified" ? (
                            <form action={resubmitCredentialAction} className="row" style={{ marginTop: 6, gap: 6 }}>
                              <input type="hidden" name="credentialId" value={credential.id} />
                              <input className="input" style={{ width: 170 }} name="evidenceRef" placeholder="Evidence link" />
                              <button className="btn btn--sm" type="submit">Resubmit</button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <form action={addCredentialAction} className="stack" style={{ gap: 12 }}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="type">Type</label>
                  <select id="type" className="input" name="type" defaultValue="degree">
                    <option value="degree">Degree</option>
                    <option value="cert">Certificate</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="issuer">Issuer</label>
                  <input id="issuer" className="input" name="issuer" required placeholder="ETH Zürich" />
                </div>
                <div className="field">
                  <label htmlFor="credentialTitle">Title</label>
                  <input id="credentialTitle" className="input" name="title" required placeholder="MSc Machine Learning" />
                </div>
                <div className="field">
                  <label htmlFor="year">Year</label>
                  <input id="year" className="input" type="number" name="year" min={1950} max={new Date().getFullYear() + 1} required defaultValue={new Date().getFullYear()} />
                </div>
                <div className="field field--full">
                  <label htmlFor="credentialEvidence">Evidence link (optional)</label>
                  <input id="credentialEvidence" className="input" name="evidenceRef" placeholder="Registrar page, certificate URL, reference" />
                </div>
              </div>
              <div className="row">
                <button className="btn" type="submit">
                  Add credential for review
                </button>
                <span className="form-note">Appears as “Manual review” until an admin decides.</span>
              </div>
            </form>
          </section>
        </div>

        <aside className="stack">
          <section className="card">
            <h2 className="card__title">How verification resolves</h2>
            <div className="stack" style={{ gap: 10, marginTop: 10, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
              <p><strong style={{ color: "var(--ink)" }}>Repo:</strong> public repo exists, has commits, and the language or dependency manifests support the claimed skill.</p>
              <p><strong style={{ color: "var(--ink)" }}>Deployment:</strong> HTTP 2xx within 10s, valid TLS, private addresses blocked. Inference endpoints are never called.</p>
              <p><strong style={{ color: "var(--ink)" }}>Credential:</strong> manual review with evidence. Approval or rejection always carries a reason.</p>
              <p className="faint">Failed checks can be resubmitted with new evidence; the same evidence yields the same result (idempotent).</p>
            </div>
          </section>
          <section className="card">
            <h2 className="card__title">Visibility</h2>
            <p className="card__hint" style={{ marginBottom: 10 }}>
              Currently {profile.visible ? "visible to recruiters" : "hidden"}.
            </p>
            <Link className="btn btn--wide" href="/candidate">
              Manage on dashboard
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
