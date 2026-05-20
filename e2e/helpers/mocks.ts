import { Page } from '@playwright/test';

/**
 * Block the @supabase/auth-helpers-nextjs client's token-refresh (/token) and
 * user-fetch (/user) network calls. Without this, those requests hang until the
 * browser's network timeout on every page load, keeping the app in a persistent
 * "Loading..." state and causing every authenticated-page navigation to time out.
 */
export async function mockSupabaseExternal(page: Page) {
  // Block all external Supabase requests with a permissive response
  await page.route(/.*\.supabase\.co\/auth\/v1\/.*/, (route) => {
    const url = route.request().url();
    if (url.includes('/token')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: '20888b53-e576-4063-a119-8d357356b431',
            email: 'yousaf.khalid@agenticdream.com',
            aud: 'authenticated',
            role: 'authenticated',
          },
        }),
      });
    }
    if (url.includes('/user')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '20888b53-e576-4063-a119-8d357356b431',
          email: 'yousaf.khalid@agenticdream.com',
          aud: 'authenticated',
          role: 'authenticated',
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Block realtime/functions endpoints
  await page.route(/.*\.supabase\.co\/realtime\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.route(/.*\.supabase\.co\/functions\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
}
