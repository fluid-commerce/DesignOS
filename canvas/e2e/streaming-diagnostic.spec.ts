import { test, expect } from '@playwright/test';

/**
 * Diagnostic test that takes screenshots at each stage to verify
 * the streaming pipeline visually.
 */
test('diagnostic: streaming renders visible messages with screenshots', async ({ page }) => {
  const sseLines = [
    `data: ${JSON.stringify({ type: 'session', sessionId: '20260101-120000' })}`,
    '',
    `data: ${JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'I will create a social post for you.' },
      },
    })}`,
    '',
    `data: ${JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'tool_1', name: 'Write' },
      },
    })}`,
    '',
    `data: ${JSON.stringify({ type: 'tool_result', tool_name: 'Write' })}`,
    '',
    `data: ${JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 2,
        delta: { type: 'text_delta', text: 'The file has been created.' },
      },
    })}`,
    '',
    `data: ${JSON.stringify({ type: 'result', cost_usd: 0.01 })}`,
    '',
    `event: done\ndata: ${JSON.stringify({ code: 0, sessionId: '20260101-120000' })}`,
    '',
  ];

  const sseBody = sseLines.join('\n');

  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: sseBody,
    });
  });

  // Also mock /api/sessions to avoid real server dependency
  await page.route('**/api/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    });
  });

  await page.goto('/');
  await page.screenshot({ path: 'e2e/screenshots/01-initial.png', fullPage: true });

  const textarea = page.locator('textarea[placeholder*="Describe what you want"]');
  await expect(textarea).toBeVisible({ timeout: 5000 });
  await textarea.fill('Create a social post about smart routing');
  await page.screenshot({ path: 'e2e/screenshots/02-prompt-entered.png', fullPage: true });

  const generateButton = page.locator('button', { hasText: 'Generate' });
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  // Wait for messages to appear
  const textMsg = page.locator('[data-msg-type="text"]').first();
  await expect(textMsg).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'e2e/screenshots/03-messages-visible.png', fullPage: true });

  // Verify all message types rendered
  const allMsgs = await page.locator('[data-msg-type]').count();
  console.log(`Total messages rendered: ${allMsgs}`);

  const msgTypes = await page.locator('[data-msg-type]').evaluateAll(
    els => els.map(el => ({
      type: el.getAttribute('data-msg-type'),
      text: el.textContent?.slice(0, 50),
      visible: (el as HTMLElement).offsetHeight > 0,
    }))
  );
  console.log('Message details:', JSON.stringify(msgTypes, null, 2));

  // Check for the "Done" indicator
  const done = page.locator('text=Done');
  await expect(done).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'e2e/screenshots/04-done.png', fullPage: true });

  expect(allMsgs).toBeGreaterThanOrEqual(4);
});

/**
 * Test with real server (no route mock).
 * This verifies what happens when hitting the actual /api/generate.
 */
test('diagnostic: real server response handling', async ({ page }) => {
  // Don't mock -- hit real server
  // Also mock /api/sessions to avoid noise
  await page.route('**/api/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    });
  });

  await page.goto('/');

  const textarea = page.locator('textarea[placeholder*="Describe what you want"]');
  await expect(textarea).toBeVisible({ timeout: 5000 });
  await textarea.fill('test prompt');

  const generateButton = page.locator('button', { hasText: 'Generate' });
  await generateButton.click();

  // Wait a moment for the response
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/05-real-server.png', fullPage: true });

  // Check what state the UI is in
  const hasError = await page.locator('text=Generation failed').isVisible().catch(() => false);
  const hasGenerating = await page.locator('button:has-text("Generating...")').isVisible().catch(() => false);
  const hasMessages = await page.locator('[data-msg-type]').count();

  console.log(`Real server test - Error: ${hasError}, Still generating: ${hasGenerating}, Messages: ${hasMessages}`);
});
