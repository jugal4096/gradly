# Gradly Ecosystem

Gradly Ecosystem is the independent administration frontend for department administrators and Super Admins. It is a separate React, TypeScript and Vite application from the student-facing `gradly-v2/` app.

## Responsibilities

- Administrator access, applications and workspace.
- Institution and curriculum administration.
- Super Admin user, administrator, request and platform oversight.

Student-facing screens, guest workflows and student dashboard routes belong in `gradly-v2/`, not in this application.

## Development

```bash
npm ci
npm run dev
```

Set `VITE_API_BASE_URL` to the shared backend origin (defaults to `http://localhost:5000` for local development). Set `VITE_MAIN_APP_URL` to the Student App's absolute URL when the entry page should link to it.

## Validation

```bash
npm run lint
npm run build
```

The browser client must contain only public configuration. Firebase Admin credentials and database secrets must remain in the backend environment.
