# Verification record

## Vercel deployment — 21 October 2026

The production application is at https://attendease-techtroop.vercel.app/dashboard, protected by Vercel Authentication. Deployment `dpl_Eh52NLQqNBJqf6zEzrt9fEhmj6iR` is READY and uses the Aiven MySQL service over verified TLS. The remote production build, live health check and full browser workflow suite passed. All five pages passed at 390, 768 and 1440 pixels with no page errors or page-level overflow. CRUD, enrollment, attendance save/edit, reports, and confirmation dialogs were exercised on the deployed URL. Test records were cleaned up; all five tables and their constraints were verified afterward. The final deployment's error-log query returned no entries.

The hosted database contains the fictional seed dataset: 15 students, 5 subjects, 75 enrollments, 20 sessions and 300 attendance records. It is separate from the local Windows database. The Aiven Developer-1 service uses trial credits. Full deployment details and ongoing commands are in [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md).

## Original local verification

Verified locally on 20 October 2026 with Node.js 24.18.1, Next.js 16.4.2, a running MySQL80 service, and headless Microsoft Edge. No public deployment was made.

## Results

| Check                                        | Result                                                           |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Production build                             | Passed                                                           |
| TypeScript (`npm.cmd run typecheck`)         | Passed                                                           |
| ESLint (`npm.cmd run lint`)                  | Passed, no warnings                                              |
| Attendance validation tests (`npm.cmd test`) | 8 passed                                                         |
| MySQL connectivity                           | Passed                                                           |
| Five tables and InnoDB engines               | Passed                                                           |
| Five foreign keys and cascade rules          | Passed                                                           |
| Unique/composite keys and period CHECK       | Passed                                                           |
| Schema and seed re-execution                 | Passed; row counts unchanged                                     |
| All viva SQL examples                        | Executed successfully; demonstration writes rolled back          |
| Live API integration suite                   | Passed                                                           |
| Browser workflows                            | Passed                                                           |
| Responsive pages                             | All five passed at 390, 768 and 1440 pixels                      |
| Application restart persistence              | Dashboard, reports and sessions matched the pre-restart snapshot |
| Runtime dependency audit                     | 0 vulnerabilities reported                                       |

## Data verified

15 students, 5 subjects, 75 enrollments, 20 class sessions, 300 attendance records. Temporary API/browser records were deleted after testing. The seeded weighted overall attendance is 72%.

## Live API coverage

- Student creation, editing, reading and deletion.
- Subject creation, editing, reading and deletion.
- Enrollment and duplicate enrollment rejection.
- Complete attendance creation and existing session correction.
- Duplicate session and duplicate student rejection.
- Non-enrolled student and partial roster rejection.
- Zero-record student returns NULL percentage.
- SQL present/absent counts and percentage: one present plus one absent gives 50%.
- Detailed, student and subject report queries and below-75% results.
- Dashboard counts and overall percentage compared with direct SQL.
- Unenrollment preserves historical reports.
- Genuine mid-write failure: a temporary test-subject-scoped trigger fails the second insert; the session and first attendance insert are both rolled back. The trigger is removed in a finally block.

## Browser coverage

Created and edited a student, searched by roll, created a subject, enrolled the student, saved Present attendance, corrected it to Absent, verified the 0% report, changed report grouping, cancelled a deletion, confirmed deletion and checked the result. All five pages rendered at phone, tablet and desktop widths without page errors or page-level overflow. Tables scroll inside their containers on narrow screens.

Browser testing discovered and fixed a loopback origin-comparison issue affecting real form writes. Responsive testing discovered and fixed a grid minimum-width issue. Final suites passed against the rebuilt production application after those fixes.

Actual captures are in [screenshots/dashboard.png](screenshots/dashboard.png) and [screenshots/mobile.png](screenshots/mobile.png).

## Remaining dependency advisory

The development-only ESLint chain reports five high-severity advisory entries involving braces and its dependent packages. `npm audit fix` did not resolve them; the proposed forced change downgrades eslint-config-next incompatibly. That downgrade was not applied. `npm audit --omit=dev` reported zero vulnerabilities. There are no remaining functional blockers identified by the executed checks.

## Run again

With the production application running:

```powershell
npm.cmd run db:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:api
npm.cmd run test:browser
```

Run the two integration suites sequentially. `npm.cmd run build` verifies a fresh production build; restart `npm.cmd start` afterward if source changes were made. Browser tests use the installed Microsoft Edge; the API rollback test requires TRIGGER permission on the local development database.
