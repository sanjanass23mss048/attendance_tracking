import { test, expect } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD } from './helpers/auth.js';

test('Promote students and send promotion messages', async ({ page }) => {

  test.setTimeout(60000);

  // 1. OPEN WEBSITE
  await page.goto('/');

  // 2. LOGIN
  await page
    .getByRole('textbox', { name: 'Email' })
    .fill(E2E_EMAIL);

  await page
    .getByRole('textbox', { name: 'Password' })
    .fill(E2E_PASSWORD);

  await page
    .getByRole('button', { name: 'Sign in' })
    .click();

  // 3. GO TO DASHBOARD IF SHOWN
  const goToDashboard = page.getByRole('button', {
    name: 'Go to Dashboard'
  });

  if (await goToDashboard.isVisible().catch(() => false)) {
    await goToDashboard.click();
  }

  // Verify dashboard
  await expect(
    page.getByRole('heading', {
      name: 'Dashboard',
      exact: true
    })
  ).toBeVisible({ timeout: 15000 });

  // 4. OPEN MENU IF REQUIRED
  const openMenu = page.getByRole('button', {
    name: 'Open menu'
  });

  if (await openMenu.isVisible().catch(() => false)) {
    await openMenu.click();
  }

  // 5. OPEN ACADEMICS
  await page
    .getByRole('button', { name: 'Academics' })
    .click();

  // 6. OPEN STUDENTS
  await page
    .getByRole('button', {
      name: 'Students',
      exact: true
    })
    .click();

  // 7. OPEN PROMOTION
  await page
    .getByRole('button', {
      name: 'Promotion'
    })
    .click();

  // 8. SELECT PROMOTION TYPE
  await page
    .getByRole('button', {
      name: /Some students are demoted/
    })
    .click();

  // 9. SELECT STUDENT
  const studentCheckbox = page.getByRole('checkbox', {
    name: 'Aadhya Dhar Roll 2 · UKG-B'
  });

  await expect(studentCheckbox).toBeVisible({
    timeout: 10000
  });

  await studentCheckbox.check();

  await expect(studentCheckbox).toBeChecked();

  // 10. CONTINUE
  const continueButton = page.getByRole('button', {
    name: 'Continue to class assignment'
  });

  await expect(continueButton).toBeVisible();
  await expect(continueButton).toBeEnabled();

  await continueButton.click();

  // 11. AUTOMATED SHUFFLE
  const shuffleButton = page.getByRole('button', {
    name: 'Automated Shuffle'
  });

  await expect(shuffleButton).toBeVisible({
    timeout: 10000
  });

  await expect(shuffleButton).toBeEnabled();

  await shuffleButton.click();

  // 12. SEND PROMOTION MESSAGES
  const sendMessages = page.getByRole('button', {
    name: 'Send promotion messages'
  });

  await expect(sendMessages).toBeVisible({
    timeout: 10000
  });

  await expect(sendMessages).toBeEnabled();

  await sendMessages.click();

});