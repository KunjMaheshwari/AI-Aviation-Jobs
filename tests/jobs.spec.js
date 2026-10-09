const { test, expect } = require('@playwright/test');

test.describe('Job Search', () => {
  test('@smoke user can search for Playwright jobs', async ({ page }) => {
    await page.goto('/#/jobs');
    await page.locator('#keyword').fill('Playwright');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('heading', { name: 'Senior QA Automation Engineer' })).toBeVisible();
    await expect(page.getByText('Playwright', { exact: true }).first()).toBeVisible();
  });

  test('location filter narrows results', async ({ page }) => {
    await page.goto('/#/jobs');
    await page.locator('#location').selectOption('Pune');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('heading', { name: 'QA Analyst' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Senior QA Automation Engineer' })).not.toBeVisible();
  });

  test('job detail page displays required information', async ({ page }) => {
    await page.goto('/#/jobs/JOB-1001');
    await expect(page.getByRole('heading', { name: 'Senior QA Automation Engineer' })).toBeVisible();
    await expect(page.getByText('SkyTech Aviation')).toBeVisible();
    await expect(page.getByText('₹12-18 LPA')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login as candidate to apply' })).toBeVisible();
  });
});
