import { test, expect } from '@playwright/test';

// Public route — no storageState required

const INVITATION_ID = 'inv-e2e-abc-123';
const INTERVIEW_ID = 'interview-e2e-xyz';
const APPLICATION_ID = 'app-e2e-001';
const JOB_ID = '42';
const CANDIDATE_EMAIL = 'candidate@example.com';

const INVITATION = {
  id: INVITATION_ID,
  interview_id: INTERVIEW_ID,
  application_id: APPLICATION_ID,
  job_id: null,
  candidate_email: CANDIDATE_EMAIL,
  candidate_name: null,
};

const INTERVIEW = {
  id: INTERVIEW_ID,
  name: 'Frontend Developer Interview',
  objective: 'Assess frontend development skills',
  questions: [{ question: 'Tell me about yourself' }],
  time_duration: '15',
  is_active: true,
  interviewer_id: 1,
};

const INTERVIEWER = {
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
};

test.describe('Candidate call page', () => {
  test.beforeEach(async ({ page }) => {
    // Inject browser stubs BEFORE navigation so the SDK sees them on load
    await page.addInitScript(() => {
      // WebSocket stub: immediately usable, fires 'open' after 150ms
      const FakeWebSocket = class FakeWS {
        constructor(url) {
          this.url = url;
          this.readyState = 0;
          this.binaryType = 'blob';
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;
          this.onmessage = null;
          this._listeners = {};
          setTimeout(() => {
            this.readyState = 1;
            const evt = new Event('open');
            if (this.onopen) this.onopen(evt);
            (this._listeners['open'] || []).forEach((fn) => fn(evt));
          }, 150);
        }
        addEventListener(type, fn) {
          if (!this._listeners[type]) this._listeners[type] = [];
          this._listeners[type].push(fn);
        }
        removeEventListener(type, fn) {
          if (this._listeners[type]) {
            this._listeners[type] = this._listeners[type].filter((h) => h !== fn);
          }
        }
        dispatchEvent(event) {
          (this._listeners[event.type] || []).forEach((h) => h(event));
          return true;
        }
        send() {}
        close() {
          this.readyState = 3;
        }
      };
      FakeWebSocket.CONNECTING = 0;
      FakeWebSocket.OPEN = 1;
      FakeWebSocket.CLOSING = 2;
      FakeWebSocket.CLOSED = 3;
      window.WebSocket = FakeWebSocket;

      // getUserMedia: canvas-based video stream for camera requests, empty MediaStream for audio-only
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints && constraints.video) {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          return canvas.captureStream(10);
        }
        return new MediaStream();
      };

      // getDisplayMedia: canvas stream that reports displaySurface=monitor
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const stream = canvas.captureStream(10);
        const track = stream.getVideoTracks()[0];
        if (track) {
          track.getSettings = () => ({
            displaySurface: 'monitor',
            width: 1920,
            height: 1080,
            frameRate: 30,
          });
        }
        return stream;
      };

      navigator.mediaDevices.enumerateDevices = async () => [];

      // Permissions: always granted so the Start Interview button is not disabled
      if (navigator.permissions) {
        navigator.permissions.query = async () => ({
          state: 'granted',
          addEventListener: () => {},
          removeEventListener: () => {},
        });
      }
    });

    // Invitation lookup (both id= and application_id= query forms)
    await page.route('**/api/fn/invitations-get**', (route) =>
      route.fulfill({ json: { invitation: INVITATION, is_expired: false } })
    );

    // Check for existing response — none exists, proceed to pre-call form
    await page.route('**/api/check-response', (route) =>
      route.fulfill({ json: { exists: false, call_id: null } })
    );

    await page.route('**/api/interviews/*', (route) =>
      route.fulfill({ json: INTERVIEW })
    );

    // More specific path first so it wins over any wildcard collision
    await page.route('**/api/invitations/*', (route) =>
      route.fulfill({ json: { success: true } })
    );

    await page.route('**/api/interviewers/*', (route) =>
      route.fulfill({ json: INTERVIEWER })
    );

    await page.route('**/api/deepgram-token', (route) =>
      route.fulfill({ json: { token: 'test-deepgram-token-123' } })
    );

    await page.route('**/api/responses/*', (route) =>
      route.fulfill({ json: { success: true } })
    );

    await page.route('**/api/responses', (route) =>
      route.fulfill({ status: 201, json: { id: 'call-test-001', call_id: 'call-test-001' } })
    );

    await page.route('**/api/register-call', (route) =>
      route.fulfill({ json: { success: true } })
    );
  });

  // 1. Page loads and shows pre-call form
  test('1. pre-call form loads after invitation is resolved', async ({ page }) => {
    await page.goto(`/call/${INVITATION_ID}`);
    await expect(page.locator('input[placeholder="Enter your email address"]')).toBeVisible({ timeout: 15000 });
  });

  // 2. Both email and name inputs are present and editable
  test('2. email and name inputs are visible and editable', async ({ page }) => {
    await page.goto(`/call/${INVITATION_ID}`);
    const emailInput = page.locator('input[placeholder="Enter your email address"]');
    const nameInput = page.locator('input[placeholder="Enter your first name"]');
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeEditable();
    await expect(nameInput).toBeEditable();
  });

  // 3. Invalid email shows inline error; Start Interview stays disabled
  test('3. invalid email shows validation error and Start Interview is disabled', async ({ page }) => {
    await page.goto(`/call/${INVITATION_ID}`);
    await expect(page.locator('input[placeholder="Enter your email address"]')).toBeVisible({ timeout: 15000 });

    await page.locator('input[placeholder="Enter your email address"]').fill('notanemail');
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Interview' })).toBeDisabled();
  });

  // 4. Completing the form and clicking Start transitions to the active interview UI
  test('4. valid form submission transitions to active interview', async ({ page }) => {
    await page.goto(`/call/${INVITATION_ID}`);
    await expect(page.locator('input[placeholder="Enter your email address"]')).toBeVisible({ timeout: 15000 });

    await page.locator('input[placeholder="Enter your email address"]').fill(CANDIDATE_EMAIL);
    await page.locator('input[placeholder="Enter your first name"]').fill('Test User');
    await expect(page.getByRole('button', { name: 'Start Interview' })).toBeEnabled({ timeout: 5000 });
    await page.getByRole('button', { name: 'Start Interview' }).click();

    await expect(page.getByRole('button', { name: 'End Interview' })).toBeVisible({ timeout: 20000 });
  });

  // 5. Active interview renders interviewer and candidate UI elements
  test('5. active interview shows interviewer and candidate UI elements', async ({ page }) => {
    await page.goto(`/call/${INVITATION_ID}`);
    await expect(page.locator('input[placeholder="Enter your email address"]')).toBeVisible({ timeout: 15000 });

    await page.locator('input[placeholder="Enter your email address"]').fill(CANDIDATE_EMAIL);
    await page.locator('input[placeholder="Enter your first name"]').fill('Test User');
    await page.getByRole('button', { name: 'Start Interview' }).click();

    await expect(page.getByRole('button', { name: 'End Interview' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Interviewer')).toBeVisible();
    await expect(page.getByText('You')).toBeVisible();
    await expect(page.locator('img[alt="Image of the interviewer"]')).toBeVisible();
  });

  // 6. Tab switch during active interview triggers the integrity warning dialog
  test('6. switching tabs during interview shows Integrity Warning dialog', async ({ page }) => {
    await page.goto(`/call/${INVITATION_ID}`);
    await expect(page.locator('input[placeholder="Enter your email address"]')).toBeVisible({ timeout: 15000 });

    await page.locator('input[placeholder="Enter your email address"]').fill(CANDIDATE_EMAIL);
    await page.locator('input[placeholder="Enter your first name"]').fill('Test User');
    await page.getByRole('button', { name: 'Start Interview' }).click();
    await expect(page.getByRole('button', { name: 'End Interview' })).toBeVisible({ timeout: 20000 });

    // Simulate the browser firing a visibilitychange event with document.hidden=true
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page.getByRole('heading', { name: 'Integrity Warning' })).toBeVisible({ timeout: 5000 });
  });

  // 7. Nested route /call/[interviewId]/[jobId]/[applicationId] resolves the invitation and redirects
  test('7. nested call route resolves invitation and redirects to pre-call form', async ({ page }) => {
    await page.goto(`/call/${INTERVIEW_ID}/${JOB_ID}/${APPLICATION_ID}`);
    await page.waitForURL(`**/call/${INVITATION_ID}`, { timeout: 15000 });
    await expect(page.locator('input[placeholder="Enter your email address"]')).toBeVisible({ timeout: 15000 });
  });
});
