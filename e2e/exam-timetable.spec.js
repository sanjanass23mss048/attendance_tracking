import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open exam timetable builder', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Academics', 'Exam Timetable');

  await expect(page.getByRole('heading', { name: 'Exam Timetable' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Create and publish unit tests/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Examination Details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exam Session' }).first()).toBeVisible();
  await expect(page.getByText(/LKG/).first()).toBeVisible({ timeout: 20000 });
});
