# Gradly Ecosystem

The Gradly Ecosystem is the React + TypeScript + Vite frontend for the Gradly administration experience.

## Requirements

- Node.js compatible with the installed Vite version
- npm

## Development

```bash
npm ci
npm run dev
```

## Quality checks

```bash
npm run lint
npm run build
```

## Environment variables

Create a local `.env` file if needed:

```dotenv
VITE_API_BASE_URL=http://localhost:5000
VITE_MAIN_APP_URL=http://localhost:5174
```

Use the real API origin for your environment. Vite exposes `VITE_*` values to the browser, so do not put server secrets in them.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Ecosystem entry |
| `/admin` | Administrator portal |
| `/admin/login` | Administrator sign-in |
| `/admin/apply` | Apply for administrator access |
| `/admin/register` | Administrator registration |
| `/admin/dashboard` | Administrator workspace |
| `/super-admin/login` | Super-admin sign-in |
| `/super-admin` | Protected super-admin dashboard |
| `/super-admin/users` | User management |
| `/super-admin/users/:userId` | User detail |
| `/super-admin/applications` | Application review |

## Architecture

- `src/main.tsx` is the Vite entry point and loads the shared design tokens and global accessibility/layout styles.
- `src/App.tsx` is the canonical React Router configuration.
- `src/app/App.tsx` re-exports the canonical router to prevent route drift.
- `src/lib/superAdminSession.ts` owns the super-admin client session helpers.
- Page-specific behavior and API contracts should be preserved when making visual changes.
- `vercel.json` rewrites app paths to the SPA entry point so direct route visits can resolve through React Router.
