import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open teacher panel', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Academics', 'Assign Homework');

  await expect(page.getByRole('heading', { name: 'Teacher Panel' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('banner').getByText(/Assign homework and manage class and exam timetables/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assign Homework' }).first()).toBeVisible();
});
