import { test, expect } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD } from './helpers/auth.js';

test('Schedule timetable and save', async ({ page }) => {

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
  // OPEN TIMETABLE SCHEDULING
  // =====================================

  await page
    .getByRole('button', { name: 'Academics' })
    .click({ force: true });

  const timetableMenu = page.getByRole('button', {
    name: 'Timetable Scheduling',
    exact: true
  });

  await expect(timetableMenu).toBeVisible({
    timeout: 10000
  });

  await timetableMenu.dispatchEvent('click');

  await expect(
    page.getByRole('heading', {
      name: 'Timetable Scheduling'
    }).first()
  ).toBeVisible({
    timeout: 15000
  });

  await expect(
    page.locator('main').getByText(/Drag a teacher onto the weekly grid/i)
  ).toBeVisible();


  // =====================================
  // WAIT FOR TEACHERS AND SELECT LKG-A
  // =====================================

  const teacher = page.locator('main').locator('button[draggable="true"]').first();

  await expect(async () => {
    if (await page.getByText('No teachers found').isVisible().catch(() => false)) {
      await timetableMenu.dispatchEvent('click');
    }

    await expect(teacher).toBeVisible();
  }).toPass({
    timeout: 45000
  });

  const classSelect = page.getByRole('combobox', { name: 'Class' });
  const sectionSelect = page.getByRole('combobox', { name: 'Section' });

  await expect(classSelect).toBeEnabled({
    timeout: 15000
  });

  await classSelect.selectOption('LKG');
  await sectionSelect.selectOption('A');

  const timetableGrid = page.getByRole('table');
  await expect(timetableGrid).toBeVisible({
    timeout: 15000
  });

  await expect(page.getByRole('cell', { name: 'Mon' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Tue' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Wed' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sat' })).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'Add Period' })
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'View Settings' })
  ).toBeVisible();


  // =====================================
  // DROP A TEACHER ON THE FIRST EMPTY SLOT
  // =====================================

  const emptySlot = page.getByRole('cell', { name: 'Drop here' }).first();

  await expect(emptySlot).toBeVisible({
    timeout: 10000
  });

  await teacher.dragTo(emptySlot, {
    force: true
  });


  // =====================================
  // SAVE TIMETABLE
  // =====================================

  const saveTimetable = page.getByRole('button', {
    name: 'Save Timetable'
  });

  await expect(saveTimetable).toBeEnabled();
  await saveTimetable.dispatchEvent('click');


  // =====================================
  // VERIFY SUCCESS
  // =====================================

  await expect(
    page.getByText(/Timetable for Class LKG-A saved successfully/i)
  ).toBeVisible({
    timeout: 15000
  });

});
