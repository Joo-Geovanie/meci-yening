import { test, expect } from '@playwright/test';

test('CV login, size rejection, review skills and private deletion', async ({ page }) => {
  const uid = '11111111-1111-4111-8111-111111111111';
  let stored = false, uploadCalls = 0, deleted = false;
  await page.route('https://*.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/token')) return route.fulfill({ json: { access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user: { id: uid, email: 'student@example.com', aud: 'authenticated', role: 'authenticated' } } });
    if (path.includes('/object/list/')) return route.fulfill({ json: stored ? [{ name: 'sample.txt', created_at: '2026-11-13T00:00:00Z', id: 'cv-test' }] : [] });
    if (route.request().method() === 'DELETE') { deleted = true; stored = false; return route.fulfill({ json: [] }); }
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/cv?extension=txt', async route => {
    uploadCalls++; stored = true;
    expect(route.request().headers().authorization).toBe('Bearer test-token');
    return route.fulfill({ json: { skills: ['python', 'sql', 'communication'], detected_count: 3, stored: true, path: `${uid}/sample.txt`, message: 'CV tersimpan privat.' } });
  });
  await page.goto('/');
  await page.getByLabel('Email akun').fill('student@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.locator('form').getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByLabel('Unggah dan simpan CV')).toBeVisible();
  await page.getByLabel('Unggah dan simpan CV').setInputFiles({ name: 'large.txt', mimeType: 'text/plain', buffer: Buffer.alloc(5_000_001, 'x') });
  await expect(page.getByRole('alert')).toContainText('maksimal 5 MB');
  expect(uploadCalls).toBe(0);
  await page.getByLabel('Unggah dan simpan CV').setInputFiles({ name: 'cv.txt', mimeType: 'text/plain', buffer: Buffer.from('Python SQL communication') });
  await expect(page.getByRole('button', { name: 'Gunakan skill CV' })).toBeVisible();
  await page.getByRole('button', { name: 'Gunakan skill CV' }).click();
  await expect(page.locator('.selected-skills')).toContainText('python');
  await page.getByRole('button', { name: 'Cari rekomendasi' }).click();
  await expect(page.locator('.score-line').first()).toContainText('%');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('navigation').getByRole('button', { name: 'Profil saya' }).click();
  await page.getByText('CV tersimpan (1)', { exact: true }).click();
  await page.getByRole('button', { name: 'Hapus', exact: true }).click();
  await expect(page.getByText('CV tersimpan (0)', { exact: true })).toBeVisible();
  expect(deleted).toBe(true);
});

test('signup explains short password and submits valid input without stuck cursor', async ({ page }) => {
  let signups = 0;
  await page.route('https://*.supabase.co/auth/v1/signup', route => {
    signups++;
    return route.fulfill({ json: { user: { id: 'test-user', email: 'student@example.com' }, session: null } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  const signup = page.getByRole('button', { name: 'Daftar akun', exact: true });
  await expect(signup).toBeEnabled();
  await page.getByLabel('Email akun').fill('student@example.com');
  await page.getByLabel('Password', { exact: true }).fill('abcd');
  await page.getByLabel('Konfirmasi password').fill('abcd');
  await signup.hover();
  await expect(signup).toHaveCSS('cursor', 'pointer');
  await signup.click();
  await expect(page.getByRole('alert')).toContainText('minimal 8 karakter');
  expect(signups).toBe(0);
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByLabel('Konfirmasi password').fill('test-password-123');
  await signup.click();
  await expect(page.getByText(/Pendaftaran diproses/)).toBeVisible();
  expect(signups).toBe(1);
  await expect(page.locator('form').getByRole('button', { name: 'Masuk', exact: true })).toBeEnabled();
});
