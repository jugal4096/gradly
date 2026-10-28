# Gradly V2 Phase 0 — Codebase Audit

**Date:** 2026-10-24  
**Branch:** `fix/gradly-audit-2026-10-17`  
**Scope:** Student application foundation, API contracts, academic persistence, and implementation readiness.

## Executive summary

The current V2 branch has useful foundations, but the complete student journey is not yet implemented. Authentication and a minimal dashboard exist; academic domain types, calculation functions, Firestore repositories, PostgreSQL-backed profile endpoints, academic master-data routes, and administrative modules also exist.

The immediate goal is to integrate these pieces safely before adding more student-facing features.

## Confirmed current state

### Frontend
- React 19, TypeScript, Vite, React Router, and Firebase client SDK are used.
- `src/main.tsx` boots `src/app/App.tsx`.
- `src/app/routes.tsx` currently routes to the home redirect, login, protected dashboard, and a 404 page.
- `src/features/auth/AuthContext.tsx` uses Firebase Google sign-in, synchronizes the Firebase ID token with `POST /api/auth/sync`, and exposes `user`, `loading`, `loginWithGoogle`, and `logout`.
- `src/features/dashboard/DashboardPage.tsx` is currently a minimal welcome page with sign-out.
- Student profile and semester/subject result TypeScript types exist under `src/domain/student/`.
- SGPA and CGPA calculation functions and an engine test file exist under `src/domain/academic/engine/`.
- Firestore repositories exist for student profiles, academic records, curriculum, courses, and grading.

### Backend
- Express + TypeScript API is in `backend/src`.
- Firebase ID-token authentication and user synchronization routes exist.
- Protected student endpoints currently expose `GET /api/student/profile` and `POST /api/student/profile`, along with syllabus feedback.
- The student repository reads and creates profiles in PostgreSQL and joins institution, curriculum, program, branch, scheme, and admission-mode data.
- `GET /api/academic/institutions` exposes institution/program/branch master data for selectors.
- The backend also contains guest, admin, Super Admin, administrator, and admin-application modules.
- CORS configuration is sourced from backend environment configuration.

## Findings and risks

### 1. Student profile contract mismatch

Frontend type `StudentProfile` currently expects camelCase fields such as:
- `studentId`
- `programId`
- `departmentId`
- `currentSemester`
- `targetCGPA`

The PostgreSQL-backed API returns fields including database-shaped values such as:
- `student_identifier`
- `current_semester_number`
- `target_cgpa`
- joined institution/program/branch/scheme names

The API needs an explicit response DTO and a single mapping boundary. UI components should not each guess how to map database fields.

### 2. Academic data ownership is unresolved

The frontend has Firestore repositories for student profiles and academic records, while PostgreSQL is already used by the backend for student profiles and academic master data.

**Recommendation:** Make the backend/PostgreSQL the authoritative store for private academic records and profiles. Keep Firebase Authentication for identity. Retain Firestore only for deliberately separate use cases after reviewing current usage and security rules. Do not dual-write the same academic record to both stores.

This is an architecture recommendation, not a claim that the existing Firestore data has already been migrated.

### 3. Database baseline is not fully represented in the inspected migrations

The checked-in migration directory contains several recent admin governance/security and curriculum seed migrations. The inspection did not identify a complete baseline migration defining all student, curriculum, grading, and academic-record tables.

Before writing migrations or SQL against the live database, locate and review the authoritative schema and confirm which migrations have been applied in each environment.

### 4. Calculation policy needs institution-specific configuration

The existing SGPA function computes a credit-weighted average of grade points. The CGPA function computes a credit-weighted average of semester SGPAs. These are useful generic functions, but they must only be used where they match the institution's actual rules. Include exclusions, repeats, absent/withheld subjects, and credit eligibility in the policy contract and tests before relying on results as official.

### 5. Result fetching requires a staged implementation

There is no confirmed universal result-fetching connector in the inspected student routes. Implement this as a source-specific workflow:
1. Supported official connector where permitted.
2. PDF/structured import with extraction and subject matching.
3. Review and correction before saving.
4. Manual entry as a fallback.
5. Provenance and verification status retained with the saved record.

Do not promise universal portal scraping or bypass CAPTCHA/authentication controls.

## Architecture decisions proposed for the next implementation steps

1. Firebase Auth verifies identity; backend maps the Firebase UID to a Gradly user.
2. Backend owns authorization and data validation for all private student APIs.
3. PostgreSQL is the source of truth for student profiles, academic records, and published academic master data.
4. API responses use explicit camelCase DTOs; database naming remains internal to the backend.
5. Published curriculum versions and subject/credit snapshots preserve historical result meaning.
6. Calculation policies are institution-aware and test-covered.
7. Result imports are reviewable and traceable; uncertain extraction is never silently treated as verified.
8. Gradly Student and Gradly Ecosystem remain independent frontends that communicate through authorized backend APIs.

## Next steps, in order

### Phase 0A — Complete the schema audit
- Locate the authoritative PostgreSQL schema and deployment migration history.
- Review student profile, user, curriculum, semester, course, grading, and result constraints.
- Confirm the live/dev database provider and current migration state without exposing credentials.

### Phase 0B — Formalize contracts
- Define typed student profile API request/response DTOs.
- Document error response shapes and profile-not-created behavior.
- Add contract tests around profile retrieval and creation.
- Inventory all Firestore repository call sites and decide which are legacy versus active.

### Phase 1 — Student foundation
- Add shared application shell and responsive navigation.
- Implement onboarding/profile setup using real academic master data.
- Load the authenticated student's persisted profile.
- Render explicit setup, loading, and error states in the dashboard.

### Quality gate
Before proceeding to result imports, verify frontend build/lint, backend type-check/build, API contract tests, ownership tests, and calculation-engine tests.
