import { test, expect } from '@playwright/test';
import { loginAsAdmin, openNav } from './helpers/auth.js';

test('Mark attendance and send messages', async ({ page }) => {

  test.setTimeout(180000);

  await loginAsAdmin(page);
  await openNav(page, 'Attendance', 'Mark Attendance');
  await expect(page.getByRole('button', { name: 'Load Students' })).toBeVisible({ timeout: 15000 });

  await expect(page.getByRole('button', { name: 'Load Students' })).toBeVisible({ timeout: 15000 });


  // =====================================
  // FIND AN UNLOCKED CLASS WITH PRESENT STUDENTS
  // Today's attendance is already locked for some classes
  // =====================================

  const classSelect = page.getByRole('combobox').first();
  const sectionSelect = page.getByRole('combobox').nth(1);
  const loadStudents = page.getByRole('button', {
    name: 'Load Students'
  });
  const submitAttendance = page.getByRole('button', {
    name: 'Submit',
    exact: true
  });
  const enabledPresent = page.locator('main').locator('button:enabled', { hasText: /^Present$/ });
  const lockedBanner = page.getByText('Attendance locked');

  const classValues = await classSelect
    .locator('option')
    .evaluateAll((options) => options.map((option) => option.value).filter(Boolean));

  let readyToMark = false;

  for (const classValue of classValues) {
    await classSelect.selectOption(classValue);
    await expect(classSelect).toHaveValue(classValue);

    const sectionValues = await sectionSelect
      .locator('option')
      .evaluateAll((options) => options.map((option) => option.value).filter(Boolean));

    for (const sectionValue of sectionValues) {
      try {
        await sectionSelect.selectOption(sectionValue, { timeout: 5000 });
      } catch {
        continue;
      }

      await expect(loadStudents).toBeEnabled();
      await loadStudents.click();
      await expect(submitAttendance).toBeVisible({ timeout: 15000 });

      let loadState = 'pending';
      try {
        await expect.poll(async () => {
          if (await lockedBanner.isVisible().catch(() => false)) return 'locked';
          if ((await enabledPresent.count()) > 0 && (await submitAttendance.isEnabled())) return 'ready';
          return 'pending';
        }, { timeout: 6000, intervals: [400, 700, 1000] }).not.toBe('pending');
        loadState = (await enabledPresent.count()) > 0 && (await submitAttendance.isEnabled())
          ? 'ready'
          : 'locked';
      } catch {
        loadState = (await lockedBanner.isVisible().catch(() => false)) ? 'locked' : 'pending';
      }

      if (loadState !== 'ready') {
        continue;
      }

      // Some classes flash unlocked, then lock. Wait and confirm it stays editable.
      await page.waitForTimeout(1500);
      if (await lockedBanner.isVisible().catch(() => false)) {
        continue;
      }
      if ((await enabledPresent.count()) === 0 || !(await submitAttendance.isEnabled())) {
        continue;
      }

      const toMark = Math.min(7, await enabledPresent.count());
      let markedHere = 0;
      for (let i = 0; i < toMark; i++) {
        const presentButton = enabledPresent.first();
        if (!(await presentButton.isEnabled().catch(() => false))) {
          break;
        }
        await presentButton.click({ force: true });
        markedHere++;
      }

      if (markedHere > 0 && (await submitAttendance.isEnabled())) {
        readyToMark = true;
        break;
      }
    }

    if (readyToMark) {
      break;
    }
  }

  expect(readyToMark).toBeTruthy();


  // =====================================
  // SUBMIT ATTENDANCE
  // =====================================

  await submitAttendance.scrollIntoViewIfNeeded();

  await expect(submitAttendance).toBeEnabled();

  await submitAttendance.click();


  // =====================================
  // SUBMIT PARENT MESSAGES
  // =====================================

  const submitMessages = page.getByRole('button', {
    name: /Submit Messages/
  });

  await expect(submitMessages).toBeVisible({
    timeout: 15000
  });

  await submitMessages.scrollIntoViewIfNeeded();

  await expect(submitMessages).toBeEnabled();

  await submitMessages.click();


  // =====================================
  // VERIFY SUCCESS
  // =====================================

  await expect(
    page.getByText(/messages sent/i).first()
  ).toBeVisible({
    timeout: 15000
  });

});