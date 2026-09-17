import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open student bulk import from directory', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Students', 'Student Directory');

  await expect(page.getByRole('button', { name: 'Import Students' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Import Students' }).dispatchEvent('click');

  await expect(
    page.getByRole('heading', { name: /Import/i }).or(page.getByText(/import students|bulk|upload/i)).first()
  ).toBeVisible({ timeout: 15000 });
});
