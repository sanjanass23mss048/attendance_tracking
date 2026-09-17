import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open attendance intelligence and follow-up', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Intelligence & Follow-up');

  await expect(
    page.getByRole('heading', { name: 'Attendance Intelligence' })
  ).toBeVisible({ timeout: 45000 });

  await expect(page.getByText(/Long absences, leave patterns, parent meetings/i).first()).toBeVisible();
  await expect(page.getByText('Long-Term Absentees').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Parent Meetings', exact: true })).toBeVisible();
  await expect(page.getByText('Attendance Patterns').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Long Absence Alerts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Follow-up Queue' })).toBeVisible();
});
