# Hackathon security and data notes

## Controls implemented

- Server-side authentication, role checks and object ownership checks.
- Salted scrypt password hashes. No password values in responses or logs.
- Random session tokens stored as hashes in the database, with seven-day expiry. Logout revokes the server session.
- HttpOnly, SameSite=Lax cookies; Secure cookies in production.
- Same-origin checks for state-changing requests, JSON request size limits and validation, parameterised SQL, database-backed auth/API rate limits shared across serverless instances, Helmet headers and a same-origin Content Security Policy.
- Public sharing disabled by default; owner consent per evidence entry and project; global sharing off switch and revocable URLs.
- Another account must respond to a confirmation; self-confirmation is blocked. Evidence versions invalidate old confirmations. Contacts can decline or withdraw.
- Submitted work and project history are restricted to the selected talent and owning business. Application details are restricted to that applicant and the task owner.
- Report storage and an operator-only review CLI. No claim of real-time moderation.

## Data and trust limits

Account names and emails are user-supplied. Email ownership and real-world identities are not independently verified in this build. Confirmation is a statement by an account holder, not a certified assessment. Do not use real private documents or customer data for judging.

Work evidence is a user-supplied external link. SkillBridge never fetches the URL server-side; users should review links cautiously. Public links can be copied by viewers, so revoking access cannot remove copies already made elsewhere.

Public passports disclose the chosen profile fields, consented entries, confirming contact names/statements and completed project feedback. They do not disclose login emails or private entries. The relevant screens explain this before sharing.

TLS is provided by the deployment host. Production data lives in Supabase PostgreSQL. The private app schema has RLS enabled and is not exposed through Supabase’s Data API. The server connects with a private database credential and enforces application permissions. TLS certificate verification is required for remote database connections. Database exports and backups require private operator access. The deployment owner must monitor reports and manage access to the host. There is no public admin console, email verification, password recovery, payment handling, independent identity verification or formal NQF/RPL assessment.

## Submission architecture

Browser → same-origin Express API in a Vercel Node function → Supabase PostgreSQL transaction pooler → private `skillbridge` schema.

Local development may use SQLite; the deployed API refuses a local-disk fallback. Mutations use serializable PostgreSQL transactions and send success only after commit. Database-backed limits do not depend on any single function instance.

Vercel serves the built frontend; Express handles API requests. Public QR links resolve to a read-only passport route on the same HTTPS origin. There are no third-party AI calls or payment credentials.
