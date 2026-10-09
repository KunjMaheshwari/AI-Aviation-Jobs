const { test, expect } = require('@playwright/test');

test.describe('API Contract Checks', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/test/reset');
  });

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
});
