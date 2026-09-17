import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open homework list', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Academics', 'Homework List');

  await expect(page.getByRole('heading', { name: 'Homework List' }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page.getByText(/Review homework assigned to your classes|homework/i).first()
  ).toBeVisible();
});
