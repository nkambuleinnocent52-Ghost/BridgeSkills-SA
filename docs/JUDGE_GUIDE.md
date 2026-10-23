# SkillBridge SA — judge walkthrough

Use the submitted live HTTPS URL. No local installation is required. The app supports talent and business accounts. Contact confirmation can be performed by either role.

**For a fresh independent test, create your own accounts.** Use separate browser profiles or a normal and a private window so both roles can stay signed in. Use fictional details and passwords you do not use elsewhere.

## 1. Record experience and confirm it

1. Register a **talent** account. Save a profile with skills such as `Excel`, `Stock capture` and `Customer service`.
2. Open **Skills & evidence → Add experience**. Describe previous work. Add an optional public work-sample link. Choose whether this entry may be shared publicly.
3. In a separate browser session, register a **business** account to act as the contact. A contact can also use a talent account.
4. In the talent session, select **Request confirmation** and enter the contact account's exact sign-in email.
5. In the contact session, open **References**, refresh if needed, review the entry and record a relationship and statement. Confirm only what you know, or decline it.
6. Refresh the talent's Skills & evidence. It now names the confirming contact and shows their statement and response time. Content edits create a new version and require a fresh confirmation.

No email is sent. The request is delivered inside the recipient's account.

## 2. Complete a business task

1. In the business account, open **My tasks → Post a paid task**. Create a new task with a clear brief, budget and future deadline. Use `Excel` and `Stock capture` as required skills.
2. In the talent account, open **Opportunities**. Matching tasks explain which recorded skills match. Search for the new task and apply.
3. In the business account, open **Applicants**, review the application and select the applicant.
4. In the talent account, open **My applications**, view the assigned task and submit a work link and summary. Choose whether the completed work may appear publicly.
5. In the business account, open **Active work** and review the submission. Request changes with feedback or approve it. If changes are requested, talent can resubmit.
6. After approval, the project appears in the talent's **Skills & evidence**, including the brief, submission, recorded skills and business feedback. Project history records the participants and timestamps.

Budgets record agreed project value. The app does not process payments.

## 3. View the passport as an employer

1. In the talent account, open **Skills & evidence** and enable public sharing. Review the entry-level privacy choices.
2. Open **View public passport** in a signed-out browser or scan the QR on a phone.
3. Only selected experience and consented completed projects appear. Contact emails and private entries are excluded.
4. Make an entry private, disable passport sharing, or replace the share link. Refresh the public page to verify access changes.

The public passport is read-only. It distinguishes self-declared work, contact confirmations and projects approved through SkillBridge. These are not independent skills assessments or qualifications.

## Optional shared demo accounts

Available after the deployment owner runs `supabase/demo.sql` during database setup:

| Role | Email | Password |
| --- | --- | --- |
| Talent | talent@skillbridge.demo | TalentDemo!2026 |
| Business | business@skillbridge.demo | BusinessDemo!2026 |
| Contact | reviewer@skillbridge.demo | ReviewerDemo!2026 |

The sign-in dialog has buttons for these accounts. Shared demo data may change between testers. Post a fresh task instead of relying on an existing sample remaining open.

## Separate workspaces

Businesses land on Overview and have My tasks, Applicants, Active work, References and Business profile. Young people land on Find work and have My applications, Skills & evidence, References and My profile. Business task counts and review actions use only that business’s own records. No administrator verification or hiring/interview workflow is implied by these screens.
