import { test, expect } from '@playwright/test';

/**
 * End-to-end test for the generation streaming pipeline.
 *
 * Intercepts /api/generate to mock a realistic SSE stream (no real claude spawn),
 * then verifies that:
 *  1. Typing a prompt and clicking Generate triggers the request
 *  2. The sidebar shows streaming messages (text, tool-start, tool-done, status)
 *  3. The "Done" indicator appears when the stream completes
 */
test('streaming messages appear in sidebar when generating', async ({ page }) => {
  // Build a mock SSE response that mimics the real server output
  const sseLines = [
    // Session event (server-generated)
    `data: ${JSON.stringify({ type: 'session', sessionId: '20260101-120000' })}`,
    '',
    // System init event (should be filtered out)
    `data: ${JSON.stringify({ type: 'system', subtype: 'init', session_id: 'abc' })}`,
    '',
    // Text delta
    `data: ${JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'I will create a social post for you.' },
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
    `data: ${JSON.stringify({
      type: 'tool_result',
      tool_name: 'Write',
    })}`,
    '',
    // More text
    `data: ${JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 2,
        delta: { type: 'text_delta', text: 'The file has been created.' },
      },
    })}`,
    '',
    // Result event
    `data: ${JSON.stringify({ type: 'result', cost_usd: 0.01 })}`,
    '',
    // Done SSE event
    `event: done\ndata: ${JSON.stringify({ code: 0, sessionId: '20260101-120000' })}`,
    '',
  ];

  const sseBody = sseLines.join('\n');

  // Intercept the /api/generate POST and return our mock SSE
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

  // Navigate to the app
  await page.goto('/');

  // Wait for the prompt textarea to be visible
  const textarea = page.locator('textarea[placeholder*="Describe what you want"]');
  await expect(textarea).toBeVisible({ timeout: 5000 });

  // Type a prompt
  await textarea.fill('Create a social post about smart routing');

  // Click the Generate button
  const generateButton = page.locator('button', { hasText: 'Generate' });
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  // Wait for streaming messages to appear in the sidebar
  // Text message: "I will create a social post for you."
  const textMsg = page.locator('[data-msg-type="text"]', {
    hasText: 'I will create a social post for you.',
  });
  await expect(textMsg).toBeVisible({ timeout: 5000 });

  // Tool start message: "Using Write..."
  const toolStartMsg = page.locator('[data-msg-type="tool-start"]', {
    hasText: 'Using Write...',
  });
  await expect(toolStartMsg).toBeVisible({ timeout: 5000 });

  // Tool done message: "Write completed"
  const toolDoneMsg = page.locator('[data-msg-type="tool-done"]', {
    hasText: 'Write completed',
  });
  await expect(toolDoneMsg).toBeVisible({ timeout: 5000 });

  // Second text message should be merged or separate
  const secondText = page.locator('[data-msg-type="text"]', {
    hasText: 'The file has been created.',
  });
  await expect(secondText).toBeVisible({ timeout: 5000 });

  // Status message: "Generation complete" (from result event)
  const statusMsg = page.locator('[data-msg-type="status"]', {
    hasText: 'Generation complete',
  });
  await expect(statusMsg).toBeVisible({ timeout: 5000 });

  // "Done" indicator at the bottom
  const doneIndicator = page.locator('text=Done');
  await expect(doneIndicator).toBeVisible({ timeout: 5000 });
});

test('shows error state when generation fails', async ({ page }) => {
  // Mock a failed response
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 409,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Generation already in progress' }),
    });
  });

  await page.goto('/');

  const textarea = page.locator('textarea[placeholder*="Describe what you want"]');
  await expect(textarea).toBeVisible({ timeout: 5000 });
  await textarea.fill('Test error handling');

  const generateButton = page.locator('button', { hasText: 'Generate' });
  await generateButton.click();

  // Should show error state
  const errorMsg = page.locator('text=Generation failed');
  await expect(errorMsg).toBeVisible({ timeout: 5000 });
});
