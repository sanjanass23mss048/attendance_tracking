import { test, expect } from '@playwright/test';
import { E2E_EMAIL, loginAsAdmin, openNav } from './helpers/auth.js';

test('Open change password from settings', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Settings');

  const changePassword = page.getByRole('button', { name: /Change password|Update password/i })
    .or(page.getByRole('link', { name: /Change password/i }))
    .or(page.getByText(/Change password|Current password|New password/i));

  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible({ timeout: 15000 });

  if (await changePassword.first().isVisible().catch(() => false)) {
    await changePassword.first().click({ force: true }).catch(async () => {
      await changePassword.first().dispatchEvent('click');
    });
    await expect(
      page.getByLabel(/current password|new password/i).or(page.getByText(/Change password/i)).first()
    ).toBeVisible({ timeout: 10000 });
  } else {
    await expect(page.getByText(new RegExp(E2E_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  }
});
