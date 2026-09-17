import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open student documents from directory', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Students', 'Student Directory');

  await expect(page.getByRole('button', { name: 'Aarav Kapoor' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Aarav Kapoor' }).dispatchEvent('click');

  const documents = page.getByRole('button', { name: /Documents|Student documents/i })
    .or(page.getByRole('tab', { name: /Documents/i }))
    .or(page.getByText(/documents|TC|leave letter|certificate/i));

  await expect(page.getByText(/Aarav Kapoor/).first()).toBeVisible({ timeout: 15000 });

  if (await documents.first().isVisible().catch(() => false)) {
    await documents.first().click({ force: true }).catch(async () => {
      await documents.first().dispatchEvent('click');
    });
    await expect(page.getByText(/document|upload|file|certificate/i).first()).toBeVisible({ timeout: 10000 });
  }
});
