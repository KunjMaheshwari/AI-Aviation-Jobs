const { test, expect } = require('@playwright/test');

test.describe('Authentication', () => {
  test('@smoke candidate can login', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel('Email').fill('candidate@test.com');
    await page.getByLabel('Password').fill('Password@123');
    await page.getByLabel('Role').selectOption('candidate');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/#\/jobs$/);
    await expect(page.getByRole('heading', { name: /Build your career/ })).toBeVisible();
  });

  test('invalid credentials show validation message', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel('Email').fill('candidate@test.com');
    await page.getByLabel('Password').fill('WrongPassword');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email, password, or role')).toBeVisible();
  });
});
