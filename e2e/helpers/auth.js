import { expect } from '@playwright/test';

/** Deployed school under test — override with E2E_BASE_URL in CI / local .env */
export const SCHOOL_URL = (
  process.env.E2E_BASE_URL ||
  'https://st-mary.rioassetmanagement.info/'
).replace(/\/?$/, '/');

export const E2E_EMAIL = process.env.E2E_EMAIL || 'niranjwn123@gmail.com';
export const E2E_PASSWORD = process.env.E2E_PASSWORD || 'Initial2';

export async function loginAsAdmin(page) {
  const dashboard = page.getByRole('heading', { name: 'Dashboard', exact: true });

  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Email' }).waitFor({ timeout: 20000 });
    await page.getByRole('textbox', { name: 'Email' }).fill(E2E_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    try {
      await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeHidden({
        timeout: 25000,
      });

      if (!(await dashboard.first().isVisible().catch(() => false))) {
        const goToDashboard = page.getByRole('button', { name: 'Go to Dashboard' }).first();
        if (await goToDashboard.isVisible().catch(() => false)) {
          await goToDashboard.click();
        }
      }

      await expect(dashboard.first()).toBeVisible({ timeout: 15000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

export async function openSidebar(page) {
  const sidebarNav = page.getByRole('navigation').getByRole('button', { name: 'Dashboard', exact: true });
  if (await sidebarNav.isVisible().catch(() => false)) {
    return;
  }

  const openMenu = page.getByRole('button', { name: 'Open menu' });
  if (await openMenu.isVisible().catch(() => false)) {
    await openMenu.click({ force: true });
  }
}

export async function openNav(page, ...names) {
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
  if (await signIn.isVisible().catch(() => false)) {
    await loginAsAdmin(page);
  }

  await openSidebar(page);

  for (const name of names) {
    await page.getByRole('button', { name, exact: true }).dispatchEvent('click');
  }
}
