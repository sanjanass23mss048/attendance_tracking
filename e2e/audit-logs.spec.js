import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open audit logs', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Staff Management', 'Audit Logs');

  await expect(page.getByRole('heading', { name: 'Audit Logs' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Who did what across attendance/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply filters' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  await expect(page.getByText(/LOGIN|Niranjan/i).first()).toBeVisible();
});
