import { test, expect } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD } from './helpers/auth.js';

test('successful login', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Email' }).fill(E2E_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
});
