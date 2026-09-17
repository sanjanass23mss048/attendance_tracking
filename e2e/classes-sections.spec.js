import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('View classes and sections', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Students', 'Classes & Sections');

  await expect(page.getByRole('heading', { name: 'Classes' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Total Classes')).toBeVisible();
  await expect(page.getByText('Total Sections')).toBeVisible();
  await expect(page.getByText('Total Students')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Class' })).toBeVisible();
  await expect(page.locator('main').getByText('LKG').first()).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole('button', { name: 'Sections', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Class Strength' })).toBeVisible();
});
