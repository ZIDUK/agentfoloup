import { test, expect, Page } from '@playwright/test';

async function mockApiRoutes(page: Page) {
  await page.route('/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
}

test.describe('sign-in page', () => {
  test('renders with sign-in UI visible', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: /welcome to folo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });
});

test.describe('unauthenticated routing', () => {
  test('/dashboard redirects to /sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/sign-in/);
    expect(page.url()).toMatch(/\/sign-in/);
  });

  test('/sign-up redirects to /sign-in', async ({ page }) => {
    await page.goto('/sign-up');
    await page.waitForURL(/\/sign-in/);
    expect(page.url()).toMatch(/\/sign-in/);
  });
});

test.describe('authenticated routing', () => {
  test.use({ storageState: 'e2e/fixtures/auth.json' });

  test('/ root URL redirects to /dashboard', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    await page.waitForURL(/\/dashboard/);
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test('authenticated user lands on /dashboard without redirect', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/dashboard');
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
