# Test Scenario Inventory

## Authentication
- Valid candidate login
- Valid employer login
- Invalid password
- Invalid role
- Empty required fields
- Session persistence
- Logout

## Candidate
- Search jobs by keyword
- Filter by location/type
- View job details
- Apply to a job
- Prevent duplicate application
- View application status
- Update profile
- Validate profile fields

## Employer
- Employer dashboard access
- Employer cannot access candidate-only operations
- Post job with required fields
- Reject incomplete job posting
- View candidate applications
- Update application status

## API
- GET jobs: 200 + schema basics
- GET unknown job: 404
- Login success/failure: 200/401
- Protected endpoint without token: 401
- Candidate applying to job: 201
- Duplicate application: 409
- Invalid application status: 400

## Non-functional
- Cross-browser
- Mobile responsive layout
- Accessibility smoke checks using semantic roles/labels
- Trace/screenshot/video diagnostics
- CI execution
