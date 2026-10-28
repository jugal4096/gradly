# Gradly V2 — Guest Mode and Student Onboarding Specification

**Date:** 2026-10-24  
**Branch:** `fix/gradly-audit-2026-10-17`  
**Status:** Product requirements for implementation

## 1. Product rule

Every unauthenticated first-time visitor lands on the welcome/login page. The visitor chooses one of two paths:

1. **Continue with Google** — authenticate with Firebase, synchronize the identity with the Gradly API, then complete academic onboarding if no student profile exists.
2. **Continue as Guest** — create a persistent guest profile/session, choose a unique guest display name, receive a server-generated guest ID (for example, `4089`), and enter the limited guest workspace.

The guest workspace is part of the main Gradly student application. It must not expose or depend on Gradly Ecosystem UI or permissions.

## 2. Guest identity and persistence

- A guest must receive a server-generated, non-guessable session token and a stable guest identifier.
- The display name is chosen by the guest and must be unique if the UI promises uniqueness. The server must enforce this constraint; client-side checks alone are insufficient.
- The public-facing ID (for example, `Guest 4089`) is a display identifier, not an authentication secret.
- Guest profile, calculator inputs, saved calculations, and activity events are persisted through the backend/database. Do not rely on browser local storage as the only copy of saved guest work.
- Store only the guest session token hash in the database. Return the raw token only at session creation and send it to the API in the designated guest-session header.
- Define and communicate the session recovery/expiry policy before production. If a guest loses their token or browser data, do not promise recovery unless a recovery mechanism exists.
- Guest sessions must be isolated: a guest can read and modify only their own data. One guest must never be able to query another guest's records by changing an ID.

## 3. Guest feature permissions

### Available without Google login

- Generic SGPA calculator.
- Add, remove, and edit generic subject rows.
- Enter a subject name, grade/grade point, and credits; allow the guest to edit credits.
- Calculate and review the SGPA with a visible calculation breakdown.
- Generic CGPA calculator with manual semester SGPA entry. Ask for semester credits where the selected CGPA method needs them; clearly label the method used.
- Guest profile: display ID/name and access to the guest's own saved calculations/history, if history is enabled.
- Guest settings, including changing their display name subject to uniqueness validation.

The generic guest calculators must not require or display institution, branch, scheme, curriculum, or semester selection. They are independent of a particular university's curriculum.

### Locked until Google login and student onboarding

- Institution/branch/program/scheme/curriculum selection and curriculum explorer.
- Institution-specific semester/subject/credit lists.
- Student academic profile and calculated current year/semester.
- Official result fetchers and result PDF imports.
- Semester-wise academic record management and result history.
- Curriculum-aware SGPA/CGPA and institution-specific grading policies.
- Target CGPA planner, academic analytics, earned-credit progress, backlog tracking, study planner and reminders.
- AI academic assistant and student community until those features are implemented and explicitly enabled.

Locked cards may be visible in the navigation with a lock indicator. Clicking a locked feature must show a friendly sign-in dialog and a Google sign-in action. Preserve the guest's saved work during the sign-in flow; do not silently discard it.

## 4. Google student onboarding

After successful Google authentication and backend identity synchronization, collect the required profile information in a guided, resumable wizard.

### Required or institution-dependent fields

- Institution.
- Program and branch.
- Curriculum/scheme, where applicable.
- Enrollment/PRN/registration number, only where required by the selected institution or a feature such as official result retrieval.
- Admission year.
- Admission mode, including lateral entry where applicable.

### Optional fields

- Student's preferred name (do not require the student to type a name; Google display name may be used as a default).
- Gap years or academic breaks.
- Current semester confirmation if it cannot be reliably derived.
- Target CGPA.

### Profile generation rules

- Estimate the expected year/semester from program duration, admission year, admission mode, and declared gap years.
- Do not infer the actual semester from admission year alone. Lateral entry, delayed progression, backlogs, and university calendar differences can invalidate a simple formula.
- Show the computed estimate and ask the student to confirm/correct the current semester.
- Persist the profile through the backend API. Use one canonical API response DTO and map database naming to frontend camelCase at the API boundary.
- Enrollment identifiers are private academic data. Validate format where the institution provides rules, minimize exposure, and never display them in public guest or community views.

## 5. Guest feature-lock UX

When a guest clicks a locked item, show a modal/dialog such as:

**Unlock your Gradly experience**  
This feature is available to registered students. Sign in with Google to create your academic profile and unlock personalized tools.

Actions:
- Primary: **Continue with Google**
- Secondary: **Keep using Guest Mode**

The dialog must not imply that signing in automatically verifies academic results or guarantees that a university portal can be accessed.

## 6. Super Admin guest audit workspace

Super Admins may inspect guest profiles and activity for platform support, abuse investigation, and product diagnostics. This is privileged administrative access, not a public feature.

- List guest ID, display name, creation/last-seen timestamps, session status, and activity count.
- Open a guest detail view to inspect saved calculator work and an ordered activity timeline, including calculator created/updated/deleted, calculation run, feature-lock clicked, profile updated, and session events.
- Record Super Admin views/exports of guest data in the administrative audit log.
- Enforce authorization in the backend on every admin endpoint; hiding a UI link is not security.
- Do not expose guest activity endpoints to ordinary logged-in students or other guests.
- Minimize logged data: never log raw session tokens, authentication secrets, or unnecessary sensitive content. Provide a clear privacy notice that guest work is saved and can be inspected by authorized Super Admins.
- Use pagination, access checks, and retention/deletion rules. Avoid making every guest activity publicly searchable.

## 7. Backend and existing-code implications

The current backend already has a guest session API and records some guest activity. However, its current guest routes include branch listing and branch selection. Those branch-selection endpoints and any corresponding guest UI must not be part of the new guest experience, because generic guest calculators must not depend on a branch or curriculum.

Before implementation:
1. Inspect the live schema and applied migrations. Do not guess the structure of `guest_sessions`, `audit_logs`, or related tables.
2. Confirm how guest display names/IDs, saved calculator drafts/results, and detailed activity events will be persisted.
3. Add/verify server-side guest authentication middleware and ownership checks for every guest data endpoint.
4. Add Super Admin-only list/detail/activity endpoints with explicit authorization and audit logging.
5. Define how a guest can convert to a Google account and optionally migrate their own guest work after authentication; require explicit confirmation and prevent cross-account data attachment.
6. Add tests for session creation, unique names/IDs, guest data isolation, locked feature authorization, admin-only visibility, expiry/recovery, and conversion.

## 8. Acceptance criteria

- A fresh visitor lands on the login/welcome screen, not the dashboard.
- Google sign-in leads to onboarding when the student profile is missing, otherwise to the dashboard.
- Guest mode assigns a stable guest ID and saves the chosen display name and work in the database.
- Guests can add/remove generic subjects, edit credits, calculate SGPA, and manually calculate CGPA.
- Guests cannot select institution/branch/semester or access curriculum-aware student features.
- Clicking a locked feature presents a sign-in dialog without losing guest work.
- A guest can only read/update their own data.
- Only an authenticated Super Admin can inspect guest records and activity, and admin access is audited.
- The application never treats a guest display ID as proof of identity.
- Student name remains optional, and the expected semester is presented as an estimate until confirmed.
