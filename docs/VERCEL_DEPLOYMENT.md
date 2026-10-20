# Deploy AttendEase to Vercel

The Vercel project is `techtroop/attendease`. The local project is linked to it through gitignored `.vercel/project.json`. No GitHub repository is required for CLI deployment.

Vercel runs the Next.js frontend and API routes. MySQL must run on a separate hosted service: Vercel cannot reach the MySQL service on your Windows computer. Keep the existing local database and `.env.local` for development; cloud credentials are stored separately.

## 1. Create free hosted MySQL

Use [Aiven Console](https://console.aiven.io). Sign up or sign in, then choose **Create service → MySQL → Free**, name it `attendease`, and wait until its status is **Running**. Confirm that the service summary says Free; do not select a paid plan or trial upgrade.

Aiven documents a free MySQL tier without a credit-card requirement, with 1 GB storage and a 76-connection limit. Aiven may stop inactive free services, so check the service before a demonstration. See [free-tier details](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier) and [service creation instructions](https://aiven.io/docs/products/mysql/get-started).

On the service Overview / Quick connect page, locate its host, port, username and password. Download the **CA certificate** (`ca.pem`). Keep the password private. The app will use the `attendease` database, not the provider's initial `defaultdb`; the setup command creates it.

## 2. Enter cloud credentials privately

In a terminal in this project:

```powershell
npm.cmd run db:cloud:configure
```

Enter the host, port, username, hidden password, and the downloaded CA certificate path. The helper saves `.secrets/cloud-db.json`, which is excluded from Git and Vercel uploads. It does not replace local MySQL credentials. Do not send that file or its contents in chat, screenshots or a repository.

## 3. Initialize the hosted database

```powershell
npm.cmd run db:cloud:setup
npm.cmd run db:cloud:seed
npm.cmd run db:cloud:check
```

These commands use verified TLS and operate only on the separately configured cloud database. The same five-table schema and repeatable fictional seed are used. They do not transfer any other local student records. The setup is a manual deployment step, never part of the build or every API request.

If Aiven reports a certificate verification failure, confirm the downloaded CA belongs to that service. Do not disable certificate validation. If creation privileges are unavailable, create the `attendease` database with the provider's admin account before configuring an application user.

## 4. Add Vercel production secrets

After cloud setup/check succeeds:

```powershell
npm.cmd run vercel:env:push
```

This uses your locally authenticated Vercel CLI and adds DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL and DB_SSL_CA to **production** for `techtroop/attendease` as Secret variables. Values are sent through stdin, never command arguments or logs. It does not replace existing variables automatically. If one already exists, update it privately in the [project environment settings](https://vercel.com/techtroop/attendease/settings/environment-variables).

Never use `NEXT_PUBLIC_` for database credentials. The local `.env.local`, certificates and `.secrets/` files are excluded by `.vercelignore`.

## 5. Build, stage, verify and publish

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
vercel.cmd --scope techtroop deploy --prod --skip-domain
```

The last command stages a production build with production secrets without assigning its public production domain. Open the returned deployment URL using your Vercel account if deployment protection is enabled. Check `/api/health`, dashboard data, CRUD, enrollment, attendance saving/editing and reports against the hosted database. Then publish the tested deployment:

```powershell
vercel.cmd --scope techtroop promote <verified-deployment-url>
```

Use the actual URL returned by Vercel. No deployment is complete until live database connectivity and application workflows pass.

## Runtime behavior

- Cloud connections always use TLS with certificate verification, with the provider CA if supplied.
- Vercel instances use a small MySQL pool (three connections per instance, one idle connection) and Vercel's pool lifecycle helper. Autoscaling can still multiply the total connection count; this setup targets a small demonstration.
- A Vercel runtime refuses a missing/loopback database host, preventing accidental use of the Windows-only configuration.
- Existing local development keeps its ordinary local MySQL connection.
- The project currently has no application login. Anyone who can access the deployed app can edit/delete its records. Use fictional demonstration data and keep Vercel deployment protection enabled when access should be restricted.

## Current delivery status

Deployed and verified on **21 October 2026**:

- **Application:** https://attendease-techtroop.vercel.app/dashboard
- **Vercel project:** `techtroop/attendease`
- **Target / state:** Production / READY
- **Deployment ID:** `dpl_Eh52NLQqNBJqf6zEzrt9fEhmj6iR`
- **Immutable deployment:** https://attendease-h35je47wr-techtroop.vercel.app
- **Source revision:** Local workspace upload; this project has no Git repository or commit SHA.
- **Database:** Aiven MySQL over verified TLS; all five InnoDB tables and foreign-key/unique/CHECK constraints verified.
- **Hosted data after test cleanup:** 15 students, 5 subjects, 75 enrollments, 20 sessions, 300 attendance records.
- **Credentials:** Uploaded with explicit user authorization as production Secrets; excluded from source uploads.
- **Access:** Vercel Authentication protection remains enabled. Sign in with an authorized Vercel account to open protected URLs.

The selected Aiven service is **Developer-1 using trial credits**, not a permanently free service. Check its trial/billing status before relying on the database beyond the trial. No paid plan upgrade or payment method was added by this workflow.

### Executed verification

The Vercel remote production build passed. Local TypeScript and ESLint passed. The live `/api/health` returned `{"connected":true}` using existing Vercel authentication.

Headless Edge tested the deployed application: student creation/search/editing, subject creation, enrollment, attendance saving and correction, report filters/grouping/percentage, deletion cancellation and confirmation, and all five pages at 390, 768 and 1440 pixels. Every workflow passed with no browser page errors or page-level overflow. Temporary fictional records were removed and hosted row counts were rechecked. An error-log query scoped to the final deployment returned no entries.

The Vercel pool lifecycle helper is attached to `dbPool.pool`, the underlying MySQL2 pool. Attaching it to the promise wrapper was found to be unsupported by the installed helper; the corrected version is included in the final verified deployment.

Protected browser tests used a private, temporary Vercel-authenticated test cookie, which was deleted afterward. Deployment protection was not disabled. There is no external error-tracking service or log drain configured by this workflow.
