import { test, expect } from '@playwright/test';
import { E2E_EMAIL } from './helpers/auth.js';

test('invalid password login', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Email' }).fill(E2E_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill('1234567789');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText(/invalid|incorrect|wrong|credentials/i)).toBeVisible();
});
