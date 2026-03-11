import { test, expect } from '@playwright/test';

test('main pane switches to session view on generate and shows streaming', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');

  // Mock the SSE endpoint
  await page.route('**/api/generate', async (route) => {
    const body = [
      'data: {"type":"session","sessionId":"test-gen-1"}\n\n',
      'data: {"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Starting generation..."}]}}\n\n',
      'event: done\ndata: {"done":true}\n\n',
    ].join('');

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body,
    });
  });

  // Should start on gallery view
  const gallery = page.locator('h2:has-text("Choose a Template")');
  await expect(gallery).toBeVisible({ timeout: 5000 });

  // Type a prompt and click Generate
  const textarea = page.locator('textarea');
  await textarea.fill('test generating state');
  const genBtn = page.locator('button:has-text("Generate")').first();
  await genBtn.click();

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e-screenshots/gen-ux-01-after-generate.png', fullPage: true });

  // Gallery should be gone (switched to session view)
  await expect(gallery).not.toBeVisible({ timeout: 3000 });

  // Streaming message should appear in sidebar
  const streamMsg = page.locator('text=Starting generation');
  await expect(streamMsg).toBeVisible({ timeout: 5000 });

  // "Done" indicator should show
  const doneText = page.locator('text=Done');
  await expect(doneText).toBeVisible({ timeout: 3000 });
});
