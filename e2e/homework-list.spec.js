import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open homework list', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Academics', 'Homework List');

  await expect(page.getByRole('heading', { name: 'Homework List' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Assignments you have given to your classes/i).first()).toBeVisible();
  await expect(page.locator('main').getByRole('button', { name: 'Assign Homework' })).toBeVisible();
  await expect(
    page.getByText(/No homework assigned yet|homework/i).first()
  ).toBeVisible();
});
