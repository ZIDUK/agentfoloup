import { chromium } from '@playwright/test';

async function globalSetup() {
  const email = process.env.CLERK_TEST_EMAIL;
  const password = process.env.CLERK_TEST_PASSWORD;

  if (!email) {
    throw new Error('CLERK_TEST_EMAIL environment variable is not set. Copy .env.test.example to .env.test and fill in the values.');
  }
  if (!password) {
    throw new Error('CLERK_TEST_PASSWORD environment variable is not set. Copy .env.test.example to .env.test and fill in the values.');
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/sign-in');
  await page.fill('input[name="identifier"]', email);
  await page.click('button[type="submit"]');
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));

  await context.storageState({ path: 'e2e/fixtures/auth.json' });
  await browser.close();
}

export default globalSetup;
