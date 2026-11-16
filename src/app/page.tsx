import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { homeForRole } from "@/lib/auth";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;

  return (
    <main>
      <section className="hero">
        {params.deleted ? (
          <div className="flash flash--success" style={{ marginBottom: 22 }}>
            <span aria-hidden>✓</span>
            <span>Your account and profile data have been deleted.</span>
          </div>
        ) : null}
        <div className="hero-grid">
          <div>
            <span className="hero__eyebrow">
              <span className="hero__dot" />
              One vertical · AI/ML engineers · verified evidence
            </span>
            <h1>
              The index of AI engineers who can <em>actually build</em>.
            </h1>
            <p className="hero__sub">
              Recruiters waste weeks on inflated CVs. AITalented is a dense, searchable index of
              AI/ML engineers whose skills are checked against real repositories, live deployments
              and reviewed credentials. Candidates pay nothing, ever.
            </p>
            <div className="hero__actions">
              {user ? (
                <Link className="btn btn--primary" href={homeForRole(user.role)}>
                  Go to your workspace →
                </Link>
              ) : (
                <>
                  <Link className="btn btn--primary" href="/login?next=%2Frecruiter">
                    I&apos;m hiring — search the index
                  </Link>
                  <Link className="btn" href="/signup">
                    Build a verified profile
                  </Link>
                </>
              )}
            </div>
            <div className="hero__stats">
              <div className="stat">
                <div className="stat__label">Evidence first</div>
                <div className="stat__value">3</div>
                <div className="stat__hint">repo · deployment · credential</div>
              </div>
              <div className="stat">
                <div className="stat__label">Async checks</div>
                <div className="stat__value">&lt;5m</div>
                <div className="stat__hint">never blocks a candidate</div>
              </div>
              <div className="stat">
                <div className="stat__label">Pilot price</div>
                <div className="stat__value">$199</div>
                <div className="stat__hint">per seat / month</div>
              </div>
            </div>
          </div>

          <aside className="showcase" aria-label="Sample verified candidate card">
            <div className="showcase__top">
              <span>Candidate card</span>
              <span>Ranked #1</span>
            </div>
            <div className="cand__name">
              Léa Moreau
              <span className="badge badge--verified">4 verified</span>
            </div>
            <p className="cand__headline">
              ML engineer — retrieval &amp; evaluation. Ships RAG systems that survive production.
            </p>
            <div className="cand__meta">
              <span>Mid (3–4 yrs)</span>
              <span>Paris</span>
              <span>Deployment verified</span>
            </div>
            <div className="cand__skills" style={{ marginTop: 12 }}>
              <span className="badge badge--verified">PyTorch</span>
              <span className="badge badge--verified">RAG</span>
              <span className="badge badge--verified">vLLM</span>
              <span className="badge badge--verified">Kubernetes</span>
            </div>
            <div className="divider" />
            <div className="sample-skill">
              <span>pytorch</span>
              <span className="badge badge--verified">Verified · repo</span>
            </div>
            <div className="sample-skill">
              <span>deployment health</span>
              <span className="badge badge--verified">Verified · HTTP 200</span>
            </div>
            <div className="sample-skill">
              <span>MSc Machine Learning</span>
              <span className="badge badge--verified">Verified · manual</span>
            </div>
            <p className="faint" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
              Same template for every candidate. No free-form HTML, no keyword stuffing.
            </p>
          </aside>
        </div>
      </section>

      <section className="landing-section">
        <div className="kicker">How it works</div>
        <h2>Verification is the product.</h2>
        <p>
          Every claim is queued to an async verifier the moment it is submitted. Profiles appear
          immediately with pending badges — evidence resolves in minutes, never blocks the
          candidate.
        </p>
        <div className="grid grid--3" style={{ marginTop: 26 }}>
          <div className="step">
            <div className="step__num">01 — GitHub</div>
            <h3>Repo exists, and the stack matches</h3>
            <p>
              Public repo, non-empty history, language and dependency markers checked against the
              claimed framework. Labelled “repo-exists” — authorship is not verified in the MVP.
            </p>
          </div>
          <div className="step">
            <div className="step__num">02 — Deployment</div>
            <h3>It runs where they say it runs</h3>
            <p>
              HTTP 200 within 10 seconds, valid TLS, private addresses blocked. Model inference is
              never probed — cost, abuse and fragility are not worth it.
            </p>
          </div>
          <div className="step">
            <div className="step__num">03 — Credentials</div>
            <h3>Reviewed by a human</h3>
            <p>
              Degrees and certificates route to a manual queue with evidence links. Deliberately
              manual in the MVP; automated when volume justifies it.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="grid grid--2">
          <div className="card">
            <div className="kicker">For recruiters</div>
            <h2 style={{ fontSize: 24, marginTop: 8, marginBottom: 10 }}>
              Answer “can they do ML work?” in two minutes.
            </h2>
            <ul className="muted" style={{ fontSize: 13.5, lineHeight: 1.85, paddingLeft: 18, margin: 0 }}>
              <li>Filter by model type, framework, verified deployment and project scale.</li>
              <li>Verified-only and has-verified modes; unverified profiles rank below.</li>
              <li>One structured profile template — comparable candidates, not portfolios.</li>
              <li>Express interest with a 280-character note; contact is shared only on accept.</li>
              <li>Invite-only pilot, 14-day trial, $199 per seat thereafter.</li>
            </ul>
            <div className="actions" style={{ marginTop: 18 }}>
              <Link className="btn btn--primary btn--sm" href="/login?next=%2Frecruiter">
                Recruiter login
              </Link>
              <span className="faint" style={{ fontSize: 11.5 }}>
                Accounts are provisioned by the AITalented team during the pilot.
              </span>
            </div>
          </div>
          <div className="card">
            <div className="kicker">For candidates</div>
            <h2 style={{ fontSize: 24, marginTop: 8, marginBottom: 10 }}>
              A portfolio that proves it, not a profile that claims it.
            </h2>
            <ul className="muted" style={{ fontSize: 13.5, lineHeight: 1.85, paddingLeft: 18, margin: 0 }}>
              <li>Fixed, opinionated fields — 10 minutes, no design work.</li>
              <li>Attach a repo or deployment and the badge resolves automatically.</li>
              <li>See exactly how recruiters see you, and what failed verification and why.</li>
              <li>Stay hidden while you build; become visible when you are ready.</li>
              <li>Free forever. No candidate monetisation.</li>
            </ul>
            <div className="actions" style={{ marginTop: 18 }}>
              <Link className="btn btn--primary btn--sm" href="/signup">
                Create your profile
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>AITalented — verified AI/ML engineer talent index (MVP).</span>
        <span>No messaging. No job board. No ATS. One vertical.</span>
      </footer>
    </main>
  );
}
