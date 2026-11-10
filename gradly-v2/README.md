# Gradly Student App

The Student App is the student- and guest-facing Gradly frontend. It is an independent React, TypeScript and Vite application.

## Responsibilities

- Student sign-in and guest entry.
- Academic onboarding and student dashboard.
- Student academic tools and calculators.
- Student notifications and syllabus feedback.

Administrator and Super Admin screens belong in the separate `gradly-ecosystem/` application and must not be added to this route tree.

## Development

```bash
npm ci
npm run dev
```

Set `VITE_API_BASE_URL` to the shared backend origin (defaults to `http://localhost:5000` for local development).

## Validation

```bash
npm run lint
npm run build
```

Firebase client configuration is public application configuration; never add Firebase Admin credentials, database credentials or other server secrets to `VITE_*` variables.
