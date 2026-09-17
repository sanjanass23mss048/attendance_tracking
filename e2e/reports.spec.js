import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open attendance reports', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Reports');

  await expect(page.getByRole('heading', { name: 'Reports' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Attendance Reports' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily attendance report' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Monthly summary PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open report/ }).first()).toBeVisible();
});
