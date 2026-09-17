import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Upload and track leave letters', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Leave Letters');

  await expect(page.getByRole('heading', { name: 'Leave Letters' }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText(/leave letter/i).first()).toBeVisible();
});
