import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Manage subjects syllabus and teachers', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Academics', 'Subjects');

  await expect(page.getByRole('heading', { name: 'Subjects' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('main').getByText(/Manage syllabus, books and teachers/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Subject' })).toBeVisible();
  await expect(page.getByRole('button', { name: /English/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Syllabus', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Teachers Assigned' })).toBeVisible();
});
