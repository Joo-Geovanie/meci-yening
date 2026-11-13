import { expect } from '@playwright/test';
export async function mockAuth(page) {
  await page.route('https://*.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/token')) {
      const email = route.request().postDataJSON().email;
      const id = email === 'second@example.com' ? '22222222-2222-4222-8222-222222222222' : '11111111-1111-4111-8111-111111111111';
      return route.fulfill({ json: { access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user: { id, email, aud: 'authenticated', role: 'authenticated' } } });
    }
    if (path.endsWith('/logout')) return route.fulfill({ status: 204 });
    if (path.includes('/object/list/')) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
}
export async function login(page, email = 'student@example.com') {
  await page.getByLabel('Email akun').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Masuk ke ruangperan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Profil keterampilan' })).toBeVisible();
}
