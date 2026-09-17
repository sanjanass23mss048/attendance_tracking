import { test, expect } from '@playwright/test';
import { E2E_EMAIL, loginAsAdmin, openNav } from './helpers/auth.js';

test('Open school settings and branding', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Settings');

  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Account and notification preferences/i).first()).toBeVisible();
  await expect(page.getByText('School logo').first()).toBeVisible();
  await expect(page.getByText(new RegExp(E2E_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TC Configuration' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Configuration' })).toBeVisible();
});
