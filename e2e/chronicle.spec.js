import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open chronicle poster builder', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Notify', 'Chronicle');

  await expect(page.getByRole('heading', { name: 'Create Chronicle Poster' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/School logo from branding|St\.mary/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'My Chronicles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Poster' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live Preview' })).toBeVisible();
});
