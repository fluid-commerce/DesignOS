import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const SESSION_ID = '20260312-000000';

test.beforeAll(() => {
  execSync('node e2e/setup-filter-test.cjs setup', {
    cwd: '/Users/cheyrasmussen/Fluid Marketing Master Skills/canvas',
  });
});

test.afterAll(() => {
  execSync('node e2e/setup-filter-test.cjs cleanup', {
    cwd: '/Users/cheyrasmussen/Fluid Marketing Master Skills/canvas',
  });
});

test('intermediate pipeline files are filtered from variations', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    console.log('BROWSER:', msg.type(), msg.text());
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    errors.push(err.message);
  });

  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click our session
  const sessionBtn = page.locator(`button:has-text("${SESSION_ID}")`);
  await expect(sessionBtn).toBeVisible({ timeout: 5000 });

  // Intercept the session data API call
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes(`/api/sessions/${SESSION_ID}`)),
    sessionBtn.click(),
  ]);

  const data = await response.json();
  console.log('SESSION API RESPONSE:', JSON.stringify(data, null, 2));
  console.log('VARIATION COUNT:', data?.variations?.length);
  console.log('VARIATION PATHS:', data?.variations?.map((v: any) => v.path));

  await page.waitForTimeout(2000);

  // Check for page errors
  console.log('PAGE ERRORS:', errors);

  await page.screenshot({ path: 'e2e-screenshots/filter-02-session-view.png', fullPage: true });

  // The API should return only styled.html, not copy.html or layout.html
  expect(data.variations.length).toBe(1);
  expect(data.variations[0].path).toBe('styled.html');
});
