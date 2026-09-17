import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open notices and holiday alerts', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Notify', 'Notices');

  await expect(
    page.getByRole('heading', { name: /Notifications|Notices/i }).first()
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText(/Alerts|holidays|announcements|attendance reminders|notification/i).first()
  ).toBeVisible();
});
