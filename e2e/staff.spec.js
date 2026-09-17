import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open staff directory', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Staff Management', 'Staff');

  await expect(page.getByRole('heading', { name: 'Staff' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Teaching Staff', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Non-Teaching Staff' })).toBeVisible();
  await expect(page.locator('main').getByRole('button', { name: 'Add Staff' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All Staff' })).toBeVisible();
});
