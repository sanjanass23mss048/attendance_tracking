import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('View classes and sections', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Students', 'Classes & Sections');

  await expect(page.getByRole('heading', { name: /Classes/i }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText(/Total Classes|Total Sections|Class/i).first()).toBeVisible();
});
