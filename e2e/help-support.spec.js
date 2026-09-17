import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open help and support', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Help & Support');

  await expect(page.getByRole('heading', { name: 'Support Center' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Need Help?' })).toBeVisible();
  await expect(page.getByText('8072180274').first()).toBeVisible();
  await expect(page.getByText('info@riobizsols.com')).toBeVisible();
  await expect(page.getByText(/Chat on WhatsApp/i)).toBeVisible();
});
