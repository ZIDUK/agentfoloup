import { test, expect } from '@playwright/test';
import { mockSupabaseExternal } from './helpers/mocks';

test.use({ storageState: 'e2e/fixtures/auth.json' });

// Fixture includes all fields the card and modal render (name, rapport, exploration, empathy, speed, image)
const INTERVIEWERS = [
  {
    id: 1,
    user_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    name: 'Explorer Lisa',
    rapport: 7,
    exploration: 10,
    empathy: 7,
    speed: 5,
    image: '/interviewers/Lisa.png',
    description: 'Hi! I am Lisa, your AI interviewer.',
    audio: '',
    agent_id: null,
  },
  {
    id: 2,
    user_id: 'user-1',
    created_at: '2024-01-02T00:00:00Z',
    name: 'Empathetic Bob',
    rapport: 7,
    exploration: 7,
    empathy: 10,
    speed: 5,
    image: '/interviewers/Bob.png',
    description: 'Hi! I am Bob, your AI interviewer.',
    audio: '',
    agent_id: null,
  },
];

test.describe('Interviewer management', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseExternal(page);

    // Playwright matches routes LIFO (last-registered wins), so registering this fallback
    // BEFORE the specific routes below guarantees specific ones take precedence. Any
    // unmocked /api/* call still resolves with an empty body rather than hitting the real server.
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    // Mock interviews list (needed for sidebar and providers)
    await page.route('**/api/interviews**', (route) =>
      route.fulfill({ json: [] })
    );

    // Mock responses (needed by some context loaders)
    await page.route('**/api/responses**', (route) =>
      route.fulfill({ json: { data: [] } })
    );

    // Intercept collection endpoint for GET (** catches query strings)
    await page.route('**/api/interviewers**', (route) =>
      route.fulfill({ json: INTERVIEWERS })
    );

    // Intercept the ID-based endpoint last so it wins over the collection mock
    await page.route('**/api/interviewers/*', (route) =>
      route.fulfill({ json: INTERVIEWERS[0] })
    );
  });

  // 1. Page loads and lists 2 interviewers
  test('1. /dashboard/interviewers page loads and lists existing interviewers', async ({ page }) => {
    await page.goto('/dashboard/interviewers');
    // Wait for loading skeleton to clear
    await expect(page.locator('.animate-pulse').first()).toBeHidden({ timeout: 10000 });
    // Both mocked interviewer names are visible as card titles
    await expect(page.getByText('Explorer Lisa').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Empathetic Bob').first()).toBeVisible();
  });

  // 2. Card shows name and persona attribute values
  test('2. interviewer card shows name and persona attribute values', async ({ page }) => {
    await page.goto('/dashboard/interviewers');
    await expect(page.getByText('Explorer Lisa').first()).toBeVisible({ timeout: 10000 });
    // Click first card to open the details modal
    await page.getByText('Explorer Lisa').first().click();
    // Modal shows the interviewer name as heading (card also has the name, so use last to target the modal)
    await expect(page.getByRole('heading', { name: 'Explorer Lisa' }).last()).toBeVisible();
    // Modal shows all persona attribute labels (portal/sheet can render twice — use .first())
    await expect(page.getByText('Empathy').first()).toBeVisible();
    await expect(page.getByText('Rapport').first()).toBeVisible();
    await expect(page.getByText('Speed').first()).toBeVisible();
    await expect(page.getByText('Exploration').first()).toBeVisible();
    // Persona values are displayed: empathy=7 → stored/10 → display = 0.7
    await expect(page.getByText('0.7').first()).toBeVisible();
  });
});
