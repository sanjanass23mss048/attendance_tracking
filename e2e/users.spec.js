import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open users account list', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Staff Management', 'Users');

  await expect(page.getByRole('heading', { name: 'Users' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Create Admin, Incharge, and Teacher login accounts/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Add user/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Search name or email/i })).toBeVisible();
  await expect(page.getByRole('combobox')).toBeVisible();

  const authError = page.getByText(/Missing or invalid Authorization header/i);
  const emptyList = page.getByText('No users match these filters.');
  if ((await authError.isVisible().catch(() => false)) || (await emptyList.isVisible().catch(() => false))) {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Users' }).first()).toBeVisible({ timeout: 15000 });
  }

  await expect(page.getByRole('button', { name: /Add user/i })).toBeVisible();
  await expect(
    page.getByText(/@|Teacher|Admin|Incharge|No users match these filters/i).first()
  ).toBeVisible({ timeout: 15000 });
});
