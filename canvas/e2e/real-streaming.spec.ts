import { test, expect } from '@playwright/test';

test('real generation produces streaming messages', async ({ page }) => {
  // Listen to console for debugging
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');

  // Screenshot initial state
  await page.screenshot({ path: 'e2e-screenshots/01-initial.png', fullPage: true });

  // Find and fill the prompt textarea
  const textarea = page.locator('textarea');
  await textarea.fill('Say hello world in one sentence');

  // Click Generate button
  const generateBtn = page.locator('button', { hasText: /generate/i });
  await generateBtn.click();

  // Wait a moment for the request to go through
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e-screenshots/02-generating.png', fullPage: true });

  // Wait for actual streamed text content to appear in the sidebar
  // The sidebar is the leftmost column with width 320
  await page.waitForFunction(() => {
    const body = document.body.textContent || '';
    // Look for hello/Hello in the streamed text, or "Done" / "Generation complete"
    return /[Hh]ello/.test(body) || body.includes('Done') || body.includes('Generation complete');
  }, { timeout: 60000 });

  // Take screenshot showing streamed content
  await page.screenshot({ path: 'e2e-screenshots/03-streamed.png', fullPage: true });

  // Verify the streamed text is visible
  const bodyText = await page.evaluate(() => document.body.textContent || '');
  const hasStreamedContent = /[Hh]ello/.test(bodyText) || bodyText.includes('Generation complete');
  expect(hasStreamedContent).toBe(true);
  console.log('SUCCESS: Streamed content found in page');
});
