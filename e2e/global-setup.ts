import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

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

  await page.goto(data.properties.action_link);
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15000 });

  await context.storageState({ path: 'e2e/fixtures/auth.json' });
  await browser.close();
}

export default globalSetup;
