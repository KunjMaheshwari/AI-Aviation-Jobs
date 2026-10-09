const { test, expect } = require('@playwright/test');

test.setTimeout(60000);
async function login(page, { email, password, role }) {
  await page.goto('/#/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Role').selectOption(role);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/#\/jobs$/); // candidate landing page
  return page;
}

// Helper to login as employer
async function loginEmployer(page) {
  await page.goto('/#/login');
  await page.getByLabel('Email').fill('employer@test.com');
  await page.getByLabel('Password').fill('Password@123');
  await page.getByLabel('Role').selectOption('employer');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/#\/employer$/);
  return page;
}

// ---- Candidate UI Tests ----

test.describe('Candidate UI', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/test/reset');
  });

  test('candidate can logout and is redirected to login', async ({ page }) => {
    await login(page, {
      email: 'candidate@test.com',
      password: 'Password@123',
      role: 'candidate',
    });
    const logoutBtn = page.getByRole('button', { name: 'Logout' });
    await logoutBtn.click();
    await expect(page).toHaveURL(/#\/login$/);
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test('logout persists after page refresh', async ({ page }) => {
    await login(page, {
      email: 'candidate@test.com',
      password: 'Password@123',
      role: 'candidate',
    });
    await page.reload();
    await expect(page).toHaveURL(/#\/jobs$/);
    const logoutBtn = page.getByRole('button', { name: 'Logout' });
    await logoutBtn.click();
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('search with no matching jobs shows no jobs message', async ({ page }) => {
    await page.goto('/#/jobs');
    await page.locator('#keyword').fill('ZXYNonExistentJob');
    await page.getByRole('button', { name: 'Search' }).click();
    const noJobsMsg = page.locator('.empty');
    await expect(noJobsMsg).toHaveText('No jobs found.');
  });
});

// ---- Employer UI Tests ----

test.describe('Employer UI', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/test/reset');
  });

  test('employer can view candidate applications list after a candidate applies', async ({ page, browser }) => {
    // Candidate applies to a job
    const candidatePage = await browser.newPage();
    await login(candidatePage, {
      email: 'candidate@test.com',
      password: 'Password@123',
      role: 'candidate',
    });
    await candidatePage.goto('/#/jobs/JOB-1001');
    await candidatePage.getByRole('button', { name: 'Apply now' }).click();
    await expect(candidatePage.getByText('Application submitted successfully.')).toBeVisible();
    await candidatePage.close();

    // Employer logs in
    const employerPage = await browser.newPage();
    await loginEmployer(employerPage);
    await expect(employerPage.getByText('Candidate Applications')).toBeVisible();
    await expect(employerPage.getByText('Aarav Sharma', { exact: true }).first()).toBeVisible();
    await expect(employerPage.getByText('Senior QA Automation Engineer')).toBeVisible();
    await expect(employerPage.getByText('Applied')).toBeVisible();
    await employerPage.close();
  });
});
