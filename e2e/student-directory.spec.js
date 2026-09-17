import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Browse student directory', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Students', 'Student Directory');

  await expect(page.getByRole('heading', { name: 'Students' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Add Student' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import Students' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export PDF' })).toBeVisible();
  await expect(page.getByRole('searchbox').first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Student Name' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Aarav / }).first()).toBeVisible({ timeout: 20000 });
});
