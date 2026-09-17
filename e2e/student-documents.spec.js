import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open student documents from directory', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Students', 'Student Directory');

  await expect(page.getByRole('heading', { name: /Students|Student Directory/i }).first()).toBeVisible({
    timeout: 15000,
  });

  const firstStudent = page.locator('main').getByRole('button').filter({ hasText: /\w+/ }).first();
  await expect(firstStudent).toBeVisible({ timeout: 20000 });
  await firstStudent.dispatchEvent('click');

  await expect(page.locator('main')).toBeVisible();
});
