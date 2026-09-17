import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open teacher panel assign homework', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Academics', 'Assign Homework');

  await expect(page.getByRole('heading', { name: 'Assign Homework' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Teacher Panel' })).toBeVisible();
  await expect(page.getByText(/Select Class \/ Section/i)).toBeVisible();
  await expect(page.getByText('Subject').first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Chapter 5 worksheet|Title/i }).or(page.getByPlaceholder(/worksheet|title/i))).toBeVisible();
  await expect(page.locator('main').getByRole('button', { name: 'Assign Homework' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
});
