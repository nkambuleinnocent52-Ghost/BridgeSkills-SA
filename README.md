# SkillBridge SA

**Turn what you can do into proof—and your next opportunity.**

A working hackathon web app for South African digital talent and everyday small-business support. Talent records previous experience, requests confirmation from another account, completes business tasks and shares an opt-in QR-linked skills passport.

## Run the complete app

Install **Node.js 24 LTS**. Open a terminal **in the folder containing `package.json`**:

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:3000`. This runs the frontend and API together. Data persists in `data/skillbridge.sqlite`; never commit this directory.

To enable the fictional judge accounts, copy `.env.example` to `.env` and run:

```sh
npm start
```

Use your own accounts for a clean test. In the sign-in dialog, **Judge demo accounts** provides optional fictional accounts when `SEED_DEMO=true`:

| Account | Email | Password |
| --- | --- | --- |
| Talent | talent@skillbridge.demo | TalentDemo!2026 |
| Business | business@skillbridge.demo | BusinessDemo!2026 |
| Contact | reviewer@skillbridge.demo | ReviewerDemo!2026 |

These are public demo credentials, not deployment secrets. Shared demo activity can be changed by other testers. Do not use these accounts for private information. Seed data does not overwrite accounts, reset projects or refresh task deadlines on restart.

## Develop

Start the API and frontend together with one command:

```sh
npm run dev
```

For separate terminals, run `npm run dev:server` and `npm run dev:web` instead.

Vite proxies `/api` to port 3000. View the Vite address for frontend development. For public passport links/QR testing, use the full build on port 3000 or the deployed HTTPS URL; localhost cannot be opened from another phone.

## Deploy for judges

See [DEPLOYMENT.md](docs/DEPLOYMENT.md). The included Render Blueprint creates **one paid service with a persistent disk**. No cloud resource is created by this repository alone.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/nkambuleinnocent52-Ghost/BridgeSkills-SA)

**Do not use ephemeral storage for submission:** accounts and work must survive restarts. Never run multiple app instances with this SQLite setup.

## Test

```sh
npm test
npm run build
```

The automated API tests exercise separate accounts, permissions, evidence confirmation and revisions, consent, link revocation, task selection, submissions, change requests, approval, session revocation, input validation and SQLite persistence. [JUDGE_GUIDE.md](docs/JUDGE_GUIDE.md) gives the self-service browser journey.

## Implementation

- Vite + JavaScript frontend; locally hosted fonts.
- Express API; Node 24's built-in SQLite; schema and migrations initialise on startup.
- Passwords use salted scrypt; opaque sessions are hashed in the database and sent in HttpOnly cookies, Secure in production.
- Role and ownership checks run on the server. Cross-origin mutations are rejected; auth endpoints are rate limited.
- Public passports include only the owner's selected entries, current contact confirmations and consented completed projects. Public sharing is off by default and can be disabled or its link replaced.
- Content edits create evidence revisions and supersede existing confirmations. Contacts can decline or withdraw their statements.
- Opportunity matching uses exact skill names from profiles, experience entries and completed projects; the app explains each match. It is not AI assessment or qualifications verification.

## Scope and operating limits

Work samples are **links** to externally hosted work, photos or videos. There is no file-upload service. Confirmation requests appear in the recipient's account; no email/SMS is sent. There is no email verification or password recovery in this hackathon build. Do not use real sensitive information during judging.

Contact statements and business approval are not independently verified identities or competence assessments. The passport is not a qualification or NQF mapping. Payments, USSD, WhatsApp, accredited assessment and course referrals are outside this build.

Reports are stored, not monitored in real time. The deployment owner reviews them from the service shell:

```sh
npm run reports
npm run reports -- REPORT_ID
```

Only trusted operators should access the service shell or database. See [SECURITY.md](docs/SECURITY.md) for submission notes.
