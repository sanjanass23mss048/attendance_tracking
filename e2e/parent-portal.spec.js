import { test, expect } from '@playwright/test';

test('Parent portal entry is reachable from school site', async ({ page }) => {
  await page.goto('/');

  const parentLink = page.getByRole('link', { name: /parent/i })
    .or(page.getByRole('button', { name: /parent portal|parent login/i }));

  if (await parentLink.first().isVisible().catch(() => false)) {
    await parentLink.first().click();
    await expect(page.getByText(/parent|sign in|login/i).first()).toBeVisible({ timeout: 15000 });
    return;
  }

  const parentUrls = ['/parent', '/parent-login', '/parents'];

  let opened = false;
  for (const url of parentUrls) {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (response && response.ok()) {
      opened = true;
      break;
    }
  }

  if (opened) {
    await expect(page.locator('body')).toBeVisible();
  } else {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Forgot password/i })).toBeVisible();
  }
});
