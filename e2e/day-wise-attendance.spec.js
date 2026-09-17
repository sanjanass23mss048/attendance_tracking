import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open day-wise attendance from history', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Attendance History');

  await expect(page.getByRole('heading', { name: 'Attendance History' }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('main').getByRole('button', { name: 'Previous Day' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Class' }).or(page.locator('main select').first())).toBeVisible({
    timeout: 60000,
  });
});
