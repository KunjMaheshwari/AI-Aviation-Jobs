const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ request }) => {
  await request.post('/api/test/reset');
});

test('candidate can update profile', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByLabel('Email').fill('candidate@test.com');
  await page.getByLabel('Password').fill('Password@123');
  await page.getByLabel('Role').selectOption('candidate');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/#\/jobs$/);
  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { name: 'Candidate Profile' })).toBeVisible();
  await page.getByLabel('Location').fill('Pune');
  await page.getByLabel(/Skills/).fill('Playwright, JavaScript, REST Assured');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile updated.')).toBeVisible();
});
