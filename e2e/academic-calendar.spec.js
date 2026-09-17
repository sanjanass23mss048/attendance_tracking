import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open academic calendar', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Academics', 'Academic Calendar');

  await expect(page.getByRole('heading', { name: 'Academic Calendar' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Calendar View' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'List View' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Legend' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upcoming Events' })).toBeVisible();
  await expect(page.getByText(/Weekly Holiday|Unit Test|Science Expo/i).first()).toBeVisible();
});
