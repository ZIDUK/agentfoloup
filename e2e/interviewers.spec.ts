import { test, expect } from '@playwright/test';

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
    // Intercept the ID-based endpoint (needed for details modal if component fetches by ID)
    await page.route('**/api/interviewers/*', (route) =>
      route.fulfill({ json: INTERVIEWERS[0] })
    );

    // Intercept collection endpoint for GET (** catches query strings)
    await page.route('**/api/interviewers**', (route) =>
      route.fulfill({ json: INTERVIEWERS })
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
    // Modal shows the interviewer name as heading
    await expect(page.getByRole('heading', { name: 'Explorer Lisa' })).toBeVisible();
    // Modal shows all persona attribute labels
    await expect(page.getByText('Empathy')).toBeVisible();
    await expect(page.getByText('Rapport')).toBeVisible();
    await expect(page.getByText('Speed')).toBeVisible();
    await expect(page.getByText('Exploration')).toBeVisible();
    // Persona values are displayed: empathy=7 → stored/10 → display = 0.7
    await expect(page.getByText('0.7').first()).toBeVisible();
  });
});
