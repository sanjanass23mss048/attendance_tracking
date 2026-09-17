import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open attendance intelligence and follow-up', async ({ page }) => {
  test.setTimeout(180000);
  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Intelligence & Follow-up');

  // Page may sit on "Analysing attendance…" while the API loads.
  await expect(
    page.getByText(/Analysing attendance|Attendance Intelligence|Long absences|Follow-up/i).first()
  ).toBeVisible({ timeout: 30000 });

  await expect(
    page.getByRole('heading', { name: /Attendance Intelligence/i }).or(
      page.getByText(/Long-Term Absentees|Parent Meetings|Follow-up Queue/i)
    ).first()
  ).toBeVisible({ timeout: 120000 });
});
