import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open school setup branding on settings', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Settings');

  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText('School logo').first()).toBeVisible();
  await expect(
    page
      .getByText(/Shown on login, sidebar, and reports|Upload school logo|PNG, JPEG, or WebP/i)
      .first()
  ).toBeVisible();
  await expect(
    page.locator('main').getByText(/Administrator|In-charge|Attendance In-charge|Account/i).first()
  ).toBeVisible();
});
