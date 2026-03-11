import { test, expect } from '@playwright/test';

/**
 * Diagnostic streaming test with screenshot capture.
 * Mocks the SSE response and verifies streaming messages are visible.
 */
test('streaming messages are visible in sidebar (with screenshot proof)', async ({ page }) => {
  // Capture browser console logs
  const consoleLogs: string[] = [];
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  // Build a mock SSE response matching the server's actual format
  const sseLines = [
    // Session event
    `data: ${JSON.stringify({ type: 'session', sessionId: '20260311-120000' })}`,
    '',
    // Text delta via stream_event wrapper
    `data: ${JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello from the streaming agent! I am generating a social post about smart routing technology.' },
      },
    })}`,
    '',
    // Tool use start
    `data: ${JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'tool_1', name: 'Write' },
      },
    })}`,
    '',
    // Tool result
    `data: ${JSON.stringify({ type: 'tool_result', tool_name: 'Write' })}`,
    '',
    // Second text block
    `data: ${JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 2,
        delta: { type: 'text_delta', text: 'The social post has been created successfully with Fluid brand styling.' },
      },
    })}`,
    '',
    // Result event
    `data: ${JSON.stringify({ type: 'result', cost_usd: 0.01, duration_ms: 3000 })}`,
    '',
    // Done SSE event
    `event: done\ndata: ${JSON.stringify({ code: 0, sessionId: '20260311-120000' })}`,
    '',
  ];

  const sseBody = sseLines.join('\n');

  // Intercept the /api/generate POST
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: sseBody,
    });
  });

  // Navigate
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Take initial screenshot
  await page.screenshot({ path: 'e2e/screenshots/01-initial.png', fullPage: true });

  // Find and fill the textarea
  const textarea = page.locator('textarea[placeholder*="Describe what you want"]');
  await expect(textarea).toBeVisible({ timeout: 5000 });
  await textarea.fill('Create a social post about smart routing');

  // Take screenshot with prompt filled
  await page.screenshot({ path: 'e2e/screenshots/02-prompt-filled.png', fullPage: true });

  // Click Generate
  const generateButton = page.locator('button', { hasText: 'Generate' });
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  // Wait for text message to appear
  const textMsg = page.locator('[data-msg-type="text"]').first();
  await expect(textMsg).toBeVisible({ timeout: 10000 });

  // Wait a moment for all messages to render
  await page.waitForTimeout(500);

  // Take the proof screenshot
  await page.screenshot({ path: 'e2e/screenshots/03-streaming-messages.png', fullPage: true });

  // Verify all expected messages are visible
  await expect(page.locator('[data-msg-type="text"]', {
    hasText: 'Hello from the streaming agent!',
  })).toBeVisible();

  await expect(page.locator('[data-msg-type="tool-start"]', {
    hasText: 'Using Write...',
  })).toBeVisible();

  await expect(page.locator('[data-msg-type="tool-done"]', {
    hasText: 'Write completed',
  })).toBeVisible();

  await expect(page.locator('[data-msg-type="status"]', {
    hasText: 'Generation complete',
  })).toBeVisible();

  // Check Done indicator
  const doneIndicator = page.locator('text=Done');
  await expect(doneIndicator).toBeVisible({ timeout: 5000 });

  // Take final screenshot with everything visible
  await page.screenshot({ path: 'e2e/screenshots/04-final-with-done.png', fullPage: true });

  // Log browser console for debugging
  console.log('Browser console logs:', consoleLogs.join('\n'));

  // Inspect store state
  const storeState = await page.evaluate(() => {
    // Access the zustand store directly
    const store = (window as any).__zustandStores?.generation;
    if (!store) return 'Store not accessible via window';
    return store.getState();
  });
  console.log('Store state:', JSON.stringify(storeState));

  // Count visible messages
  const msgCount = await page.locator('[data-msg-type]').count();
  console.log(`Total visible stream messages: ${msgCount}`);
  expect(msgCount).toBeGreaterThanOrEqual(4);
});
