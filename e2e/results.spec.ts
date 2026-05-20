import { test, expect } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CALL_ID = 'test-call-id';
const INTERVIEW_ID = 'test-interview-id';

const RESPONSE_WITH_ANALYTICS = {
  id: 'resp-1',
  call_id: CALL_ID,
  interview_id: INTERVIEW_ID,
  name: 'Jane Smith',
  email: 'jane@example.com',
  created_at: '2026-01-01T10:00:00Z',
  is_viewed: true,
  is_ended: true,
  is_test_response: false,
  candidate_status: 'NO_STATUS',
  analytics: {
    overallScore: 78,
    overallFeedback: 'Strong candidate with good communication skills.',
    englishProficiency: {
      cefrLevel: 'B2',
      pronunciationFeedback: 'Clear pronunciation overall.',
      fluencyFeedback: 'Speaks fluently with minor hesitations.',
      vocabularyFeedback: 'Good range of vocabulary.',
      grammarFeedback: 'Minor grammatical errors.',
      coherenceFeedback: 'Well-structured responses.',
    },
  },
};

const INTERVIEW = {
  id: INTERVIEW_ID,
  name: 'Engineering Interview',
  description: 'Technical assessment.',
  is_active: true,
  theme_color: '#4F46E5',
  interviewer_id: 1,
  questions: [],
  created_at: '2026-01-01T00:00:00Z',
  readable_slug: 'engineering-interview',
  url: null,
};

const RESPONSE_LIST = [
  {
    id: 'list-resp-1',
    call_id: 'call-1',
    interview_id: INTERVIEW_ID,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    created_at: '2026-01-01T10:00:00Z',
    is_viewed: true,
    is_ended: true,
    is_test_response: false,
    candidate_status: 'NO_STATUS',
    analytics: { overallScore: 82 },
    tab_switch_count: 0,
    fullscreen_exit_count: 0,
    duration: 120,
  },
  {
    id: 'list-resp-2',
    call_id: 'call-2',
    interview_id: INTERVIEW_ID,
    name: 'Bob Williams',
    email: 'bob@example.com',
    created_at: '2026-01-02T10:00:00Z',
    is_viewed: false,
    is_ended: true,
    is_test_response: false,
    candidate_status: 'POTENTIAL',
    analytics: { overallScore: 65 },
    tab_switch_count: 0,
    fullscreen_exit_count: 0,
    duration: 180,
  },
];

// ── Public result page (cases 1-7, no auth) ──────────────────────────────────

test.describe('Public result page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/responses/**`, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: RESPONSE_WITH_ANALYTICS });
    });
    await page.route(`**/api/interviews/**`, (route) =>
      route.fulfill({ json: INTERVIEW })
    );
  });

  test('1. /result/[callId] loads and shows Your Interview Results heading', async ({ page }) => {
    await page.goto(`/result/${CALL_ID}`);
    await expect(page.getByRole('heading', { name: 'Your Interview Results' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Your analysis is ready')).toBeVisible();
  });

  test('2. CEFR proficiency level B2 is displayed with its label', async ({ page }) => {
    await page.goto(`/result/${CALL_ID}`);
    // span.text-4xl.font-black.text-primary renders the level
    await expect(page.getByText(/B2/).first()).toBeVisible({ timeout: 10000 });
    // CEFR_LABELS["B2"] = "Upper Intermediate"
    await expect(page.getByText('Upper Intermediate')).toBeVisible();
  });

  test('3. Language skill sections render with sub-score feedback', async ({ page }) => {
    await page.goto(`/result/${CALL_ID}`);
    // "LANGUAGE SKILLS" section heading (uppercase tracking-widest label)
    await expect(page.getByText(/language skills/i)).toBeVisible({ timeout: 10000 });
    // At least 2 skill card labels visible
    await expect(page.getByText('Pronunciation', { exact: true })).toBeVisible();
    await expect(page.getByText('Fluency')).toBeVisible();
  });

  test('4. Overall feedback card is visible with feedback text', async ({ page }) => {
    await page.goto(`/result/${CALL_ID}`);
    await expect(page.getByText(/overall feedback/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Strong candidate with good communication skills.')).toBeVisible();
  });

  test('5. Interview name from fixture is shown on the page', async ({ page }) => {
    await page.goto(`/result/${CALL_ID}`);
    // interview.name = 'Engineering Interview' from the mocked /api/interviews/[interviewId]
    await expect(page.getByText('Engineering Interview')).toBeVisible({ timeout: 10000 });
  });

  test('6. Result page shows response recorded footer text', async ({ page }) => {
    await page.goto(`/result/${CALL_ID}`);
    await expect(page.getByText('Your responses have been recorded and will be reviewed by the team.')).toBeVisible({ timeout: 15000 });
  });

  test('7. Vocabulary skill section is visible on the result page', async ({ page }) => {
    await page.goto(`/result/${CALL_ID}`);
    await expect(page.getByText('Vocabulary')).toBeVisible({ timeout: 15000 });
  });
});

// ── Authenticated response list (cases 8-10) ─────────────────────────────────

test.describe('Authenticated response list', () => {
  test.use({ storageState: 'e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    // Context fetches — interviewers first so the sidebar doesn't hang
    await page.route('**/api/interviewers**', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/interviews', (route) => route.fulfill({ json: [] }));
    await page.route(`**/api/interviews/${INTERVIEW_ID}`, (route) =>
      route.fulfill({ json: INTERVIEW })
    );
    await page.route('**/api/interview-jobs?*', (route) =>
      route.fulfill({ json: { jobs: [] } })
    );
    // Use regex patterns to cleanly separate list (?query) from detail (/callId).
    // /api/responses?interviewId=... — list endpoint
    await page.route(/\/api\/responses\?/, (route) =>
      route.fulfill({ json: { data: RESPONSE_LIST, total: 2, page: 1, page_size: 50 } })
    );
    // /api/responses/[callId] — detail endpoint (GET for CallInfo, PATCH for mark-as-viewed)
    await page.route(/\/api\/responses\/[^?]+/, (route) => {
      const method = route.request().method();
      if (method === 'PATCH') return route.fulfill({ json: { success: true } });
      if (method === 'GET') return route.fulfill({ json: RESPONSE_LIST[0] });
      return route.continue();
    });
    // CallInfo fires POST /api/get-call when a response is selected
    await page.route('**/api/get-call', (route) =>
      route.fulfill({ json: { callResponse: {}, analytics: null } })
    );
  });

  test('8. /interviews/[id] loads and shows 2 response list items', async ({ page }) => {
    await page.goto(`/interviews/${INTERVIEW_ID}`);
    // Response name is rendered as "{name}'s Response"
    await expect(page.getByText("Alice Johnson's Response")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Bob Williams's Response")).toBeVisible();
  });

  test('9. Response list item shows candidate name and overall score badge', async ({ page }) => {
    await page.goto(`/interviews/${INTERVIEW_ID}`);
    await expect(page.getByText("Alice Johnson's Response")).toBeVisible({ timeout: 10000 });
    // Overall score badge (w-6 h-6 rounded-full border-primary) shows analytics.overallScore
    await expect(page.getByText('82').first()).toBeVisible();
  });

  test('10. Clicking a response navigates URL to include ?call=[callId]', async ({ page }) => {
    await page.goto(`/interviews/${INTERVIEW_ID}`);
    await expect(page.getByText("Alice Johnson's Response")).toBeVisible({ timeout: 10000 });
    await page.getByText("Alice Johnson's Response").click();
    // router.push adds ?call=call-1 to the URL
    await page.waitForURL(/\/interviews\/test-interview-id\?call=call-1/);
    expect(page.url()).toContain('call=call-1');
  });
});
