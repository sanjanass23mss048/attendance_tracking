import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open transfer certificate requests', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Students', 'TC');

  await expect(page.getByRole('heading', { name: /TC Management|TC Requests|Transfer/i }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByRole('button', { name: /New TC Request|New Request|Create/i }).first()).toBeVisible({
    timeout: 15000,
  });
});
