# Gradly Communities — Cloudflare service

This directory contains the isolated Communities backend and its D1 schema. It does not use the Gradly academic PostgreSQL database or modify Firebase student authentication.

## Cloudflare resources

- Worker: `gradly-communities-api`
- D1 database: `gradly-communities` (binding `DB`)
- Durable Object: `ChatRoom` (binding `CHAT_ROOMS`), one deterministic room per group
- Worker endpoint: `https://gradly-communities-api.jugalpkhr.workers.dev`

## Database migrations

Apply the SQL files in `migrations/` in numeric order to the Communities D1 database. The current account database has both migrations applied.

## Worker configuration

The Worker has a D1 binding named `DB` and a Durable Object namespace binding named `CHAT_ROOMS`.

Email verification uses a Resend-compatible provider. Configure these Worker secrets/variables in the Cloudflare dashboard before allowing registrations:

- `RESEND_API_KEY` — secret API key from the email provider
- `EMAIL_FROM` — verified sender, e.g. `Gradly Communities <communities@your-verified-domain>`
- `COMMUNITY_APP_URL` — optional; defaults to `https://gradly-peach.vercel.app`

Never commit these values or paste credentials into chat. The sender domain must be verified with the email provider. The verification link is handled by the student app route `/community/verify`.

## Current API surface

- `GET /health`
- `POST /auth/register`, `POST /auth/verify`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /groups`, `GET /groups/mine`, `POST /groups`
- `GET /groups/:id`, `POST /groups/:id/join`, `POST /groups/:id/leave`
- `GET /groups/:id/messages`, `POST /groups/:id/messages`
- `POST /groups/:id/socket-ticket`, `GET /groups/:id/live?ticket=...`
- `PATCH /messages/:id`, `DELETE /messages/:id`
- `GET /groups/:id/requests`, `POST /groups/:id/requests`
- `POST /groups/:id/reports`, `GET /admin/reports`

WebSocket tickets are short-lived and single-use. Group membership is rechecked at connection time. Message writes are persisted in D1 before broadcast. A REST polling fallback is available to clients.

## Remaining infrastructure gates

- Media and resource uploads are not active yet. R2 is not enabled on the Cloudflare account; enabling it may require a billing/subscription step. Do not activate or upload user content until storage pricing and account billing are reviewed.
- Email verification cannot send until a verified sender and provider credentials are configured.
- Platform Admin / Super Admin role grants must be connected to the existing Ecosystem's explicit Communities permission controls before enabling administrative actions. Do not infer admin authority from a user's email or the existing student session.
- The student UI uses an independent Communities session stored separately from the existing Gradly sign-in.

## Initial product limits

The D1 `chat_platform_settings` row named `limits` stores the initial policy values: 20 group memberships per student, 5,000 characters per message, 10 messages/minute, 5 MB photos, 25 MB videos (maximum 2 minutes), 15 MB PDFs, 10 MB office documents, 100 MB per-user media quota, 20 uploads/day and 3 videos/day. Media enforcement is not enabled until the R2 upload flow is implemented.
