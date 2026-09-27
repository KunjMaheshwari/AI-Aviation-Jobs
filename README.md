# AI Aviation Jobs — Playwright JavaScript Testing Project

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

## Demo accounts
Candidate: `candidate@test.com` / `Password@123`
Employer: `employer@test.com` / `Password@123`

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
