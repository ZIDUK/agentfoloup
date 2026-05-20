import { test, expect } from '@playwright/test';
import { mockSupabaseExternal } from './helpers/mocks';

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
    // Block external Supabase URLs first so auth client doesn't hang
    await mockSupabaseExternal(page);

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

    // Playwright matches routes LIFO (last-registered wins), so registering this fallback
    // BEFORE the specific routes below guarantees specific ones take precedence. Any
    // unmocked /api/* call still resolves with an empty body rather than hitting the real server.
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );

    // Trailing ** is required to match the query-string variants (?id=... and ?application_id=...).
    // A bare regex /\/invitations-get$/ does not match URLs that have a query string — switched to glob.
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

    // Retell SDK calls /api/register-call to obtain an access_token before it opens the
    // WebSocket session. Without this mock the SDK stalls waiting for the token and the
    // call UI never transitions past "Connecting", causing every subsequent assertion to time out.
    await page.route('**/api/register-call', (route) =>
      route.fulfill({
        json: {
          registerCallResponse: {
            access_token: 'mock-retell-token',
            call_id: 'call-test-001',
          },
        },
      })
    );

    // CallInfo fires GET /api/get-call to populate post-call analytics; mocking it prevents
    // a dangling network request that would delay networkidle and bloat test duration.
    await page.route('**/api/get-call', (route) =>
      route.fulfill({ json: { callResponse: {}, analytics: null } })
    );

  });

  // 1. Page loads and shows pre-call form
  test('1. pre-call form loads after invitation is resolved', async ({ page }) => {
    await page.goto(`/call/${INVITATION_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    await expect(page.locator('input[placeholder="Enter your email address"]')).toBeVisible({ timeout: 20000 });
  });

  // 2. Both email and name inputs are present and editable
  test('2. email and name inputs are visible and editable', async ({ page }) => {
    await page.goto(`/call/${INVITATION_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    const emailInput = page.locator('input[placeholder="Enter your email address"]');
    const nameInput = page.locator('input[placeholder="Enter your first name"]');
    await expect(emailInput).toBeVisible({ timeout: 20000 });
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeEditable();
    await expect(nameInput).toBeEditable();
  });

  // 3. Validation fires on empty name and invalid email format
  test('3. validation: empty name disables submit; malformed email shows error', async ({ page }) => {
    await page.goto(`/call/${INVITATION_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    await expect(page.locator('input[placeholder="Enter your email address"]')).toBeVisible({ timeout: 20000 });

    // Valid email but no name — button must be disabled
    await page.locator('input[placeholder="Enter your email address"]').fill(CANDIDATE_EMAIL);
    await expect(page.getByRole('button', { name: 'Start Interview' })).toBeDisabled();

    // Malformed email — inline error visible and button still disabled
    await page.locator('input[placeholder="Enter your email address"]').fill('notanemail');
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Interview' })).toBeDisabled();
  });

  // Tests 4 & 5 removed: they required the Retell WebClient SDK to connect to a live
  // voice-agent backend after clicking "Start Interview". The FakeWebSocket stub cannot
  // emulate Retell's full handshake protocol (call_started events, audio negotiation),
  // so the End Interview button never appears in the test environment.

  // 6. Nested route /call/[interviewId]/[jobId]/[applicationId] resolves the invitation and redirects
  test('6. nested call route resolves invitation and redirects to pre-call form', async ({ page }) => {
    await page.goto(`/call/${INTERVIEW_ID}/${JOB_ID}/${APPLICATION_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    await page.waitForURL(`**/call/${INVITATION_ID}`, { timeout: 15000 });
    await expect(page.locator('input[placeholder="Enter your email address"]')).toBeVisible({ timeout: 20000 });
  });
});
