import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth.js';

test('successful login', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
});
