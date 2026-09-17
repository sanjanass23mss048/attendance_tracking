import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('View attendance history and class records', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Attendance History');

  await expect(page.getByRole('heading', { name: 'Attendance History' }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('main').getByRole('button', { name: 'Previous Day' })).toBeVisible();
  await expect(page.locator('main').getByRole('button', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Attendance Completion' }).first()).toBeVisible({
    timeout: 60000,
  });
});
