import { expect } from '@playwright/test';

function envOr(name, fallback) {
  const value = (process.env[name] || '').trim();
  return value || fallback;
}

/** App under test — local prod server by default (see playwright webServer). */
export const SCHOOL_URL = envOr('E2E_BASE_URL', 'http://127.0.0.1:4000/').replace(
  /\/?$/,
  '/'
);

/** Seeded Bright Future admin (server/prisma/seed.js). */
export const E2E_EMAIL = envOr('E2E_EMAIL', 'incharge@brightfuture.edu.in');
export const E2E_PASSWORD = envOr('E2E_PASSWORD', 'password123');

export async function loginAsAdmin(page) {
  const dashboard = page.getByRole('heading', { name: 'Dashboard', exact: true });
  const loginError = page.locator('form div').filter({
    hasText: /invalid|incorrect|failed|error|unable/i,
  });
  const changePassword = page
    .getByText('Change password', { exact: true })
    .or(page.getByRole('button', { name: 'Update password' }));
  const portalCrash = page.getByText(/Could not load the school portal/i);

  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: 'Email' }).waitFor({ timeout: 30000 });
    await page.getByRole('textbox', { name: 'Email' }).fill(E2E_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(E2E_PASSWORD);

    const loginResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/auth/login') && res.request().method() === 'POST',
      { timeout: 45000 }
    );

    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    let loginResponse = null;
    try {
      loginResponse = await loginResponsePromise;
    } catch {
      // Fall through — UI may still show an error or dashboard.
    }

    // Do NOT wait for / click sidebar "Go to Dashboard" (aria-label on brand).
    // That button is often off-viewport and is not a post-login CTA.

    try {
      await Promise.race([
        dashboard.first().waitFor({ state: 'visible', timeout: 45000 }),
        changePassword.first().waitFor({ state: 'visible', timeout: 45000 }),
        loginError.first().waitFor({ state: 'visible', timeout: 45000 }),
        portalCrash.waitFor({ state: 'visible', timeout: 45000 }),
      ]);
    } catch (error) {
      if (attempt === 2) {
        const status = loginResponse ? `${loginResponse.status()}` : 'no-response';
        const body = loginResponse
          ? await loginResponse.text().catch(() => '')
          : '';
        throw new Error(
          `Login did not reach Dashboard (API ${status}). ${body.slice(0, 300)}`,
          { cause: error }
        );
      }
      continue;
    }

    if (await portalCrash.isVisible().catch(() => false)) {
      throw new Error(
        'App crashed after login ("Could not load the school portal"). Check the local server console / browser errors.'
      );
    }

    if (await loginError.first().isVisible().catch(() => false)) {
      const message = (await loginError.first().textContent())?.trim() || 'Login failed';
      if (attempt === 2) throw new Error(message);
      continue;
    }

    if (await changePassword.first().isVisible().catch(() => false)) {
      throw new Error(
        'Login succeeded but account requires a password change before Dashboard is available.'
      );
    }

    await expect(dashboard.first()).toBeVisible({ timeout: 20000 });
    return;
  }
}

export async function openSidebar(page) {
  // Sidebar is off-canvas until hovered/pinned/opened — force it open for tests.
  const aside = page.locator('aside').first();
  if (await aside.count()) {
    await aside.evaluate((el) => {
      el.classList.remove('-translate-x-full');
      el.classList.add('translate-x-0');
    }).catch(() => {});
  }

  const pin = page.getByRole('button', { name: 'Pin sidebar' });
  if (await pin.count()) {
    await pin.dispatchEvent('click').catch(() => {});
  }

  const openMenu = page.getByRole('button', { name: 'Open menu' });
  if (await openMenu.isVisible().catch(() => false)) {
    await openMenu.click({ force: true }).catch(async () => {
      await openMenu.dispatchEvent('click');
    });
  }

  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'Dashboard', exact: true })
  ).toBeVisible({ timeout: 10000 });
}

export async function openNav(page, ...names) {
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
  if (await signIn.isVisible().catch(() => false)) {
    await loginAsAdmin(page);
  }

  await openSidebar(page);

  const nav = page.getByRole('navigation');
  for (const name of names) {
    const btn = nav.getByRole('button', { name, exact: true });
    await expect(btn.first()).toBeVisible({ timeout: 20000 });
    await btn.first().dispatchEvent('click');
  }
}
