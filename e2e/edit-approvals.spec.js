import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Review edit approvals for locked attendance', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Edit Approvals');

  await expect(page.getByRole('heading', { name: 'Edit Approvals' }).first()).toBeVisible({
    timeout: 15000,
  });

  await expect(page.getByText(/WhatsApp-only approval/i)).toBeVisible();
  await expect(
    page.getByText(/Approve or deny only from the WhatsApp message/i)
  ).toBeVisible();

  const emptyState = page.getByText(/No pending edit requests/i);
  const requestList = page.getByText(/pending request/i);
  await expect(emptyState.or(requestList).first()).toBeVisible({ timeout: 15000 });
});
