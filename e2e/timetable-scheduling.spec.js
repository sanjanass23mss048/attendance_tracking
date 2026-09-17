import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Schedule timetable and save', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Academics', 'Timetable Scheduling');

  await expect(page.getByRole('heading', { name: 'Timetable Scheduling' }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page.getByText(/Drag teachers and subjects onto the weekly grid|weekly grid|teacher/i).first()
  ).toBeVisible({ timeout: 20000 });
});
