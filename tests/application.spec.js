const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/#/login');
  await page.getByLabel('Email').fill('candidate@test.com');
  await page.getByLabel('Password').fill('Password@123');
  await page.getByLabel('Role').selectOption('candidate');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/#\/jobs$/);
}

test.describe('Candidate Application Flow', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/test/reset');
  });

  test('@smoke candidate can apply for a job and see it in applications', async ({ page }) => {
    await login(page);
    await page.goto('/#/jobs/JOB-1001');
    await page.getByRole('button', { name: 'Apply now' }).click();
    await expect(page.getByText('Application submitted successfully.')).toBeVisible();
    await page.goto('/#/applications');
    await expect(page.getByRole('heading', { name: 'Senior QA Automation Engineer' })).toBeVisible();
  });

  test('duplicate application is prevented', async ({ page }) => {
    await login(page);
    await page.goto('/#/jobs/JOB-1002');
    await page.getByRole('button', { name: 'Apply now' }).click();
    await expect(page.getByText('Application submitted successfully.')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Apply now' }).click();
    await expect(page.getByText('already applied')).toBeVisible();
  });
});
