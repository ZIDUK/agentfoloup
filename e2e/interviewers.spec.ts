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

const NEW_INTERVIEWER = {
  id: 3,
  user_id: 'user-1',
  created_at: '2024-01-03T00:00:00Z',
  name: 'Friendly Alex',
  rapport: 7,
  exploration: 2,
  empathy: 4,
  speed: 9,
  image: '/interviewers/Lisa.png',
  description: '',
  audio: '',
  agent_id: null,
};

test.describe('Interviewer management', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept the ID-based endpoint first (more specific glob must come before wildcard)
    await page.route('**/api/interviewers/*', (route) => {
      const method = route.request().method();
      if (method === 'PATCH') {
        return route.fulfill({
          status: 200,
          json: { ...INTERVIEWERS[0], name: 'Updated Lisa' },
        });
      }
      return route.fulfill({ json: INTERVIEWERS[0] });
    });

    // Intercept collection endpoint for GET and POST
    await page.route('**/api/interviewers', (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        return route.fulfill({ status: 201, json: NEW_INTERVIEWER });
      }
      return route.fulfill({ json: INTERVIEWERS });
    });

    // Intercept the default-interviewers creation endpoint
    await page.route('**/api/create-interviewer', (route) =>
      route.fulfill({
        status: 201,
        json: { newInterviewer: NEW_INTERVIEWER, newSecondInterviewer: INTERVIEWERS[1] },
      })
    );
  });

  // 1. Page loads and lists 2 interviewers
  test('1. /dashboard/interviewers page loads and lists existing interviewers', async ({ page }) => {
    await page.goto('/dashboard/interviewers');
    // Wait for loading skeleton to clear
    await expect(page.locator('.animate-pulse').first()).toBeHidden({ timeout: 10000 });
    // Both mocked interviewer names are visible as card titles
    await expect(page.getByText('Explorer Lisa')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Empathetic Bob')).toBeVisible();
  });

  // 2. Card shows name and persona attribute values
  test('2. interviewer card shows name and persona attribute values', async ({ page }) => {
    await page.goto('/dashboard/interviewers');
    await expect(page.getByText('Explorer Lisa')).toBeVisible({ timeout: 10000 });
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

  // 3. Create Interviewer button is visible and opens the creation form
  test('3. Create Interviewer button is visible and opens the creation form', async ({ page }) => {
    // Override to return empty list so the create trigger is rendered
    await page.route('**/api/interviewers', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: [] });
      if (route.request().method() === 'POST') return route.fulfill({ status: 201, json: NEW_INTERVIEWER });
      return route.continue();
    });
    await page.goto('/dashboard/interviewers');
    // With no interviewers the Plus button from createInterviewerCard should be visible
    const createButton = page.locator('.bg-primary.rounded-full');
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();
    // Creation form modal opens
    await expect(page.getByText('Create an interviewer yourself!')).toBeVisible();
  });

  // 4. Form has fields for name and persona attribute inputs
  test('4. creation form has name field and persona attribute sliders', async ({ page }) => {
    await page.route('**/api/interviewers', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: [] });
      if (route.request().method() === 'POST') return route.fulfill({ status: 201, json: NEW_INTERVIEWER });
      return route.continue();
    });
    await page.goto('/dashboard/interviewers');
    await page.locator('.bg-primary.rounded-full').click();
    await expect(page.getByText('Create an interviewer yourself!')).toBeVisible();

    // Name input
    await expect(page.locator('input[placeholder="e.g. Empathetic Bob"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Empathetic Bob"]')).toBeEditable();

    // Persona sliders are present and labeled
    await expect(page.getByText('Empathy')).toBeVisible();
    await expect(page.getByText('Rapport')).toBeVisible();
    await expect(page.getByText('Exploration')).toBeVisible();
    await expect(page.getByText('Speed')).toBeVisible();

    // Sliders are interactive (Radix renders div[role="slider"])
    const sliders = page.locator('[role="slider"]');
    await expect(sliders.first()).toBeVisible();

    // Interact with first slider (Empathy defaults to 0.4) via keyboard and assert value updates
    await sliders.first().focus();
    await sliders.first().press('ArrowRight'); // step +0.1 → 0.5
    await expect(page.getByText('0.5')).toBeVisible();
  });

  // 5. Form validation fires on empty name — Save is disabled
  test('5. form Save button is disabled when name is empty', async ({ page }) => {
    await page.route('**/api/interviewers', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: [] });
      return route.continue();
    });
    await page.goto('/dashboard/interviewers');
    await page.locator('.bg-primary.rounded-full').click();
    await expect(page.getByText('Create an interviewer yourself!')).toBeVisible();

    // Save is disabled when name is empty (no name + no image)
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    // Adding a name alone is still insufficient (image also required) — still disabled
    await page.locator('input[placeholder="e.g. Empathetic Bob"]').fill('Test Interviewer');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    // Clearing name confirms the disabled state relates to the name field
    await page.locator('input[placeholder="e.g. Empathetic Bob"]').fill('');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  // 6. Successful creation calls POST /api/interviewers (form flow) and new card appears
  test('6. successful creation adds new interviewer card to list', async ({ page }) => {
    let fetchCount = 0;
    await page.route('**/api/interviewers', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        fetchCount++;
        // First load: empty so create button shows; subsequent loads: include new interviewer
        return route.fulfill({ json: fetchCount === 1 ? [] : [NEW_INTERVIEWER] });
      }
      if (method === 'POST') {
        return route.fulfill({ status: 201, json: NEW_INTERVIEWER });
      }
      return route.continue();
    });

    await page.goto('/dashboard/interviewers');
    // Open create form
    await page.locator('.bg-primary.rounded-full').click();
    await expect(page.getByText('Create an interviewer yourself!')).toBeVisible();

    // Fill name
    await page.locator('input[placeholder="e.g. Empathetic Bob"]').fill('Friendly Alex');

    // Select an avatar from the gallery
    const avatarPickerArea = page.locator('.border-4.border-border.rounded-xl').first();
    await avatarPickerArea.click();
    await expect(page.getByText('Select an Avatar')).toBeVisible();
    await page.locator('img[alt="avatar"]').first().click();

    // Save — button should now be enabled (name + image both set)
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled({ timeout: 5000 });
    await page.getByRole('button', { name: 'Save' }).click();

    // New card with submitted name is visible after the context re-fetches
    await expect(page.getByText('Friendly Alex')).toBeVisible({ timeout: 10000 });
  });

  // 7. Edit action opens the edit form pre-populated with existing values
  test('7. edit action on interviewer card opens form pre-populated with existing values', async ({ page }) => {
    await page.goto('/dashboard/interviewers');
    await expect(page.getByText('Explorer Lisa')).toBeVisible({ timeout: 10000 });

    // Open the details modal for first card
    await page.getByText('Explorer Lisa').first().click();

    // Click the Edit button inside the modal
    await page.getByRole('button', { name: /edit/i }).click();

    // Name field should be pre-populated with the existing interviewer's name
    await expect(page.locator('input[placeholder="e.g. Empathetic Bob"]')).toHaveValue('Explorer Lisa');
  });

  // 8. Saving edit calls PATCH /api/interviewers/[id] and card reflects updated values
  test('8. saving an edit calls PATCH and card reflects updated values', async ({ page }) => {
    await page.goto('/dashboard/interviewers');
    await expect(page.getByText('Explorer Lisa')).toBeVisible({ timeout: 10000 });

    // Open details modal for first card
    await page.getByText('Explorer Lisa').first().click();

    // Click Edit
    await page.getByRole('button', { name: /edit/i }).click();

    // Change the name
    const nameInput = page.locator('input[placeholder="e.g. Empathetic Bob"]');
    await nameInput.clear();
    await nameInput.fill('Updated Lisa');

    // Save — PATCH /api/interviewers/1 is intercepted, returns updated interviewer
    await page.getByRole('button', { name: 'Save' }).click();

    // Updated name appears on the card
    await expect(page.getByText('Updated Lisa')).toBeVisible({ timeout: 10000 });
  });
});
