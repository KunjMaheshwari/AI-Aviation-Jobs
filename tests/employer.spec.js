const { test, expect } = require('@playwright/test');

test.describe('Employer Module', () => {
  test('@smoke employer can login and view dashboard', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel('Email').fill('employer@test.com');
    await page.getByLabel('Password').fill('Password@123');
    await page.getByLabel('Role').selectOption('employer');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/#\/employer$/);
    await expect(page.getByText('Post a Job')).toBeVisible();
    await expect(page.getByText('Candidate Applications')).toBeVisible();
  });

  test('employer can post a job', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel('Email').fill('employer@test.com');
    await page.getByLabel('Password').fill('Password@123');
    await page.getByLabel('Role').selectOption('employer');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.locator('#title').fill('QA Automation Engineer');
    await page.locator('#location').fill('Pune');
    await page.locator('#type').fill('Full-time');
    await page.locator('#experience').fill('2-4 years');
    await page.locator('#salary').fill('₹9-13 LPA');
    await page.locator('#skills').fill('Playwright, JavaScript');
    await page.locator('#description').fill('Automate aviation recruitment workflows.');
    await page.getByRole('button', { name: 'Publish job' }).click();
    await expect(page.getByText('Job published')).toBeVisible();
  });
});
