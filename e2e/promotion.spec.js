import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Promote students and send promotion messages', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Students', 'Promotion');

  await expect(page.getByRole('heading', { name: /Promotion/i }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page.getByText(/promot|demot|class & section|assign/i).first()
  ).toBeVisible();
});
