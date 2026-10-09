# AI Aviation Jobs

AI Aviation Jobs is a full-stack aviation recruitment portal built with
Node.js, Express, SQLite, vanilla JavaScript, and Playwright. It provides
candidate and employer workflows with durable persistence, server-side
authentication and authorization, validation, operational health checks, and
browser/API regression coverage.

## Highlights

- Candidate registration and login
- Candidate profile management
- Job search, filtering, and job details
- Candidate applications with duplicate-application protection
- Employer login and job posting
- Employer application review and status management
- Server-side role and resource-ownership authorization
- SQLite persistence with transactional migrations
- Bcrypt password hashing
- Expiring server-side sessions with hashed token storage
- HttpOnly, SameSite session cookies
- Same-origin protection for cookie-authenticated state changes
- Security headers through Helmet
- Login rate limiting
- Request-size and payload validation
- Health and readiness endpoints
- Graceful shutdown handling
- Playwright UI, API, smoke, responsive, and negative tests

## Technology stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| HTTP server | Express 5 |
| Database | SQLite |
| SQLite driver | better-sqlite3 |
| Password hashing | bcryptjs |
| Input validation | Zod |
| HTTP security headers | Helmet |
| Rate limiting | express-rate-limit |
| Frontend | HTML, CSS, vanilla JavaScript |
| Testing | Playwright Test |
| Test browsers | Chromium, Mobile Chrome, and a configured Firefox project |

## Application architecture

```text
Browser / Playwright
        |
        v
Express server (src/server.js)
        |
        +--> Authentication and authorization middleware
        +--> Zod request validation
        +--> Security headers and rate limiting
        +--> Static frontend (public/)
        |
        v
SQLite database (src/db.js)
        |
        +--> migrations/001_initial.sql
        +--> users
        +--> jobs
        +--> applications
        +--> sessions
        +--> schema_migrations
```

The application is designed for a single service instance using a local
SQLite database. Before horizontal scaling, move persistence and sessions to
managed shared infrastructure.

## Repository structure

```text
.
├── migrations/
│   └── 001_initial.sql       # Relational schema and indexes
├── public/
│   ├── app.js                # Browser routing, rendering, and API client
│   ├── index.html
│   └── styles.css
├── scripts/
│   ├── migrate.js            # Explicit migration command
│   └── seed.js               # Development-only seed command
├── src/
│   ├── db.js                 # SQLite initialization and migration runner
│   └── server.js             # Express application and API routes
├── tests/                    # Playwright UI and API tests
├── .env.example              # Local configuration template
├── package.json
└── playwright.config.js
```

## Prerequisites

- Node.js 18 or newer
- npm
- A supported Playwright browser installed locally

Check the local runtime:

```bash
node --version
npm --version
```

## Installation

```bash
npm install
npx playwright install chromium
```

The project does not require a separate database server. SQLite is created
locally when the application starts.

## Configuration

Copy the example configuration and update it for the local environment:

```bash
cp .env.example .env
```

The application reads configuration from the process environment. Node.js
does not load `.env` automatically, so export variables in the shell or use
your deployment platform's environment configuration.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime mode. `test` enables fixtures and the test reset route. |
| `PORT` | `3000` | HTTP listening port. |
| `DATABASE_PATH` | `data/app.sqlite` outside test mode | SQLite database path. Required for deployed/non-development modes. |
| `SEED_PASSWORD` | None | Required only by `npm run db:seed`; must contain at least 12 characters. |

Example:

```bash
export NODE_ENV=development
export PORT=3000
export DATABASE_PATH="$PWD/data/app.sqlite"
```

### Environment safety rules

- Do not commit `.env` files, database files, session data, or production
  passwords.
- Do not run the seed command in production.
- Do not run the server with `NODE_ENV=test` in a public environment.
- Deployed/non-development environments must define `DATABASE_PATH`.
- Deployed/non-development environments automatically receive `Secure`
  session cookies and must be served through HTTPS.

## Database and migrations

The database module:

1. Creates the configured parent directory.
2. Opens the SQLite database.
3. Enables foreign-key enforcement.
4. Enables WAL journal mode.
5. Creates the `schema_migrations` table.
6. Applies unapplied `.sql` migrations in sorted filename order.
7. Records each successful migration transactionally.

Run migrations explicitly:

```bash
npm run db:migrate
```

The initial schema provides:

- `users` with candidate/employer role constraints and unique emails
- `jobs` with required employer ownership
- `applications` with job/candidate foreign keys
- Unique `(job_id, candidate_id)` application pairs
- Valid application-status constraints
- `sessions` with hashed token primary keys and expiry timestamps
- Indexes for ownership, search, applications, and session expiry

Future schema changes should be added as new numbered migration files. Do not
edit an already-applied migration in a deployed database.

### Development seed data

Development data is never seeded automatically. Create it explicitly:

```bash
SEED_PASSWORD='use-a-local-password-at-least-12-characters' npm run db:seed
```

The seed script clears the development users, jobs, applications, and sessions
before creating local candidate and employer fixtures. It is destructive for
the selected development database and must not be used against production
data.

Test fixtures are created only when `NODE_ENV=test` and use a separate test
database path by default:

```text
data/test.sqlite
```

## Authentication and sessions

### Login

`POST /api/auth/login` validates the email, password, and requested role.
Successful login:

- Verifies a bcrypt password hash.
- Generates a cryptographically random session token.
- Stores only the SHA-256 hash of that token.
- Sets an expiring `session` cookie.
- Returns public user information.

The raw session token is not returned in the JSON response. Browser and API
clients should use the HttpOnly session cookie.

### Session properties

- Eight-hour expiration
- `HttpOnly`
- `SameSite=Lax`
- `Secure` outside development and test environments
- Server-side invalidation on logout
- Expired sessions are removed when encountered

### Browser authentication

The frontend sends same-origin credentials with API requests. It stores only
non-secret UI state in local storage:

- An authenticated marker
- Public user profile data

It does not store the session token in local storage.

## Authorization model

Authorization is enforced on the server and does not depend on frontend
visibility.

### Candidate operations

- View the authenticated candidate profile
- Update allowlisted profile fields
- Apply to existing jobs
- View only the authenticated candidate's applications

### Employer operations

- Create jobs owned by the authenticated employer
- View applications only for jobs owned by that employer
- Update application status only for applications associated with that
  employer's jobs

Cross-employer application requests return a non-disclosing not-found response
and do not modify application state.

## Browser and API security controls

### CSRF and origin protection

Cookie-authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests validate an
explicit `Origin` header. A foreign origin is rejected with HTTP 403. Requests
without an `Origin` header remain compatible with non-browser clients, while
same-origin browser requests continue normally.

### Security headers

Helmet provides the baseline HTTP security headers, and Express's
`X-Powered-By` header is disabled.

### Input validation

Zod schemas validate:

- Login credentials
- Candidate registration
- Profile updates
- Job creation
- Job search parameters
- Application status updates

Unknown job fields are rejected. Profile updates use an explicit allowlist, so
protected fields such as role, email, and password cannot be mass-assigned.

### Request limits and abuse controls

- JSON body limit: 100 KB
- URL-encoded body limit: 20 KB
- Production/default login limit: 20 attempts per 15 minutes
- Test-mode login limit: higher threshold for serial test isolation

### Error handling

API errors use safe, concise messages. Password hashes, session hashes, raw
session tokens, and internal database details are not returned to clients.

## Operational endpoints

### `GET /healthz`

Returns HTTP 200 when the process is running:

```json
{ "status": "ok" }
```

### `GET /readyz`

Executes a database query and returns HTTP 200 only when the database is
available:

```json
{ "status": "ready" }
```

Database failures return HTTP 503 with a non-sensitive response.

## API overview

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Public |
| `POST` | `/api/auth/logout` | Authenticated |
| `POST` | `/api/auth/register` | Public; candidate registration only |
| `GET` | `/api/jobs` | Public |
| `GET` | `/api/jobs/:id` | Public |
| `POST` | `/api/jobs` | Employer |
| `GET` | `/api/profile` | Candidate |
| `PUT` | `/api/profile` | Candidate |
| `POST` | `/api/jobs/:id/apply` | Candidate |
| `GET` | `/api/applications/me` | Candidate |
| `GET` | `/api/employer/applications` | Employer |
| `PATCH` | `/api/applications/:id/status` | Employer |
| `GET` | `/healthz` | Public |
| `GET` | `/readyz` | Public |

The test-only `POST /api/test/reset` endpoint is registered only when
`NODE_ENV=test`. It is not available in development or deployed runtime modes.

## Running the application

Start the server:

```bash
npm start
```

The default URL is:

```text
http://127.0.0.1:3000
```

Development watch mode:

```bash
npm run dev
```

Verify health and readiness:

```bash
curl http://127.0.0.1:3000/healthz
curl http://127.0.0.1:3000/readyz
```

## Testing

Playwright starts the application in test mode with a shared test database.
The configuration uses one worker because reset operations intentionally
share that database.

### Test commands

Run the complete configured suite:

```bash
npm test
```

Run smoke tests:

```bash
npm run test:smoke
```

Run regression tests:

```bash
npm run test:regression
```

Run a specific browser project:

```bash
npx playwright test --project=chromium --workers=1
npx playwright test --project=mobile-chrome --workers=1
```

Run the API suite:

```bash
npx playwright test tests/api.spec.js --project=chromium --workers=1
```

Interactive and diagnostic modes:

```bash
npm run test:headed
npm run test:debug
npm run report
```

### Test coverage

The suite covers:

- Authentication and invalid credentials
- Cookie-only login behavior
- Logout invalidation
- Candidate and employer role boundaries
- Employer job ownership
- Cross-employer application isolation
- Unauthorized application-state preservation
- Candidate profile updates and validation
- Job search and detail pages
- Applications and duplicate prevention
- Employer job posting and application review
- Health and readiness endpoints
- Cross-origin cookie mutation rejection
- Responsive Mobile Chrome behavior

Playwright is configured to retain traces, screenshots, and videos on failure
and to generate an HTML report.

## Production deployment guidance

This repository is currently suitable for a carefully configured
single-instance deployment.

Before deploying:

1. Provide an absolute, persistent `DATABASE_PATH`.
2. Run the application with a deployed environment value for `NODE_ENV`.
3. Serve through HTTPS.
4. Restrict permissions on the SQLite database, WAL, and shared-memory files.
5. Configure process supervision and automatic restart behavior.
6. Configure database backups and test restoration.
7. Monitor `/healthz` and `/readyz`.
8. Keep test mode disabled.
9. Never run `npm run db:seed` against production data.
10. Review migration files before applying them.

### Scaling limitation

SQLite file storage and in-process application behavior are intended for one
application instance. Horizontal scaling requires a migration to managed shared
relational storage and shared session infrastructure, together with production
backup, failover, and migration procedures.

## Security checklist

- [x] Passwords are bcrypt-hashed.
- [x] Session tokens are generated with cryptographic randomness.
- [x] Only token hashes are stored in the database.
- [x] Sessions expire and logout invalidates them.
- [x] Login JSON does not expose the raw session token.
- [x] Cookies are HttpOnly and SameSite-protected.
- [x] Deployed environments use Secure cookies.
- [x] Cookie-authenticated mutations validate foreign origins.
- [x] Role checks are enforced server-side.
- [x] Employer job/application ownership is enforced server-side.
- [x] Profile updates use an allowlist.
- [x] Request payloads are validated and size-limited.
- [x] Login attempts are rate-limited.
- [x] Security headers are enabled.
- [x] Test-only reset functionality is isolated to test mode.
- [x] Production dependency audit is part of release verification.
- [ ] Public production infrastructure, backup restoration, and reverse-proxy
      behavior must still be verified in the target deployment environment.

## Known limitations

- SQLite is not a horizontal-scaling database for this service.
- The frontend may temporarily display stale authenticated UI state after a
  session expires or is revoked; protected API requests still enforce access.
- Previous sessions remain valid until expiry unless individually logged out;
  there is no logout-all-sessions or password-change session revocation flow.
- File permissions, backups, HTTPS termination, and monitoring depend on the
  deployment environment and are not established by this repository alone.
- The configured Firefox Playwright project exists, but release verification
  for this project has been limited to Chromium and Mobile Chrome.

## License and project use

This project is intended as a portfolio and testing application. Review,
understand, and verify the implementation before representing its behavior or
test results in production documentation or professional materials.
