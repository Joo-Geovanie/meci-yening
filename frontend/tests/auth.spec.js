import { test, expect } from '@playwright/test';
import { mockAuth, login } from './auth-helpers.js';

test('login gate, session restore, logout and account-specific profile', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Masuk ke Prima' })).toBeVisible();
  await expect(page.getByLabel('Unggah dan simpan CV')).toHaveCount(0);
  await expect(page.getByLabel('Minat karier')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/auth-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/auth-mobile.png', fullPage: true });
  await login(page);
  await page.getByLabel('Minat karier').fill('finance');
  await page.reload();
  await expect(page.getByLabel('Minat karier')).toHaveValue('finance');
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page.getByLabel('Unggah dan simpan CV')).toHaveCount(0);
  await login(page, 'second@example.com');
  await expect(page.getByLabel('Minat karier')).toHaveValue('');
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page);
  await expect(page.getByLabel('Minat karier')).toHaveValue('finance');
});
