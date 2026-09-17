import { test, expect } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD } from './helpers/auth.js';

test('Dashboard overview and shortcuts', async ({ page }) => {

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
  // VERIFY SCHOOL LOGO AND HEADER
  // =====================================

  const openMenu = page.getByRole('button', {
    name: 'Open menu'
  });

  if (await openMenu.isVisible().catch(() => false)) {
    await openMenu.click();
  }

  const schoolBrand = page.getByRole('button', {
    name: 'Go to Dashboard'
  });

  await expect(schoolBrand).toBeVisible({
    timeout: 10000
  });

  await expect(schoolBrand).toContainText('St.mary');
  await expect(schoolBrand).toContainText('School Attendance');

  const schoolLogo = schoolBrand.locator('img[src*="/api/branding/logo"]');

  await expect(schoolLogo).toBeVisible();

  await expect.poll(async () => {
    return schoolLogo.evaluate((img) => img.naturalWidth);
  }).toBeGreaterThan(0);

  const pageHeader = page.getByRole('banner');

  await expect(
    pageHeader.getByRole('heading', {
      name: 'Dashboard',
      exact: true
    })
  ).toBeVisible();

  await expect(
    pageHeader.getByText('School overview and quick stats.')
  ).toBeVisible();


  // =====================================
  // VERIFY WELCOME AND HEADER
  // =====================================

  await expect(
    page.getByRole('heading', {
      name: /Welcome back/i
    })
  ).toBeVisible({
    timeout: 15000
  });

  await expect(
    page.getByText(/what's happening in your school today/i)
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: /Academic Year/
    })
  ).toBeVisible();


  // =====================================
  // VERIFY SHORTCUT CARDS
  // =====================================

  const shortcuts = [
    /Mark Attendance/,
    /Students View and manage/,
    /Leave Letters/,
    /Edit Approvals/,
    /Calendar View academic/,
    /Reports Explore attendance/,
    /Notify Send messages/,
    /Notices/
  ];

  for (const name of shortcuts) {
    await expect(
      page.locator('main').getByRole('button', { name })
    ).toBeVisible();
  }


  // =====================================
  // VERIFY ATTENDANCE OVERVIEW
  // =====================================

  await expect(
    page.getByRole('heading', {
      name: /Attendance Overview/i
    })
  ).toBeVisible();

  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous Day' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Date' })).toBeVisible();

  await expect(page.getByText('Total Students')).toBeVisible();
  await expect(page.getByText('Present').first()).toBeVisible();
  await expect(page.getByText('Absent').first()).toBeVisible();
  await expect(page.getByText('Overall Attendance')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'View Class-wise Report' })
  ).toBeVisible();


  // =====================================
  // SWITCH TO PREVIOUS DAY AND BACK
  // =====================================

  await page
    .locator('main')
    .getByRole('button', { name: 'Previous Day' })
    .click();

  await expect(page.getByText('Total Students')).toBeVisible();

  await page
    .locator('main')
    .getByRole('button', { name: 'Today' })
    .click();

  await expect(
    page.getByRole('heading', {
      name: /Attendance Overview/i
    })
  ).toBeVisible();


  // =====================================
  // OPEN MARK ATTENDANCE FROM DASHBOARD
  // =====================================

  await page
    .locator('main')
    .getByRole('button', { name: /Mark Attendance/ })
    .click();

  await expect(
    page.getByRole('heading', {
      name: 'Attendance'
    }).first()
  ).toBeVisible({
    timeout: 15000
  });


  // =====================================
  // RETURN TO DASHBOARD
  // =====================================

  await page
    .getByRole('button', {
      name: 'Dashboard',
      exact: true
    })
    .dispatchEvent('click');

  await expect(
    page.getByRole('heading', {
      name: /Welcome back/i
    })
  ).toBeVisible({
    timeout: 15000
  });


  // =====================================
  // OPEN CLASS-WISE REPORT
  // =====================================

  await page
    .getByRole('button', { name: 'View Class-wise Report' })
    .click();

  await expect(
    page.getByRole('heading', {
      name: 'Attendance History'
    }).first()
  ).toBeVisible({
    timeout: 15000
  });

});
