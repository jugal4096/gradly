# Gradly

Gradly is a student-focused academic platform with a separate Gradly Ecosystem administration experience.

## Repository layout

- `gradly-ecosystem/` — active React + TypeScript + Vite frontend for the ecosystem portal.
- `gradly-ecosystem-src-backup/` — preserved source snapshot; kept separate from the active app.
- `gradly-v2/` — separate next-generation frontend scaffold.
- `src/` — legacy service placeholders; not the active Vite frontend entry point.

## Run the ecosystem frontend

```bash
cd gradly-ecosystem
npm ci
npm run dev
```

## Validate before shipping

```bash
npm run lint
npm run build
```

The production build runs TypeScript project checks followed by Vite. The Vercel project should use `gradly-ecosystem` as its root directory.

## Configuration

- `VITE_API_BASE_URL` — API origin used by the admin and super-admin clients. If omitted, local development defaults to `http://localhost:5000`.
- `VITE_MAIN_APP_URL` — optional URL for the main Gradly application link shown in the ecosystem entry page.

Only public client configuration belongs in Vite environment variables. Never put private server secrets in `VITE_*` variables.

## Application routes

- `/` — Gradly Ecosystem entry page.
- `/admin` — administrator portal.
- `/admin/login` — administrator sign-in.
- `/admin/apply` — administrator access application.
- `/admin/register` — administrator registration.
- `/admin/dashboard` — administrator workspace.
- `/super-admin/login` — super-admin sign-in.
- `/super-admin` — protected super-admin workspace, including dashboard, users, user details, and applications.

## Design and implementation notes

The ecosystem frontend uses a shared purple design-token foundation with responsive page-specific layouts. The router entry point is `src/App.tsx`, imported by `src/main.tsx`; `src/app/App.tsx` is a compatibility re-export to avoid divergent route definitions.

UI work should preserve existing API contracts, session handling, and role boundaries. Backend behavior is maintained independently from the frontend.
