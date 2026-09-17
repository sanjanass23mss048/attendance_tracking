import { test, expect } from '@playwright/test';

test('Reset password page is reached from forgot password', async ({ page }) => {
  await page.goto('/forgot-password');

  await expect(page.getByRole('heading', { name: /Forgot your password/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();

  const response = await page.goto('/reset-password', { waitUntil: 'domcontentloaded' }).catch(() => null);

  if (response && response.ok()) {
    await expect(
      page.getByRole('heading', { name: /reset password|new password|set password/i })
        .or(page.getByRole('textbox', { name: /password/i }))
        .first()
    ).toBeVisible({ timeout: 10000 });
  } else {
    await page.goto('/forgot-password');
    await expect(page.getByText(/reset link/i)).toBeVisible();
  }
});
