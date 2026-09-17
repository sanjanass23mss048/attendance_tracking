import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open notices and holiday alerts', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Notify', 'Notices');

  await expect(page.getByRole('heading', { name: 'Notifications' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Alerts, holidays, and attendance reminders/i).first()).toBeVisible();
  await expect(page.locator('main').getByRole('button', { name: 'Send Notification' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Holidays' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Holiday:/ }).first()).toBeVisible();
});
