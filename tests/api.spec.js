const { test, expect } = require('@playwright/test');

test.describe('API Contract Checks', () => {
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
});
