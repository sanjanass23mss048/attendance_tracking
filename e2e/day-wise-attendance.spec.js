import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Open day-wise attendance from history', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Attendance History');

  await expect(page.getByRole('heading', { name: 'Attendance History' }).first()).toBeVisible({ timeout: 15000 });

  const previousDay = page.locator('main').getByRole('button', { name: 'Previous Day' });
  const selectedDate = page.locator('main').getByRole('button', { name: /^\d{1,2} \w+ \d{4}$/ });
  const today = page.locator('main').getByRole('button', { name: 'Today' });

  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
  let firstDate = (await selectedDate.innerText()).trim();

  await previousDay.click({ force: true });
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });

  if ((await selectedDate.innerText()).trim() === firstDate) {
    await today.click({ force: true });
    await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
    firstDate = (await selectedDate.innerText()).trim();
    await previousDay.click({ force: true });
  }

  await expect(selectedDate).not.toHaveText(firstDate, { timeout: 15000 });
  await expect(page.getByText(/Historical day/i)).toBeVisible();
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });

  await page.getByRole('combobox', { name: 'Class' }).selectOption('LKG');
  await expect(page.getByRole('button', { name: /Class LKG/ }).first()).toBeVisible({ timeout: 20000 });
});
