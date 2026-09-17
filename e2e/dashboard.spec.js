import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav, openSidebar } from './helpers/auth.js';

test('Dashboard overview and shortcuts', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openSidebar(page);

  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to Dashboard' })).toContainText(
    /Presence|Bright Future|School/i
  );
  await expect(page.getByRole('banner').getByText(/School overview and quick stats/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible({ timeout: 15000 });
});
