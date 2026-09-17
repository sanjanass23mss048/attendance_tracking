import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Upload and track leave letters', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Leave Letters');

  await expect(page.getByRole('heading', { name: 'Leave Letters' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Class teachers upload and track leave letters/i).first()).toBeVisible();

  const classSelect = page.locator('main').getByRole('combobox').first();
  await expect(classSelect).toBeEnabled({ timeout: 20000 });

  const studentPicker = page.getByRole('button', { name: /Aarav Kapoor|Select student/ }).first();
  await expect(studentPicker).toBeVisible({ timeout: 15000 });

  const selectStudent = page.getByRole('button', { name: 'Select student' });
  if (await selectStudent.isVisible().catch(() => false)) {
    await selectStudent.click();
    await page.getByText(/Aarav Kapoor/).first().click();
  }

  await expect(page.getByRole('heading', { name: 'Upload Leave Letter' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Choose file' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload Leave Letter' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leave letter submissions' })).toBeVisible();
});
