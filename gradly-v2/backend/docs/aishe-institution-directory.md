# AISHE institution directory import

Gradly treats the Government of India's AISHE Higher Education Institution Directory as the authoritative institution source. The public directory covers universities, colleges (including affiliated, constituent and autonomous colleges), standalone institutions and R&D institutes.

## One-time database setup

Apply these migrations to the same PostgreSQL database used by the student backend:

- `migrations/20261106_institution_discovery_requests.sql`
- `migrations/20261106_aishe_institution_directory.sql`

## Importing a directory export

Obtain an institution-directory export from the official AISHE portal: https://dashboard.aishe.gov.in/hedirectory/ . The importer accepts a CSV or pipe-delimited export with a header row. It expects at least:

- `aishe_code` (or `aisheCode` / `AISHE Code`)
- `name` (or `institution_name` / `college_name`)
- `state` (or `state_name`)

Optional fields include `district`, `category`, `college_type`, `standalone_type`, `university_type`, `university_name`, `website`, `management`, and `survey_year`.

From `gradly-v2/backend` run:

```bash
npm run import:aishe -- /secure/path/to/aishe-institutions.csv
```

The importer upserts by AISHE code, preserves the official code, and reports imported/skipped rows. Keep the source file and its survey year with your operational data so updates can be audited. Do not use an unverified scraped file as if it were a current official export.

## Search coverage and provenance

The discovery endpoint merges three sources:

1. AISHE registry rows imported from the official directory export (preferred national coverage).
2. Gradly's own institution/program/branch directory.
3. OpenAlex as a supplementary discovery provider only.

OpenAlex is not a complete Indian higher-education register. The AISHE portal exposes the official directory, but a stable public API/export endpoint could not be verified during this implementation. Therefore a fresh official export must be supplied and imported before Gradly can honestly claim nationwide AISHE coverage. Until that import is complete, results are explicitly source-labelled and the request-to-add path remains available.
