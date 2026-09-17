import { test, expect } from '@playwright/test';

test('Open forgot password and return to sign in', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: /Forgot password/i }).click();

  await expect(page).toHaveURL(/forgot-password/);
  await expect(page.getByRole('heading', { name: /Forgot your password/i })).toBeVisible();
  await expect(page.getByText(/send a reset link/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();

  await page.getByRole('link', { name: /Back to sign in/i }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
