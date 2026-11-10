# Gradly

Gradly is a student-focused academic platform with a separately built administration application. Both frontends use the shared backend API while retaining independent routing, authentication state, dependencies, builds and deployments.

## Repository layout

- `gradly-v2/` — Student App for students and guests.
- `gradly-ecosystem/` — Gradly Ecosystem for department administrators and Super Admins.
- `gradly-v2/backend/` — shared API, authentication verification, academic domain services and persistence.
- `gradly-ecosystem-src-backup/` — preserved historical source snapshot; not an active application.

See [APPLICATION-BOUNDARIES.md](./APPLICATION-BOUNDARIES.md) for the application ownership and security rules.

## Run locally

Run each application in a separate terminal.

Student App:
```bash
cd gradly-v2
npm ci
npm run dev
```

Gradly Ecosystem:
```bash
cd gradly-ecosystem
npm ci
npm run dev
```

Shared API:
```bash
cd gradly-v2/backend
npm ci
npm run dev
```

Configure each frontend's `VITE_API_BASE_URL` with the API origin. Configure the backend's `CORS_ORIGINS` as a comma-separated allowlist of the exact Student App and Ecosystem origins. Firebase Admin and database secrets must remain backend-only.

## Validation

Run `npm run lint` and `npm run build` independently in both frontend roots. Run `npm test` in the backend.

Do not deploy or change production domains as part of local application-boundary work.
