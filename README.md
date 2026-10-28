# Gradly

Gradly is a student-focused academic platform with a separate Gradly Ecosystem administration experience.

## Repository layout

- \`gradly-v2/\` — student-facing React + TypeScript + Vite application and Node.js/TypeScript API.
- \`gradly-ecosystem/\` — administration portal for administrators and Super Admins.
- \`gradly-ecosystem-src-backup/\` — preserved source snapshot; kept separate from the active app.
- \`src/\` — legacy service placeholders; not the active Vite frontend entry point.

## Student application

The student application is in \`gradly-v2\`. It includes:

- Google sign-in through Firebase and a configurable API sync endpoint.
- Guest entry for exploring the workspace without creating an account.
- Overview dashboard with estimated SGPA/CGPA, subject performance, and semester timeline.
- Subject register with editable credits and grade points.
- SGPA calculator and weighted CGPA planner.
- Academic profile editor.
- Responsive purple-themed UI with reduced-motion support.

Guest workspace data is stored in the browser session. Signed-in workspace data currently uses browser local storage; academic-record cloud synchronization should only be described as enabled once a matching persistence API is connected.

Run the student client:

\`\`\`bash
cd gradly-v2
npm ci
npm run dev
\`\`\`

## Gradly Ecosystem administration

The active admin app is \`gradly-ecosystem\`. It provides:

- Admin portal, sign-in, registration, and application workflow.
- Admin workspace.
- Protected Super Admin dashboard, users, user details, and application review.
- Administrator directory with institution/branch/status filters, account details, last-sign-in information, and activate/suspend actions.

Run the admin client:

\`\`\`bash
cd gradly-ecosystem
npm ci
npm run dev
\`\`\`

## Backend

The Node.js/TypeScript API and PostgreSQL integration live in \`gradly-v2/backend\`.

\`\`\`bash
cd gradly-v2/backend
npm install
npm run dev
\`\`\`

Use the existing backend environment configuration for PostgreSQL, Firebase Admin, and authentication. Do not commit secrets.

## Configuration

- \`VITE_API_BASE_URL\` — publicly reachable API origin or API base used by the client. The student client removes a trailing \`/api\` before requesting \`/api/auth/sync\`; the ecosystem pages expect the API base convention already used by their existing code.
- \`VITE_MAIN_APP_URL\` — optional URL for the main Gradly application link shown in the ecosystem entry page.
- \`FRONTEND_ORIGINS\` — comma-separated browser origins allowed by the API CORS configuration.

Only public client configuration belongs in \`VITE_*\` variables. Never put private server secrets in Vite environment variables.

## Validation before shipping

Run the build and lint scripts separately in both frontend folders:

\`\`\`bash
cd gradly-v2
npm run lint
npm run build

cd ../gradly-ecosystem
npm run lint
npm run build
\`\`\`

The ecosystem Vercel project should use \`gradly-ecosystem\` as its root directory. Configure the student app as a separate Vercel project rooted at \`gradly-v2\`.

## Application routes

### Student client

- \`/login\` — Google sign-in or guest entry.
- \`/dashboard\` — protected student workspace.
- Dashboard sections include overview, subjects, SGPA calculator, CGPA planner, and academic profile.

### Ecosystem

- \`/\` — Gradly Ecosystem entry page.
- \`/admin\` — administrator portal.
- \`/admin/login\` — administrator sign-in.
- \`/admin/apply\` — administrator access application.
- \`/admin/register\` — administrator registration.
- \`/admin/dashboard\` — administrator workspace.
- \`/super-admin/login\` — Super Admin sign-in.
- \`/super-admin\` — protected Super Admin dashboard.
- \`/super-admin/users\` and \`/super-admin/users/:userId\` — student directory and academic record details.
- \`/super-admin/applications\` — administrator application review.
- \`/super-admin/admins\` — administrator access directory and status management.

UI changes should preserve API contracts, session handling, and role boundaries. Backend behavior is maintained independently from the frontend.
