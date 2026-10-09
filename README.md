# AI Aviation Jobs — Playwright JavaScript Testing Project

## Runtime architecture

The application uses Express with a file-backed SQLite database. The
schema is applied from `migrations/001_initial.sql` when the server starts,
and `DATABASE_PATH` can point to a different database file. SQLite foreign
keys, uniqueness constraints, and indexes protect relationships between
users, jobs, applications, and sessions.

Production and development data are not seeded automatically. To create
local-only development data, provide a password explicitly and run:

```bash
SEED_PASSWORD='use-a-local-password-at-least-12-characters' npm run db:seed
```

Never use the seed command or its local accounts in production.

## Configuration

Copy `.env.example` to a local environment configuration and set
`DATABASE_PATH` and `PORT` as needed. Production secrets and passwords must
be supplied through the deployment environment, not committed to the
repository.

The server exposes:

- `GET /healthz` for process health.
- `GET /readyz` for database readiness.

Authentication passwords are stored as bcrypt hashes. Login creates a
server-side session record containing only a SHA-256 token hash and an
eight-hour expiry. Logout invalidates the session.

A realistic AI-powered aviation recruitment portal created as a portfolio/testing project. It contains candidate and employer workflows and a Playwright automation suite covering UI, API, responsive, smoke and regression scenarios.

## Modules
- Candidate registration/login
- Candidate profile management
- Job search, filters and job details
- Job application workflow and duplicate-application validation
- Employer login/dashboard
- Employer job posting
- Employer application view
- REST API endpoints for auth, jobs, profiles and applications

## Automation stack
- Playwright Test
- JavaScript
- Node.js + Express
- HTML/CSS/JavaScript application
- Playwright APIRequestContext for API tests
- Chromium, Firefox and Mobile Chrome projects
- HTML report, screenshots, traces and videos on failures

## Run locally
```bash
npm install
npx playwright install
npm start
```

In another terminal:
```bash
npm test
npm run test:smoke
npm run test:regression
npm run report
```

## Runtime and production notes
- Test mode creates deterministic fixture accounts in a separate SQLite database. Production and development startup do not create those accounts automatically.
- Playwright runs with one worker because test reset operations intentionally share one test database. Test mode exposes a reset-only endpoint for deterministic isolation; it is not enabled outside `NODE_ENV=test`.
- SQLite persistence is appropriate for a single application instance. Use a managed relational database and shared storage before horizontally scaling the service.

## Suggested test strategy
1. Smoke: authentication, job search, apply, employer login.
2. Functional: filters, profile, job posting, duplicate application.
3. Regression: all UI + API tests across supported browsers.
4. Cross-browser: Chromium + Firefox + Mobile Chrome.
5. Negative: invalid login, protected APIs, invalid job/application operations.
6. Reporting: HTML report + trace/screenshot/video on failure.

## Resume framing
Use this as a project only if you actually build, test and understand it. Suggested title:
**AI Aviation Jobs — Aviation Recruitment Portal | Playwright + JavaScript**

Potential bullets after you have verified the numbers from your own execution:
- Built and automated end-to-end candidate and employer workflows covering authentication, job search, profile management, job applications and employer job posting using Playwright and JavaScript.
- Developed reusable Playwright test coverage for UI and REST APIs with multi-browser execution across Chromium, Firefox and mobile Chrome.
- Implemented smoke, functional, regression and negative test scenarios with HTML reporting, screenshots, traces and video capture for failed tests.
