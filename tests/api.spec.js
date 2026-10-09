const { test, expect } = require('@playwright/test');

test.describe('API Contract Checks', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/test/reset');
  });

  async function login(request, email, role) {
    const response = await request.post('/api/auth/login', {
      data: { email, password: 'Password@123', role }
    });
    expect(response.status()).toBe(200);
    return response.headers()['set-cookie'].split(';')[0];
  }

  test('GET /api/jobs returns job collection', async ({ request }) => {
    const response = await request.get('/api/jobs');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('jobs');
    expect(Array.isArray(body.jobs)).toBeTruthy();
  });

  test('health and readiness endpoints report database availability', async ({ request }) => {
    expect((await request.get('/healthz')).status()).toBe(200);
    expect((await request.get('/readyz')).status()).toBe(200);
  });

  test('POST /api/auth/login establishes an HttpOnly session', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: { email: 'candidate@test.com', password: 'Password@123', role: 'candidate' } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).not.toHaveProperty('accessToken');
    expect(body.user.role).toBe('candidate');
    expect(response.headers()['set-cookie']).toContain('HttpOnly');
  });

  test('protected endpoint rejects unauthenticated request', async ({ request }) => {
    const response = await request.get('/api/profile');
    expect(response.status()).toBe(401);
  });

  test('GET /api/jobs/:id returns 404 for an unknown job', async ({ request }) => {
    const response = await request.get('/api/jobs/UNKNOWN');
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ message: 'Job not found' });
  });

  test('profile updates cannot change protected account fields', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: 'candidate@test.com', password: 'Password@123', role: 'candidate' } });
    const sessionCookie = login.headers()['set-cookie'].split(';')[0];
    const response = await request.put('/api/profile', {
      headers: { Cookie: sessionCookie },
      data: { location: 'Pune', role: 'employer', password: 'changed' }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.role).toBe('candidate');
    expect(body.user).not.toHaveProperty('password');
  });

  test('profile update rejects invalid experience values', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: 'candidate@test.com', password: 'Password@123', role: 'candidate' } });
    const sessionCookie = login.headers()['set-cookie'].split(';')[0];
    const response = await request.put('/api/profile', {
      headers: { Cookie: sessionCookie },
      data: { experience: -1 }
    });
    expect(response.status()).toBe(400);
  });

  test('employer only retrieves applications for owned jobs', async ({ request }) => {
    const employerCookie = await login(request, 'employer@test.com', 'employer');
    const otherEmployerCookie = await login(request, 'other-employer@test.com', 'employer');
    const candidateCookie = await login(request, 'candidate@test.com', 'candidate');

    const employerJob = await request.post('/api/jobs', {
      headers: { Cookie: employerCookie },
      data: { title: 'Employer A Job', location: 'Bengaluru', type: 'Full-time', description: 'A job owned by employer A.' }
    });
    const employerJobBody = await employerJob.json();
    const otherJob = await request.post('/api/jobs', {
      headers: { Cookie: otherEmployerCookie },
      data: { title: 'Employer B Job', location: 'Delhi', type: 'Full-time', description: 'A job owned by employer B.' }
    });
    const otherJobBody = await otherJob.json();

    await request.post(`/api/jobs/${employerJobBody.id}/apply`, { headers: { Cookie: candidateCookie } });
    await request.post(`/api/jobs/${otherJobBody.id}/apply`, { headers: { Cookie: candidateCookie } });

    const employerApplications = await request.get('/api/employer/applications', {
      headers: { Cookie: employerCookie }
    });
    expect(employerApplications.status()).toBe(200);
    const employerApplicationsBody = await employerApplications.json();
    expect(employerApplicationsBody.applications.some(item => item.job.id === employerJobBody.id)).toBeTruthy();

    const otherEmployerApplications = await request.get('/api/employer/applications', {
      headers: { Cookie: otherEmployerCookie }
    });
    expect(otherEmployerApplications.status()).toBe(200);
    const otherEmployerApplicationsBody = await otherEmployerApplications.json();
    expect(otherEmployerApplicationsBody.applications).toHaveLength(1);
    expect(otherEmployerApplicationsBody.applications[0].job.id).toBe(otherJobBody.id);
  });

  test('employer cannot update an application for another employer job', async ({ request }) => {
    const employerCookie = await login(request, 'employer@test.com', 'employer');
    const otherEmployerCookie = await login(request, 'other-employer@test.com', 'employer');
    const candidateCookie = await login(request, 'candidate@test.com', 'candidate');

    const jobResponse = await request.post('/api/jobs', {
      headers: { Cookie: employerCookie },
      data: { title: 'Private Employer Job', location: 'Bengaluru', type: 'Full-time', description: 'A private job.' }
    });
    const job = await jobResponse.json();
    await request.post(`/api/jobs/${job.id}/apply`, { headers: { Cookie: candidateCookie } });

    const applicationsResponse = await request.get('/api/employer/applications', {
      headers: { Cookie: employerCookie }
    });
    const application = (await applicationsResponse.json()).applications.find(item => item.job.id === job.id);
    const updateResponse = await request.patch(`/api/applications/${application.id}/status`, {
      headers: { Cookie: otherEmployerCookie },
      data: { status: 'Rejected' }
    });
    expect(updateResponse.status()).toBe(404);

    const ownerApplicationsResponse = await request.get('/api/employer/applications', {
      headers: { Cookie: employerCookie }
    });
    expect((await ownerApplicationsResponse.json()).applications.find(item => item.id === application.id).status).toBe('Applied');
  });

  test('candidate cannot perform employer application operations', async ({ request }) => {
    const candidateCookie = await login(request, 'candidate@test.com', 'candidate');
    const listResponse = await request.get('/api/employer/applications', {
      headers: { Cookie: candidateCookie }
    });
    expect(listResponse.status()).toBe(403);

    const updateResponse = await request.patch('/api/applications/APP-1001/status', {
      headers: { Cookie: candidateCookie },
      data: { status: 'Rejected' }
    });
    expect(updateResponse.status()).toBe(403);
  });

  test('logout invalidates the authenticated session', async ({ request }) => {
    const sessionCookie = await login(request, 'candidate@test.com', 'candidate');
    const logoutResponse = await request.post('/api/auth/logout', {
      headers: { Cookie: sessionCookie }
    });
    expect(logoutResponse.status()).toBe(204);
    const profileResponse = await request.get('/api/profile', {
      headers: { Cookie: sessionCookie }
    });
    expect(profileResponse.status()).toBe(401);
  });

  test('registration never creates an employer account', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        firstName: 'New',
        lastName: 'User',
        email: 'new-user@test.com',
        password: 'Strong-password-123',
        role: 'employer'
      }
    });
    expect(response.status()).toBe(400);
  });

  test('cookie-authenticated state changes reject cross-origin requests', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: { email: 'candidate@test.com', password: 'Password@123', role: 'candidate' }
    });
    const sessionCookie = loginResponse.headers()['set-cookie'].split(';')[0];
    const response = await request.post('/api/jobs/JOB-1001/apply', {
      headers: {
        Cookie: sessionCookie,
        Origin: 'https://attacker.example'
      },
      data: {}
    });
    expect(response.status()).toBe(403);
    const applicationsResponse = await request.get('/api/applications/me', {
      headers: { Cookie: sessionCookie }
    });
    expect((await applicationsResponse.json()).applications.some(item => item.jobId === 'JOB-1001')).toBeFalsy();
  });
});
