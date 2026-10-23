# SkillBridge SA

**Turn what you can do into proof—and your next opportunity.**

A hackathon web app for South African digital talent and everyday small-business support. Talent records previous experience, requests confirmation from another account, completes business tasks and shares an opt-in QR-linked skills passport.

## Deploy without a paid disk

**Vercel Hobby + Supabase Free.** No Render service is needed. Read [DEPLOYMENT.md](docs/DEPLOYMENT.md) for the exact steps. Free-plan limits and eligibility apply; keep both services available through judging.

- Vercel serves the frontend and the Express API as a Node function.
- Supabase PostgreSQL stores users, sessions, tasks, evidence and confirmations.
- The database connection string is a **server-only** Vercel environment variable. No database password or Supabase service key is included in the frontend.
- Supabase is used as a database; sign-up and sign-in use this app's existing authentication. No Supabase Auth configuration or client key is needed.

The app must be deployed and checked at its public HTTPS URL before it is ready for judges. Pushing this repository does not deploy it.

## Run locally

Install **Node.js 24 LTS**. Open a terminal in the folder containing `package.json`:

```sh
npm ci
npm run dev
```

The command starts the API and Vite. Open the Vite address. With no `DATABASE_URL`, development uses an ignored local SQLite file. To get fictional sample accounts and tasks, copy `.env.example` to `.env` and restart `npm run dev`.

To test the full production-style frontend locally:

```sh
npm run build
npm start
```

Open `http://localhost:3000`. Localhost links work on your computer, not another phone; QR phone testing needs the deployed HTTPS URL.

To use Supabase locally, place `DATABASE_URL` privately in `.env`, run `npm run db:setup` once and then `npm run dev`. Optional `npm run db:setup -- --demo` seeds fictional judge data. On Vercel, migrations and seeding are **not** run on requests: use Supabase's SQL Editor before deployment as described in the guide.

## Separate workspaces

Young people use **Find work**, **My applications** and **Skills & evidence**. Businesses land on their own **Overview**, post paid tasks in **My tasks**, review candidates in **Applicants** and review deliverables in **Active work**. Both roles can respond to experience requests under **References**. Business users are not shown the talent opportunity feed or a personal passport editor.

## Judge walkthrough

See [JUDGE_GUIDE.md](docs/JUDGE_GUIDE.md). For independent testing, create fresh talent and business accounts in separate browser sessions.

Optional shared demo accounts are available after running `supabase/demo.sql` or the demo setup command:

| Role | Email | Password |
| --- | --- | --- |
| Talent | talent@skillbridge.demo | TalentDemo!2026 |
| Business | business@skillbridge.demo | BusinessDemo!2026 |
| Contact | reviewer@skillbridge.demo | ReviewerDemo!2026 |

These are public fictional accounts, not deployment secrets. Their state can change when other testers use them. Never put private information into shared demo accounts. Seeding does not reset tasks or passwords.

## Validate

```sh
npm test
npm run build
```

For a disposable PostgreSQL database, set `TEST_DATABASE_URL` securely and run:

```sh
npm run test:postgres
```

Tests create and remove their own isolated schemas. Do not use a production database for tests. PostgreSQL tests include two independent serverless instances sharing accounts, sessions and work, plus concurrent task selection. CI runs both local and PostgreSQL suites and builds the frontend.

## Implementation and scope

Vite + JavaScript frontend, Express API, `pg` with the Supabase **transaction pooler on port 6543**. Queries use a private `skillbridge` schema and parameterised values. All tables have RLS enabled and are not exposed through Supabase's Data API. The server connects as the database owner; browser users must go through the app's permission checks.

Passwords use salted scrypt; sessions are hashed in the database and sent in HttpOnly, SameSite cookies, Secure in production. Mutations check the origin and complete their transaction before sending success. Database-backed rate limits work across serverless instances. Concurrent updates either commit consistently or return a conflict for the user to refresh.

Evidence edits create revisions and supersede current confirmations. Contacts can decline or withdraw. Public sharing is off by default; only selected evidence and consented completed projects appear. Skills matching uses exact recorded skill names and explains its results.

Work evidence is a link to externally hosted work, photos or videos. There is no upload service, email/SMS delivery, email verification, password recovery or payment handling in this build. No qualifications or NQF levels are issued. Use fictional information during judging.

Reports are stored, not monitored in real time. The trusted project owner can inspect `skillbridge.reports` in Supabase, or run `npm run reports` privately with the database connection configured. `npm run reports -- REPORT_ID` marks a report reviewed. Never publish database exports or report contents.
