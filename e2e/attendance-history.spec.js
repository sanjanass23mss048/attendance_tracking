import { test, expect } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD } from './helpers/auth.js';

test('View attendance history and class records', async ({ page }) => {

  test.setTimeout(120000);

  // =====================================
  // LOGIN
  // =====================================

  await page.goto('/');

  await page
    .getByRole('textbox', { name: 'Email' })
    .fill(E2E_EMAIL);

  await page
    .getByRole('textbox', { name: 'Password' })
    .fill(E2E_PASSWORD);

  await page
    .getByRole('button', { name: 'Sign in' })
    .click();


  // =====================================
  // GO TO DASHBOARD IF BUTTON APPEARS
  // =====================================

  const goToDashboard = page.getByRole('button', {
    name: 'Go to Dashboard'
  });

  if (await goToDashboard.isVisible().catch(() => false)) {
    await goToDashboard.click();
  }

  await expect(
    page.getByRole('heading', {
      name: 'Dashboard',
      exact: true
    })
  ).toBeVisible({
    timeout: 15000
  });


  // =====================================
  // OPEN SIDEBAR
  // =====================================

  const openMenu = page.getByRole('button', {
    name: 'Open menu'
  });

  if (await openMenu.isVisible().catch(() => false)) {
    await openMenu.click();
  }


  // =====================================
  // OPEN ATTENDANCE HISTORY
  // =====================================

  await page
    .getByRole('button', { name: 'Attendance', exact: true })
    .dispatchEvent('click');

  const historyMenu = page.getByRole('button', {
    name: 'Attendance History',
    exact: true
  });

  await expect(historyMenu).toBeVisible({
    timeout: 10000
  });

  await historyMenu.dispatchEvent('click');

  await expect(
    page.getByRole('heading', {
      name: 'Attendance History'
    }).first()
  ).toBeVisible({
    timeout: 15000
  });

  await expect(
    page.locator('main').getByText('View attendance records from previous days.')
  ).toBeVisible();


  // =====================================
  // VERIFY DATE CONTROLS AND FILTERS
  // =====================================

  await expect(
    page.locator('main').getByRole('button', { name: 'Previous Day' })
  ).toBeVisible();

  await expect(
    page.locator('main').getByRole('button', { name: 'Next Day' })
  ).toBeVisible();

  await expect(
    page.locator('main').getByRole('button', { name: 'Today' })
  ).toBeVisible();

  await expect(
    page.getByRole('heading', {
      name: 'Attendance Completion'
    })
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'View Unmarked Classes' })
  ).toBeVisible();

  await expect(
    page.getByRole('combobox', { name: 'Class' })
  ).toBeVisible();

  await expect(
    page.getByRole('combobox', { name: 'Attendance Status' })
  ).toBeVisible();

  await expect(
    page.getByRole('textbox', { name: 'Search Student' })
  ).toBeVisible();


  // =====================================
  // OPEN A PREVIOUS DAY'S RECORDS
  // =====================================

  const previousDay = page.locator('main').getByRole('button', {
    name: 'Previous Day'
  });

  const nextDay = page.locator('main').getByRole('button', {
    name: 'Next Day'
  });

  const selectedDate = page.locator('main').getByRole('button', {
    name: /^\d{1,2} \w+ \d{4}$/
  });
  const today = page.locator('main').getByRole('button', { name: 'Today' });

  await expect(selectedDate).toBeVisible();
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });

  let firstDate = (await selectedDate.innerText()).trim();

  await previousDay.click({ force: true });
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });

  if ((await selectedDate.innerText()).trim() === firstDate) {
    await today.click({ force: true });
    await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
    firstDate = (await selectedDate.innerText()).trim();
    await previousDay.click({ force: true });
    await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
  }

  await expect(selectedDate).not.toHaveText(firstDate, {
    timeout: 15000
  });

  const olderDate = (await selectedDate.innerText()).trim();

  await expect(
    page.getByText(/Historical day/i)
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: /Class / }).first()
  ).toBeVisible({
    timeout: 15000
  });


  // =====================================
  // RETURN TO THE DAY THAT HAS MARKED RECORDS
  // =====================================

  if (await nextDay.isEnabled()) {
    await nextDay.click({ force: true });
    await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });

    await expect(selectedDate).toHaveText(firstDate, {
      timeout: 15000
    });
  }


  // =====================================
  // FILTER BY CLASS LKG AND OPEN PREVIOUS RECORDS
  // =====================================

  await page
    .getByRole('combobox', { name: 'Class' })
    .selectOption('LKG');

  const lkgClass = page.getByRole('button', {
    name: /Class LKG-A/
  });

  await expect(lkgClass).toBeVisible({
    timeout: 15000
  });

  await lkgClass.dispatchEvent('click');

  await expect(
    page.locator('main').getByRole('heading', {
      name: /Class LKG-A/
    })
  ).toBeVisible({
    timeout: 15000
  });

  await expect(
    page.locator('main').getByText(/\d{1,2} \w+ 2026/).first()
  ).toBeVisible();

  await expect(
    page.locator('main').getByText(/Aarav Kapoor/)
  ).toBeVisible({
    timeout: 15000
  });


  // =====================================
  // GO BACK AND OPEN AN OLDER DAY AGAIN
  // =====================================

  await page
    .getByRole('button', { name: 'All classes' })
    .dispatchEvent('click');

  await expect(
    page.getByRole('heading', {
      name: 'Attendance Completion'
    })
  ).toBeVisible({
    timeout: 15000
  });

  await previousDay.click({ force: true });
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });

  await expect(selectedDate).toHaveText(olderDate, {
    timeout: 15000
  });

  await expect(
    page.getByRole('heading', {
      name: 'Attendance History'
    }).first()
  ).toBeVisible();

});
