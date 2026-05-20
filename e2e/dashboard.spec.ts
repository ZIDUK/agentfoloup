import { test, expect } from '@playwright/test';
import { mockSupabaseExternal } from './helpers/mocks';

test.use({ storageState: 'e2e/fixtures/auth.json' });

const INTERVIEWS = [
  {
    id: 'interview-1',
    name: 'Frontend Engineer Interview',
    interviewer_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    url: null,
    readable_slug: 'frontend-engineer-interview',
    user_id: 'user-1',
    objective: 'Assess frontend skills',
    question_count: 5,
    time_duration: '30',
    questions: [],
    description: 'Frontend interview',
    response_count: 0,
    insights: [],
    quotes: [],
    details: null,
    is_active: true,
    is_deleted: false,
    theme_color: '#000000',
    logo_url: '',
    respondents: [],
  },
  {
    id: 'interview-2',
    name: 'Backend Engineer Interview',
    interviewer_id: 1,
    created_at: '2024-01-02T00:00:00Z',
    url: null,
    readable_slug: 'backend-engineer-interview',
    user_id: 'user-1',
    objective: 'Assess backend skills',
    question_count: 5,
    time_duration: '30',
    questions: [],
    description: 'Backend interview',
    response_count: 0,
    insights: [],
    quotes: [],
    details: null,
    is_active: true,
    is_deleted: false,
    theme_color: '#000000',
    logo_url: '',
    respondents: [],
  },
];

const INTERVIEWER = {
  id: 1,
  name: 'Alex',
  image: 'https://via.placeholder.com/70',
};

test.describe('Dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseExternal(page);

    // Playwright matches routes LIFO (last-registered wins), so registering this fallback
    // BEFORE the specific routes below guarantees specific ones take precedence. Any
    // unmocked /api/* call still resolves with an empty body rather than hitting the real server.
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    await page.route('**/api/interviewers*', (route) => {
      const url = route.request().url();
      if (/\/api\/interviewers\/\w+/.test(url)) {
        return route.fulfill({ json: INTERVIEWER });
      }
      return route.fulfill({ json: [] });
    });
    await page.route('**/api/responses**', (route) =>
      route.fulfill({ json: { data: [] } })
    );
  });

  test('1. /dashboard loads and shows the interview list section', async ({ page }) => {
    await page.route('**/api/interviews**', (route) =>
      route.fulfill({ json: [] })
    );
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'My Interviews' })).toBeVisible();
  });

  test('2. empty state message displays when no interviews exist', async ({ page }) => {
    await page.route('**/api/interviews**', (route) =>
      route.fulfill({ json: [] })
    );
    await page.goto('/dashboard');
    await expect(page.locator('.animate-pulse').first()).toBeHidden();
    await expect(page.getByText('Create an Interview').first()).toBeVisible();
    await expect(page.locator('a[href^="/interviews/"]')).toHaveCount(0);
  });

  test('3. interview cards render when interviews exist', async ({ page }) => {
    await page.route('**/api/interviews**', (route) =>
      route.fulfill({ json: INTERVIEWS })
    );
    await page.goto('/dashboard');
    await expect(page.locator('.animate-pulse').first()).toBeHidden();
    const cards = page.locator('a[href^="/interviews/"]');
    await expect(cards).toHaveCount(2, { timeout: 10000 });
    await expect(cards.nth(0)).toContainText('Frontend Engineer Interview');
    await expect(cards.nth(1)).toContainText('Backend Engineer Interview');
  });

  test('4. clicking an interview card navigates to /interviews/[id]', async ({ page }) => {
    await page.route('**/api/interviews**', (route) =>
      route.fulfill({ json: INTERVIEWS })
    );
    await page.goto('/dashboard');
    await expect(page.locator('a[href^="/interviews/"]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('a[href^="/interviews/"]').first().click();
    await expect(page).toHaveURL(/\/interviews\//);
  });

  test('5. Create Interview button is visible and opens the creation modal', async ({ page }) => {
    await page.route('**/api/interviews**', (route) =>
      route.fulfill({ json: [] })
    );
    await page.goto('/dashboard');
    const modal = page.locator('.fixed.z-50.inset-0').first();
    const createCard = page.getByText('Create an Interview').first();
    await expect(createCard).toBeVisible();
    await createCard.click();
    await expect(modal).toBeVisible();
  });

  test('6. nav link to /dashboard/interviewers navigates correctly', async ({ page }) => {
    await page.route('**/api/interviews**', (route) =>
      route.fulfill({ json: [] })
    );
    await page.goto('/dashboard');
    const interviewersLink = page.getByText('Interviewers', { exact: true });
    await expect(interviewersLink).toBeVisible();
    await interviewersLink.click();
    // router.push is async; toHaveURL with no explicit wait races the navigation
    // and flakes in slower browser/timing environments — waitForURL blocks until settled.
    await page.waitForURL('**/dashboard/interviewers', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard/interviewers');
  });
});
