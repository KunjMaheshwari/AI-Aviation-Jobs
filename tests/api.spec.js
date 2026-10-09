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
    return (await response.json()).accessToken;
  }

  test('GET /api/jobs returns job collection', async ({ request }) => {
    const response = await request.get('/api/jobs');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('jobs');
    expect(Array.isArray(body.jobs)).toBeTruthy();
  });

  test('POST /api/auth/login returns access token', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: { email: 'candidate@test.com', password: 'Password@123', role: 'candidate' } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.role).toBe('candidate');
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
    const { accessToken } = await login.json();
    const response = await request.put('/api/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { location: 'Pune', role: 'employer', password: 'changed' }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.role).toBe('candidate');
    expect(body.user).not.toHaveProperty('password');
  });

  test('profile update rejects invalid experience values', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: 'candidate@test.com', password: 'Password@123', role: 'candidate' } });
    const { accessToken } = await login.json();
    const response = await request.put('/api/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { experience: -1 }
    });
    expect(response.status()).toBe(400);
  });

  test('employer only retrieves applications for owned jobs', async ({ request }) => {
    const employerToken = await login(request, 'employer@test.com', 'employer');
    const otherEmployerToken = await login(request, 'other-employer@test.com', 'employer');
    const candidateToken = await login(request, 'candidate@test.com', 'candidate');

    const employerJob = await request.post('/api/jobs', {
      headers: { Authorization: `Bearer ${employerToken}` },
      data: { title: 'Employer A Job', location: 'Bengaluru', type: 'Full-time', description: 'A job owned by employer A.' }
    });
    const employerJobBody = await employerJob.json();
    const otherJob = await request.post('/api/jobs', {
      headers: { Authorization: `Bearer ${otherEmployerToken}` },
      data: { title: 'Employer B Job', location: 'Delhi', type: 'Full-time', description: 'A job owned by employer B.' }
    });
    const otherJobBody = await otherJob.json();

    await request.post(`/api/jobs/${employerJobBody.id}/apply`, { headers: { Authorization: `Bearer ${candidateToken}` } });
    await request.post(`/api/jobs/${otherJobBody.id}/apply`, { headers: { Authorization: `Bearer ${candidateToken}` } });

    const employerApplications = await request.get('/api/employer/applications', {
      headers: { Authorization: `Bearer ${employerToken}` }
    });
    expect(employerApplications.status()).toBe(200);
    const employerApplicationsBody = await employerApplications.json();
    expect(employerApplicationsBody.applications.some(item => item.job.id === employerJobBody.id)).toBeTruthy();

    const otherEmployerApplications = await request.get('/api/employer/applications', {
      headers: { Authorization: `Bearer ${otherEmployerToken}` }
    });
    expect(otherEmployerApplications.status()).toBe(200);
    const otherEmployerApplicationsBody = await otherEmployerApplications.json();
    expect(otherEmployerApplicationsBody.applications).toHaveLength(1);
    expect(otherEmployerApplicationsBody.applications[0].job.id).toBe(otherJobBody.id);
  });

  test('employer cannot update an application for another employer job', async ({ request }) => {
    const employerToken = await login(request, 'employer@test.com', 'employer');
    const otherEmployerToken = await login(request, 'other-employer@test.com', 'employer');
    const candidateToken = await login(request, 'candidate@test.com', 'candidate');

    const jobResponse = await request.post('/api/jobs', {
      headers: { Authorization: `Bearer ${employerToken}` },
      data: { title: 'Private Employer Job', location: 'Bengaluru', type: 'Full-time', description: 'A private job.' }
    });
    const job = await jobResponse.json();
    await request.post(`/api/jobs/${job.id}/apply`, { headers: { Authorization: `Bearer ${candidateToken}` } });

    const applicationsResponse = await request.get('/api/employer/applications', {
      headers: { Authorization: `Bearer ${employerToken}` }
    });
    const application = (await applicationsResponse.json()).applications.find(item => item.job.id === job.id);
    const updateResponse = await request.patch(`/api/applications/${application.id}/status`, {
      headers: { Authorization: `Bearer ${otherEmployerToken}` },
      data: { status: 'Rejected' }
    });
    expect(updateResponse.status()).toBe(404);

    const ownerApplicationsResponse = await request.get('/api/employer/applications', {
      headers: { Authorization: `Bearer ${employerToken}` }
    });
    expect((await ownerApplicationsResponse.json()).applications.find(item => item.id === application.id).status).toBe('Applied');
  });

  test('candidate cannot perform employer application operations', async ({ request }) => {
    const candidateToken = await login(request, 'candidate@test.com', 'candidate');
    const listResponse = await request.get('/api/employer/applications', {
      headers: { Authorization: `Bearer ${candidateToken}` }
    });
    expect(listResponse.status()).toBe(403);

    const updateResponse = await request.patch('/api/applications/APP-1001/status', {
      headers: { Authorization: `Bearer ${candidateToken}` },
      data: { status: 'Rejected' }
    });
    expect(updateResponse.status()).toBe(403);
  });
});
