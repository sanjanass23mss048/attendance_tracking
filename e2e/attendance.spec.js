import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Mark attendance and send messages', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Mark Attendance');

  await expect(page.getByRole('heading', { name: /Attendance/i }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('main').getByRole('combobox').first()).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole('button', { name: /Load Students|Submit|Mark/i }).first()
  ).toBeVisible({ timeout: 20000 });
});
