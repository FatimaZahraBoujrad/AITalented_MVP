# AITalented — Verified AI/ML Engineer Talent Index (MVP)

A recruiter-side paid pilot with a free, structured, evidence-verified candidate portfolio.
One vertical (AI/ML engineers), one question: *can this person actually do ML work, and can I
trust it?*

Built to the requirements book v1.0 — see the decisions and explicit exclusions at the bottom.

## Surfaces

| Surface | Route | What it does |
| --- | --- | --- |
| Public | `/` | Thesis, verification explainer, demo credentials |
| Candidate | `/candidate` | Completeness, verification activity, visibility, inbox |
| Candidate builder | `/candidate/profile` | Basics, skills (controlled vocabulary), projects, credentials, evidence resubmission |
| Candidate preview | `/candidate/preview` | Exact recruiter-view render of the same template |
| Recruiter | `/recruiter` | 9 combinable ML filters, ranked results, saved search + digest |
| Recruiter detail | `/recruiter/candidates/[id]` | Structured portfolio, skill matrix, express interest, shortlist |
| Shortlists | `/recruiter/shortlists` | Named lists + CSV export (contact only where accepted) |
| Outreach | `/recruiter/outreach` | Interest request states, expiry |
| Billing | `/recruiter/billing` | 14-day trial, Stripe Checkout / Portal (optional keys) |
| Admin | `/admin` | G1–G4 pilot metrics, queue depth |
| Admin ops | `/admin/verification`, `/admin/taxonomy`, `/admin/recruiters`, `/admin/invites`, `/admin/audit`, `/admin/outbox` | Manual review, vocabulary CRUD, recruiter provisioning, bulk CSV invites, audit trail, captured email |

## Stack

- **Next.js 15** (App Router, React 19, server components + server actions) — one origin, no CORS.
- **Postgres 16 + Prisma 6** — single database at MVP scale; GIN FTS indexes created by the seed.
- **Postgres-backed verification worker** (`src/worker/main.ts`) using `SKIP LOCKED` claims,
  3 attempts with exponential backoff, idempotent transitions.
- **bcryptjs** password hashing, DB-backed httpOnly session cookies.
- Plain CSS design system (`src/app/globals.css`) — no UI framework dependency.

## Run

The sandbox environment lives outside the repo (`docker-compose.base44.yml` in the Base44
environment config). It runs the cloned source with `next dev` on port 3000, Postgres, a one-shot
install/migrate/seed service, and the verifier worker.

Locally with Node 20+ and a Postgres URL:

```bash
npm install
npx prisma generate
npx prisma db push
npm run seed        # taxonomy, admin, demo recruiter + candidates
npm run dev         # http://localhost:3000
npm run worker      # in a second terminal: verification queue + digests
```

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Recruiter | `recruiter@aitalented.dev` | `recruiter123` |
| Candidate | `candidate@aitalented.dev` | `candidate123` |
| Admin | `admin@aitalented.dev` | `admin12345` |

Admin credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD` at seed time. Change them before any
real pilot. Seed data is idempotent: it only fills portfolios that are still empty.

## Verification pipeline

Always async: a submission marks the claim `pending`, renders immediately, and enqueues a job.

- **GitHub verifier** — parses `owner/repo`, requires a public repo with commits, then checks the
  repo's languages and root dependency manifests (`requirements.txt`, `pyproject.toml`,
  `package.json`, `environment.yml`, `Dockerfile`) for the claimed framework marker. Evidence is
  stored on the claim/project. Authorship is deliberately **not** verified in the MVP — the UI says
  "repo-exists".
- **Deployment verifier** — GET probe, HTTP 2xx within 10s, valid TLS. Private/loopback/link-local
  addresses are rejected after DNS resolution, each redirect hop is re-validated, credentials in
  URLs and common non-web ports are blocked. No inference endpoints are ever called.
- **Credential verifier** — every degree/cert routes to `manual_review`; an admin approves or
  rejects with a reason the candidate sees.
- **State machine** — `unverified → pending → verified | failed | manual_review → verified/failed`;
  `failed → pending` only on resubmission. Enforced in `src/lib/verification/state.ts`.

Optional `GITHUB_TOKEN` lifts the anonymous API rate limit (60 req/h). Set it as a Base44 secret;
the worker and web services read it from `/run/base44/app.env`.

## Search & ranking

Filters: model type, framework, verified deployment, data-engineering exposure, minimum project
scale, seniority, years range, verification mode (all / has ≥1 verified / verified-only), and
full-text search over headline + project title/result.

Only visible profiles with a verified email, at least one skill and one project are indexed.
Hidden profiles never appear in search, digests or exports.

Ranking is deliberately dumb and documented (`src/lib/search.ts`):

```
score = 3.0 · min(verifiedSkills, 8)
      + 2.0 · projectDepth        (toy 1 · coursework 2 · production 3 · oss 4)
      + 1.5 · hasVerifiedDeployment
      + 1.0 · completeness / 100
      + 0.5 · exp(-daysSinceUpdate / 60)
```

Weights are env-configurable: `RANK_W_VERIFIED_SKILLS`, `RANK_W_PROJECT_DEPTH`,
`RANK_W_DEPLOYMENT`, `RANK_W_COMPLETENESS`, `RANK_W_RECENCY`, `RANK_RECENCY_HALF_LIFE_DAYS`.

## Billing, email, and deliberate MVP limits

- **Stripe** is wired for Checkout, Customer Portal and idempotent webhooks, but optional at boot:
  without `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` the trial works and the
  billing page states that payment cannot be taken. Platform fee is $199/seat/month.
- **Email delivery is an outbox**, not SMTP. Every verification link, invite, interest notice and
  weekly digest is rendered and stored in Admin → Outbox (with working links). Connect a provider to
  deliver them; nothing else needs to change.
- No job board, no chat, no ATS, no multi-vertical, no free-form HTML/CSS, no mobile app, no AI
  matching, no candidate monetisation — all explicit MVP exclusions.

## Security & privacy

- Role-gated server-side in layouts **and** every server action; anonymous API routes return 401.
- Login rate-limited (10 failures / 15 minutes / email). bcrypt hashes; no secrets logged.
- Candidate contact email is returned only when an accepted InterestRequest exists for that
  recruiter; the public preview shows no contact email.
- Hidden profiles are filtered in SQL, not in the UI; the detail page returns 404 for them.
- GDPR: JSON export at `/api/candidate/export`, hard delete from candidate settings, consent
  checkbox at signup, audit log for every verification/admin decision.

## Notes / known MVP gaps

- Column-level encryption of contact email is not implemented; risk accepted and documented here.
- Structured logging is JSON to stdout for the worker; no Sentry/queue-depth alerting beyond the
  admin metric.
- GitHub verification is manifest/language heuristics, not code understanding; some legitimate
  repos (e.g. Go-only projects) fail a skill claim and must be resubmitted or manually decided.
- Weekly digest scheduling is self-healing but delivered to the outbox, not a mail provider.
