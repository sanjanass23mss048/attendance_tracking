import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open transfer certificate requests', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Students', 'TC');

  await expect(page.getByRole('heading', { name: 'TC Management' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'TC Requests' })).toBeVisible();
  await expect(page.getByText(/Parent requests TC/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'New TC Request' })).toBeVisible();
  await expect(page.getByText(/Meera Varughese|STUDENT NAME/i).first()).toBeVisible();
});
