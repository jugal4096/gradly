# Contributing to Gradly

## Non-negotiable branch workflow

1. **Start every task from the latest `main`.** Create a new, short-lived branch for one focused feature or fix.
2. **Keep branches short-lived.** Open a draft PR early. Avoid keeping a feature branch alive while many unrelated changes land in `main`.
3. **Sync before substantial work and before asking for review.** Fetch the latest `main` and rebase your feature branch onto it (or merge `main` into it if rebasing is not suitable). Resolve conflicts on the feature branch, never by overwriting `main`.
4. **Keep PRs focused and small.** Split unrelated UI, backend, and infrastructure work into separate PRs where practical. Avoid broad formatting or generated-file churn in feature PRs.
5. **Never force-push to `main`.** Do not bypass failed checks or merge a PR with conflicts.
6. **Do not edit the same shared area in parallel without coordination.** In particular, coordinate changes to Super Admin layout/navigation, shared styles, routing, and API contracts.
7. **Preserve existing product behavior.** UI changes must retain established navigation and the purple Super Admin workspace unless the PR explicitly changes that requirement and includes review evidence.

## Before opening or updating a PR

Run these commands from each affected app directory:

```bash
npm ci
npm run lint
npm run build
```

For the frontend apps, CI runs these checks for both `gradly-ecosystem` and `gradly-v2` on every PR to `main`. A PR is not ready until required checks pass and GitHub reports it as mergeable.

## PR checklist

- [ ] Branch was created from the latest `main` and is up to date.
- [ ] PR contains one coherent change and has no accidental merge commits or conflict markers.
- [ ] Existing main-branch functionality and the Super Admin purple theme/navigation are preserved.
- [ ] Both frontend CI jobs pass (or unrelated app changes are demonstrably unaffected).
- [ ] Database/API changes include compatible migrations and validation.
- [ ] No secrets, local environment files, build output, or dependency-folder changes are included.
- [ ] Screenshots or a concise test note are included for UI changes.

## Recommended branch names

- `feat/<short-feature-name>`
- `fix/<short-bug-name>`
- `chore/<short-maintenance-name>`

Use the PR as the integration point. Do not use a long-lived branch as a second `main`.
