import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open send notification composer', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Notify', 'Send Notification');

  await expect(page.getByRole('heading', { name: 'Send Notification' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Sudden Holiday|Entire Class|Select Classes/i).first()).toBeVisible({ timeout: 20000 });
});
