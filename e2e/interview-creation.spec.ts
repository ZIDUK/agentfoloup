import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/fixtures/auth.json' });

const INTERVIEWER_1 = { id: 1, name: 'Alex', image: 'https://via.placeholder.com/70' };
const INTERVIEWER_2 = { id: 2, name: 'Jordan', image: 'https://via.placeholder.com/70' };

const NEW_INTERVIEW = {
  id: 'new-interview-id',
  name: 'Test Interview',
  interviewer_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  url: null,
  readable_slug: 'test-interview-new-interview-id',
  user_id: 'user-1',
  objective: 'Assess skills',
  question_count: 2,
  time_duration: '5',
  questions: [],
  description: 'Interview description.',
  response_count: 0,
  insights: [],
  quotes: [],
  details: null,
  is_active: true,
  is_deleted: false,
  theme_color: '#000000',
  logo_url: '',
  respondents: [],
};

test.describe('Interview creation flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/interviewers*', (route) => {
      const url = route.request().url();
      if (/\/api\/interviewers\/\w+/.test(url)) {
        return route.fulfill({ json: INTERVIEWER_1 });
      }
      return route.fulfill({ json: [INTERVIEWER_1] });
    });
    await page.route('**/api/get-dreamit-jobs', (route) =>
      route.fulfill({ json: { jobs: [] } })
    );
    await page.route('**/api/interviews', (route) =>
      route.fulfill({ json: [] })
    );
    await page.route('**/api/responses**', (route) =>
      route.fulfill({ json: { data: [] } })
    );
  });

  test('1. Create Interview button opens the creation modal', async ({ page }) => {
    await page.goto('/dashboard');
    const modal = page.locator('.fixed.z-50.inset-0').first();
    await expect(modal).toBeHidden();
    await page.getByText('Create an Interview').first().click();
    await expect(modal).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create an Interview' })).toBeVisible();
  });

  test('2. Form shows required fields: name, objective, description, and question input', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText('Create an Interview').first().click();
    // Step 1: name and objective fields
    const nameInput = page.getByPlaceholder('e.g. Name of the Interview');
    await expect(nameInput).toBeVisible();
    await nameInput.click();
    const objectiveTextarea = page.getByPlaceholder(/Find best candidates/);
    await expect(objectiveTextarea).toBeVisible();
    // Navigate to step 2 to assert description and question fields
    await nameInput.fill('Test Interview');
    await expect(page.locator('img[alt="Picture of the interviewer"]').first()).toBeVisible({ timeout: 5000 });
    await page.locator('img[alt="Picture of the interviewer"]').first().click();
    await objectiveTextarea.fill('Assess technical skills');
    await page.locator('input[type="number"][max="50"]').fill('2');
    await page.locator('input[type="number"][max="10"]').fill('5');
    await page.getByRole('button', { name: "I'll do it myself" }).click();
    await expect(page.getByRole('heading', { name: 'Create Interview' })).toBeVisible({ timeout: 10000 });
    const descriptionTextarea = page.getByPlaceholder('Enter your interview description.');
    await expect(descriptionTextarea).toBeVisible();
    await descriptionTextarea.click();
    const questionTextarea = page.getByPlaceholder(/Can you tell me about/).first();
    await expect(questionTextarea).toBeVisible();
    await expect(questionTextarea).toBeEnabled();
  });

  test('3. Submit buttons are disabled when required fields are empty', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText('Create an Interview').first().click();
    const generateBtn = page.getByRole('button', { name: 'Generate Questions' });
    const manualBtn = page.getByRole('button', { name: "I'll do it myself" });
    // All empty — both buttons disabled
    await expect(generateBtn).toBeDisabled();
    await expect(manualBtn).toBeDisabled();
    // Partial fill (name only) — buttons still disabled
    await page.getByPlaceholder('e.g. Name of the Interview').fill('My Interview');
    await expect(generateBtn).toBeDisabled();
    await expect(manualBtn).toBeDisabled();
  });

  test('4. Interviewer selector populates from /api/interviewers mock with 2 interviewers', async ({ page }) => {
    await page.route('**/api/interviewers*', (route) => {
      const url = route.request().url();
      if (/\/api\/interviewers\/\w+/.test(url)) {
        return route.fulfill({ json: INTERVIEWER_1 });
      }
      return route.fulfill({ json: [INTERVIEWER_1, INTERVIEWER_2] });
    });
    await page.goto('/dashboard');
    await page.getByText('Create an Interview').first().click();
    await expect(page.getByText('Alex', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Jordan', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('5. Generate Questions calls mock and populates 3 question inputs', async ({ page }) => {
    const generatedPayload = {
      questions: [
        { question: 'Describe your most challenging project.', follow_up_count: 1 },
        { question: 'How do you approach debugging complex issues?', follow_up_count: 1 },
        { question: 'Explain a recent technical decision you made.', follow_up_count: 1 },
      ],
      description: 'Auto-generated interview description',
    };
    await page.route('**/api/generate-interview-questions', (route) =>
      route.fulfill({ json: { response: JSON.stringify(generatedPayload) } })
    );
    await page.goto('/dashboard');
    await page.getByText('Create an Interview').first().click();
    await page.getByPlaceholder('e.g. Name of the Interview').fill('Engineering Interview');
    await expect(page.locator('img[alt="Picture of the interviewer"]').first()).toBeVisible({ timeout: 5000 });
    await page.locator('img[alt="Picture of the interviewer"]').first().click();
    await page.getByPlaceholder(/Find best candidates/).fill('Assess engineering competency');
    await page.locator('input[type="number"][max="50"]').fill('3');
    await page.locator('input[type="number"][max="10"]').fill('5');
    await page.getByRole('button', { name: 'Generate Questions' }).click();
    await expect(page.getByRole('heading', { name: 'Create Interview' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/Can you tell me about/)).toHaveCount(3, { timeout: 10000 });
  });

  test('6. Successful creation closes modal; manual add and remove question flow', async ({ page }) => {
    await page.route('**/api/create-interview', (route) =>
      route.fulfill({ status: 201, json: { id: 'new-interview-id' } })
    );
    await page.goto('/dashboard');
    await page.getByText('Create an Interview').first().click();
    await page.getByPlaceholder('e.g. Name of the Interview').fill('Test Interview');
    await expect(page.locator('img[alt="Picture of the interviewer"]').first()).toBeVisible({ timeout: 5000 });
    await page.locator('img[alt="Picture of the interviewer"]').first().click();
    await page.getByPlaceholder(/Find best candidates/).fill('Assess skills');
    // numQuestions=2 so that Plus button is visible after manual entry (1 < 2)
    await page.locator('input[type="number"][max="50"]').fill('2');
    await page.locator('input[type="number"][max="10"]').fill('5');
    await page.getByRole('button', { name: "I'll do it myself" }).click();
    await expect(page.getByRole('heading', { name: 'Create Interview' })).toBeVisible({ timeout: 10000 });
    // Starts with 1 empty question; Plus button visible (1 < 2)
    await expect(page.getByPlaceholder(/Can you tell me about/)).toHaveCount(1);
    const addButton = page.locator('div.border-primary.w-fit.rounded-full');
    await addButton.click();
    await expect(page.getByPlaceholder(/Can you tell me about/)).toHaveCount(2); // add verified
    // Remove second question card via its Trash2 icon
    await page.locator('.shadow-md.mb-5').last().locator('.cursor-pointer.ml-3').click();
    await expect(page.getByPlaceholder(/Can you tell me about/)).toHaveCount(1); // remove verified
    // Add back to reach required count=2
    await addButton.click();
    await expect(page.getByPlaceholder(/Can you tell me about/)).toHaveCount(2);
    // Fill both questions and description to enable Save
    await page.getByPlaceholder(/Can you tell me about/).first().fill('What motivates you?');
    await page.getByPlaceholder(/Can you tell me about/).last().fill('Describe a difficult situation.');
    await page.getByPlaceholder('Enter your interview description.').fill('Interview description.');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.fixed.z-50.inset-0').first()).toBeHidden({ timeout: 10000 });
  });

  test('7. After successful creation, the new interview card appears in the list', async ({ page }) => {
    let interviewsCallCount = 0;
    await page.route('**/api/interviews', (route) => {
      interviewsCallCount++;
      return route.fulfill({
        json: interviewsCallCount === 1 ? [] : [NEW_INTERVIEW],
      });
    });
    await page.route('**/api/create-interview', (route) =>
      route.fulfill({ status: 201, json: NEW_INTERVIEW })
    );
    await page.goto('/dashboard');
    await page.getByText('Create an Interview').first().click();
    await page.getByPlaceholder('e.g. Name of the Interview').fill('Test Interview');
    await expect(page.locator('img[alt="Picture of the interviewer"]').first()).toBeVisible({ timeout: 5000 });
    await page.locator('img[alt="Picture of the interviewer"]').first().click();
    await page.getByPlaceholder(/Find best candidates/).fill('Assess skills');
    await page.locator('input[type="number"][max="50"]').fill('2');
    await page.locator('input[type="number"][max="10"]').fill('5');
    await page.getByRole('button', { name: "I'll do it myself" }).click();
    await expect(page.getByRole('heading', { name: 'Create Interview' })).toBeVisible({ timeout: 10000 });
    // Fill step 2: questions (need 2) and description
    await page.getByPlaceholder(/Can you tell me about/).first().fill('What motivates you?');
    const addButton = page.locator('div.border-primary.w-fit.rounded-full');
    await addButton.click();
    await page.getByPlaceholder(/Can you tell me about/).last().fill('Describe a challenge.');
    await page.getByPlaceholder('Enter your interview description.').fill('Interview description.');
    await page.getByRole('button', { name: 'Save' }).click();
    // Modal closes; fetchInterviews() triggers second GET /api/interviews returning the new card
    await expect(page.locator('.fixed.z-50.inset-0').first()).toBeHidden({ timeout: 10000 });
    await expect(
      page.locator('a[href^="/interviews/"]').filter({ hasText: 'Test Interview' })
    ).toBeVisible({ timeout: 10000 });
  });
});
