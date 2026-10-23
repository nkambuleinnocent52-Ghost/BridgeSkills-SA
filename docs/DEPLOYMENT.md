# Free hackathon deployment: Vercel + Supabase

Use Vercel **Hobby** and Supabase **Free**. There is no paid disk or Render service. Review each provider's current free-plan limits and eligibility; do not select a paid upgrade. This deployment uses Supabase PostgreSQL, not Supabase Auth.

## 1. Create the database

1. At https://supabase.com/dashboard create a **Free** project. Save its database password privately.
2. Wait until the database is ready. Open **SQL Editor → New query**.
3. Paste the full contents of [`supabase/schema.sql`](../supabase/schema.sql) and run it. It creates the private `skillbridge` schema, tables, indexes and RLS settings. Running it again does not clear user data.
4. Optional but recommended for judging: run [`supabase/demo.sql`](../supabase/demo.sql) as a second query. It adds three fictional demo accounts and sample tasks. It does not reset existing work. The accounts are listed in the judge guide.
5. Open **Connect**. Choose **URI → Transaction pooler** and copy the PostgreSQL connection URL using port **6543**. Keep the exact pooler hostname and `postgres.PROJECT_REF` user shown there. Replace the password placeholder with the project's database password. If it contains URL-reserved characters, URL-encode the password portion only.

Keep that connection URL private: it includes the database password. Do not paste it into chat, slides, source files or a frontend variable. No `VITE_SUPABASE_*` key is needed.

Do not expose the `skillbridge` schema through the Supabase Data API. Keep the RLS settings from the migration. App accounts are in `skillbridge.users`; they will not appear in Supabase Authentication's user list.

## 2. Deploy the app

1. At https://vercel.com/new use your personal **Hobby** account and import `nkambuleinnocent52-Ghost/BridgeSkills-SA`.
2. Select **main**. Framework: **Vite**. Root directory: leave at the repository root (where `package.json` is). Build: `npm run build`. Output: `dist`. Node.js: **24.x**.
3. Under **Environment Variables**, add `DATABASE_URL` with the private transaction-pooler URL from step 1. Enable it for **Production**. Do not prefix it with `VITE_`.
4. Deploy. `vercel.json` routes `/api/*` to the Node function and public passport links to the frontend. The API never stores production data on Vercel's local filesystem.
5. Open the **production** `.vercel.app` URL from the project dashboard. Use that stable link in the submission, not a protected preview URL.

The API uses `VERCEL_PROJECT_PRODUCTION_URL` for the canonical HTTPS origin and QR links. If your project does not expose that system variable, or if you add a custom domain, set `APP_BASE_URL` to your exact public HTTPS origin (for example `https://your-project.vercel.app`) and redeploy. Do not append a path or include a trailing slash.

Preview deployments do not receive the Production database variable by default. Configure a separate test database if you need functional previews; use the stable Production URL for judging.

## 3. Check the actual hosted app

- Open `/api/health` on the production URL. It should show `status: "ok"` and `storage: "postgres"`.
- Check the production link in a private browser. In Vercel's deployment-protection settings, ensure judges can open **Production** without signing into Vercel. No Vercel password or account should be required.
- Create fresh talent and business accounts in separate browser sessions.
- Complete the [judge walkthrough](JUDGE_GUIDE.md): confirm an experience, post/apply/select, submit/review, publish a passport.
- Open the passport anonymously, scan its QR on a phone, then revoke sharing and verify the old link stops working.
- Redeploy the same commit once. Confirm the same accounts and work remain. PostgreSQL is external to Vercel and must retain the data.
- Add the production URL and demo-account details to the submission slides. Check Supabase has not paused the project before judging.

A local test pass is not proof that the deployed hostname, TLS trust, environment variables or database connection work. Complete these checks before calling the submission ready.

## Troubleshooting

**Database not configured / 503:** add the `DATABASE_URL` Production environment variable in Vercel and redeploy. The server deliberately refuses an SQLite fallback on Vercel.

**Missing tables / 500:** run `supabase/schema.sql` in the correct project's SQL Editor. The health check reads the actual app schema, not just an open socket.

**Connection failed:** use the Connect dialog's transaction pooler URI on port 6543, including its project-qualified username. The direct host can be IPv6-only; the pooler avoids needing a paid dedicated IPv4 address. Verify the password and project status without sharing credentials.

**Certificate error:** keep TLS verification enabled. Download the database's root certificate from the official Supabase project settings and set `DATABASE_CA_CERT` in Vercel to its complete PEM contents, then redeploy. The variable accepts actual newlines or literal `\n`. Do not set `rejectUnauthorized=false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, or use URL SSL options to bypass verification.

**Origin rejected / login does not persist:** access the exact production HTTPS hostname. Check `APP_BASE_URL` if set. Changing environment variables requires redeployment. Do not disable Secure cookies or origin checks.

**A sample task has already been assigned:** create a fresh task with a business account. Shared demo accounts can be used by multiple judges and their state is not reset automatically.

## Configuration reference

| Variable | Where | Required? |
| --- | --- | --- |
| DATABASE_URL | Vercel server environment | Yes: Supabase transaction-pooler URI |
| APP_BASE_URL | Vercel server environment | Only if automatic production hostname is unavailable or a custom domain is used |
| DATABASE_CA_CERT | Vercel server environment | Only if the database uses a CA not present in the runtime trust store |

No frontend keys, payment credentials, persistent disk or background worker is required. Keep database and hosting log access restricted to the team. Free-plan availability and limits can change; verify the provider dashboard before submission.
