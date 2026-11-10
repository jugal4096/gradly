# Gradly application boundaries

## Applications

Gradly is delivered as two independently built frontend applications backed by one API:

| Application | Repository root | Audience | Responsibilities |
|---|---|---|---|
| Student App | `gradly-v2/` | Students and guests | Academic onboarding, calculators, student dashboard, notifications and student feedback |
| Gradly Ecosystem | `gradly-ecosystem/` | Department administrators and Super Admins | Admin access, institution operations, curriculum administration, user oversight and platform controls |
| Shared API | `gradly-v2/backend/` | Both applications | Authentication verification, authorization, academic rules and persisted workflows |

## Boundary rules

1. Student routes and student-facing screens belong only in `gradly-v2/`.
2. Admin and Super Admin routes belong only in `gradly-ecosystem/`.
3. The two frontends may call the same API, but must not import each other's source code or share browser-session state.
4. Firebase Authentication remains the identity provider unless a separately approved migration is implemented. The backend verifies Firebase ID tokens and applies role/scope authorization.
5. Hiding a route or restricting CORS is not authorization. Every protected API endpoint must enforce its own identity, role, institution, programme and branch scope as appropriate.
6. Only public client configuration may use `VITE_*` variables. Server credentials remain in backend environment configuration.
7. Do not migrate or delete user records, replace Firebase Auth, or change production domains as part of frontend separation without an explicit migration plan.

## Local development

Run the API from `gradly-v2/backend/`, the Student App from `gradly-v2/`, and the Ecosystem from `gradly-ecosystem/`. Configure the backend `CORS_ORIGINS` as a comma-separated allowlist containing the exact local and deployed origins for both frontends. Keep the list explicit; do not use wildcard origins with credentialed requests.

Student App public configuration:
- `VITE_API_BASE_URL`: API origin, e.g. `http://localhost:5000`.

Ecosystem public configuration:
- `VITE_API_BASE_URL`: API origin, e.g. `http://localhost:5000`.
- `VITE_MAIN_APP_URL`: optional absolute URL to the Student App.

Backend configuration:
- `CORS_ORIGINS`: comma-separated exact origins for the Student App and Ecosystem.
- Firebase Admin and database credentials stay server-side.

## Current implementation notes

- The two frontend roots already have independent Vite configurations, package manifests, entry points and route trees.
- Student notifications and syllabus feedback were previously routed inside the Ecosystem. They are moved into the Student App by TO-03.
- Ecosystem authentication still has legacy Firebase client synchronization code and a separate Super Admin session token. Authentication consolidation and backend role/scope audit are separate later task orders; do not assume the two session mechanisms are interchangeable.
- No production domain, deployment, database schema, or user data is changed by this task order.
