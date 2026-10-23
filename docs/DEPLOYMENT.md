# Deploy for independent judging

## Recommended: one Render service with a persistent disk

The repository includes a `render.yaml` Blueprint. Its `starter` service and disk are **paid resources**. Review Render's current price before confirming creation. A free service without a persistent database does not meet this app's storage requirements.

1. Open https://render.com/deploy?repo=https://github.com/nkambuleinnocent52-Ghost/BridgeSkills-SA and sign in to Render.
2. Connect this GitHub repository if prompted. Select `main`, review the Blueprint, service plan and disk, then create the service if you approve the cost.
3. The build runs `npm ci --include=dev`, the API tests and the frontend build. The app starts with `npm start` and is checked at `/api/health`.
4. Wait for Render to mark the service live. Copy the assigned **HTTPS** URL.
5. Open it in a private browser window. Follow the judge guide using newly registered accounts. Test a public passport link in a signed-out window and its QR on a phone.
6. Restart the service once from Render. Confirm the same accounts can sign in and their evidence/projects still exist. This verifies the disk is attached correctly.
7. Put the live URL and demo account details into the submission slides. Keep the service active through judging.

Render supplies `RENDER_EXTERNAL_URL` automatically. The server uses it for HTTPS public links, QR codes and origin checks. If using a custom domain, set `APP_BASE_URL=https://your-domain` to that one canonical origin and access the app there. Do not include a path or trailing slash. After changing the hostname, generate fresh QR codes from the passport screen.

## Environment settings

| Variable | Blueprint value | Purpose |
| --- | --- | --- |
| NODE_VERSION | 24 | Required Node runtime with built-in SQLite |
| NODE_ENV | production | Secure cookies and production headers |
| DATABASE_PATH | /var/data/skillbridge.sqlite | Database on the persistent disk |
| SEED_DEMO | true | Fictional demo accounts and initial sample tasks |
| APP_BASE_URL | optional | Canonical HTTPS URL; falls back to Render's URL |
| PORT | supplied by host | HTTP listener port |

The disk mount is `/var/data`, 1 GB, and the service uses one instance. Do not move the database into the source/build directory. Builds and GitHub pushes do not contain or restore user data.

## Before submitting

- A brand-new talent and business can register, then log out and back in.
- A confirmation can be requested and answered from a different account.
- A business can post a fresh task; talent can apply and submit work; the business can approve it.
- The completed project appears on the talent's passport.
- A signed-out browser can see consented passport entries, but not private ones.
- Disabling sharing or replacing the link revokes the former public URL.
- A phone scanning the QR reaches the same public passport.
- The database survives a service restart.
- The team knows how to review reports. `npm run reports` runs in the deployed service shell.

The implementation has been tested locally. A successful local build does not establish that your hosted URL, HTTPS configuration or disk works; complete these checks on the actual deployment.

## Backups and recovery

Use Render's persistent-disk snapshot/restore controls and verify their availability on your selected plan. Before judging, also take an operator-controlled SQLite backup using SQLite's online backup facility if available in your service tooling. Do not copy only the live `.sqlite` file while writes are active: SQLite may have a WAL containing committed data. Keep any database backup private.

If startup fails, inspect the service logs without exposing account data. The server deliberately refuses production startup without a canonical HTTPS URL. If registration succeeds but sign-in does not persist, check that users access HTTPS and the same canonical host. Never disable secure cookies or origin checks to make deployment pass.
