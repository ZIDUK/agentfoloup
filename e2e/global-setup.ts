import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Playwright doesn't auto-load .env.test — parse it manually
const envTestPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(envTestPath)) {
  for (const line of fs.readFileSync(envTestPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.TEST_USER_EMAIL;

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.test.example to .env.test and fill in the values.');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Copy .env.test.example to .env.test and fill in the values.');
  if (!email) throw new Error('TEST_USER_EMAIL is not set. Copy .env.test.example to .env.test and fill in the values.');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error || !data?.properties?.action_link) {
    throw new Error(`Failed to generate magic link: ${error?.message ?? 'no action_link in response'}`);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the action link. Supabase verifies the OTP and issues a 302 redirect to
  // the project's Site URL (production) because localhost is not in the allowed-redirect
  // list. The redirect carries valid session tokens in the URL fragment.
  await page.goto(data.properties.action_link);

  // page.goto returns after the load event fires on the redirect target.
  // page.url() includes the full URL with fragment at this point.
  const landedUrl = page.url();
  const hash = landedUrl.includes('#') ? landedUrl.split('#')[1] : '';
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresIn = parseInt(params.get('expires_in') ?? '3600');
  const expiresAt = parseInt(params.get('expires_at') ?? String(Math.floor(Date.now() / 1000) + expiresIn));

  if (!accessToken || !refreshToken) {
    throw new Error(`Could not extract session tokens from redirect URL.\nURL: ${landedUrl}`);
  }

  // Decode the JWT payload to reconstruct the user object for the session cookie.
  // The middleware reads session.user.email to validate @agenticdream.com domain.
  const jwtPayload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());

  const user = {
    id: jwtPayload.sub,
    aud: jwtPayload.aud ?? 'authenticated',
    role: jwtPayload.role ?? 'authenticated',
    email: jwtPayload.email,
    email_confirmed_at: new Date().toISOString(),
    phone: jwtPayload.phone ?? '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: jwtPayload.app_metadata ?? {},
    user_metadata: jwtPayload.user_metadata ?? {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };

  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    expires_in: expiresIn,
    token_type: 'bearer',
    user,
  };

  // @supabase/auth-helpers-nextjs stores the session in a cookie named
  // sb-{projectRef}-auth-token as a raw JSON string.
  const projectRef = supabaseUrl.match(/\/\/([^.]+)\./)?.[1] ?? '';
  const cookieName = `sb-${projectRef}-auth-token`;

  await context.addCookies([{
    name: cookieName,
    value: JSON.stringify(session),
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }]);

  // Navigate to /sign-in — the middleware now sees a valid session in the cookie
  // and redirects to /dashboard (validSession check passes for @agenticdream.com).
  await page.goto('http://localhost:3000/sign-in');
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15000 });

  await context.storageState({ path: 'e2e/fixtures/auth.json' });
  await browser.close();
}

export default globalSetup;
