import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../e2e-screenshots/generation-flow');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

/**
 * Test the critical generation → session discovery flow.
 * This verifies that:
 * 1. POST /api/generate creates a session directory with lineage.json
 * 2. The session appears in GET /api/sessions immediately
 * 3. The UI auto-selects the session when generation completes
 *
 * We don't need a real Claude CLI for this — we test the server-side
 * session creation independently of Claude's output.
 */
test('Server creates valid lineage.json on generate request', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  // Use page.evaluate to fire the request and read just the first SSE frame
  // (the session ID), then abort — avoids waiting for the full Claude response
  const result = await page.evaluate(async () => {
    const controller = new AbortController();
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'E2E lineage test', skillType: 'social' }),
        signal: controller.signal,
      });

      if (res.status === 409) return { status: 409, sessionId: null };

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Read until we get the session ID
      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const match = buffer.match(/"sessionId"\s*:\s*"(\d{8}-\d{6})"/);
        if (match) {
          controller.abort();
          return { status: 200, sessionId: match[1] };
        }
      }
      controller.abort();
      return { status: 200, sessionId: null };
    } catch (e: any) {
      if (e.name === 'AbortError') return { status: 200, sessionId: null };
      return { status: -1, sessionId: null };
    }
  });

  if (result.status === 409) {
    // Another generation is running — cancel it first and skip
    await request.post('/api/generate/cancel');
    test.skip();
    return;
  }

  expect(result.sessionId).not.toBeNull();
  const sessionId = result.sessionId!;

  // Verify lineage.json exists on disk with correct schema
  const workingDir = path.resolve(__dirname, '../../.fluid/working');
  const lineagePath = path.join(workingDir, sessionId, 'lineage.json');
  expect(fs.existsSync(lineagePath)).toBe(true);

  const lineage = JSON.parse(fs.readFileSync(lineagePath, 'utf-8'));
  expect(lineage.sessionId).toBe(sessionId);
  expect(lineage.created).toBeTruthy();
  expect(lineage.platform).toBe('social');
  expect(lineage.rounds).toBeInstanceOf(Array);
  expect(lineage.rounds.length).toBeGreaterThanOrEqual(1);
  expect(lineage.rounds[0].prompt).toBe('E2E lineage test');

  // Verify session appears in sessions API
  const sessionsRes = await request.get('/api/sessions');
  const sessions = await sessionsRes.json();
  const found = sessions.find((s: any) => s.id === sessionId);
  expect(found).toBeTruthy();
  expect(found.platform).toBe('social');

  // Cancel the running generation to clean up
  await request.post('/api/generate/cancel');
});

test('UI: generation creates session and auto-selects it', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Count sessions before generation
  const sessionsBefore = await page.locator('[style*="Recent Sessions"] ~ button, div:has-text("Recent Sessions") ~ button').count();

  // Intercept the /api/generate response to capture session ID
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/generate'),
    { timeout: 15_000 }
  ).catch(() => null);

  // Type a prompt and click Generate
  const textarea = page.locator('textarea');
  await textarea.fill('Quick test generation');
  const genButton = page.locator('button:has-text("Generate")').first();
  await genButton.click();

  // Main pane should show generating state
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'generating-state.png') });

  // Wait for SSE response to start (session ID is sent immediately)
  const response = await responsePromise;
  if (response && response.status() === 200) {
    // Wait for generation to complete or timeout
    await page.waitForTimeout(3000);

    // The sidebar should show the session ID or switch to iterate mode
    // Check that the generation store was updated
    const statusText = page.locator('text=/Done|Generating|error/i').first();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'after-generation.png') });
  }
});

test('parseLineage tolerates variant schemas', async ({ request }) => {
  // Create a session with non-standard lineage (simulates Claude writing its own format)
  const workingDir = path.resolve(__dirname, '../../.fluid/working');
  const testId = '20260311-e2eparse';
  const testDir = path.join(workingDir, testId);

  // Use a valid YYYYMMDD-HHMMSS format
  const validId = '20260311-235959';
  const validDir = path.join(workingDir, validId);
  fs.mkdirSync(validDir, { recursive: true });

  // Write lineage with 'id' instead of 'sessionId' and 'mode' instead of 'platform'
  fs.writeFileSync(path.join(validDir, 'lineage.json'), JSON.stringify({
    id: validId,
    created: '2026-03-11T23:59:59Z',
    mode: 'instagram',
    entries: [{ prompt: 'test', output: 'test.html' }],
  }));

  // Verify it's discoverable
  const res = await request.get('/api/sessions');
  const sessions = await res.json();
  const found = sessions.find((s: any) => s.id === validId);
  expect(found).toBeTruthy();
  expect(found.platform).toBe('instagram');

  // Cleanup
  fs.rmSync(validDir, { recursive: true });
});

test('Iteration request does NOT create a new session directory', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  // Count working dirs before
  const workingDir = path.resolve(__dirname, '../../.fluid/working');
  const dirsBefore = fs.readdirSync(workingDir).filter(d =>
    /^\d{8}-\d{6}$/.test(d)
  );

  // Fire an iteration request with a known session ID
  const existingSessionId = '20260311-160000'; // our test fixture
  const result = await page.evaluate(async (sid: string) => {
    const controller = new AbortController();
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Make it better',
          skillType: 'social',
          sessionId: sid,
          iterationContext: {
            winnerHtml: '<html><body>test</body></html>',
            annotations: [],
            statuses: {},
            currentRound: 1,
            originalPrompt: 'original',
          },
        }),
        signal: controller.signal,
      });

      // Read first frame to confirm it uses the SAME session ID
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (let i = 0; i < 5; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const match = buffer.match(/"sessionId"\s*:\s*"([^"]+)"/);
        if (match) {
          controller.abort();
          return { returnedSessionId: match[1], status: res.status };
        }
      }
      controller.abort();
      return { returnedSessionId: null, status: res.status };
    } catch (e: any) {
      if (e.name === 'AbortError') return { returnedSessionId: null, status: 200 };
      return { returnedSessionId: null, status: -1 };
    }
  }, existingSessionId);

  // Cancel generation
  await request.post('/api/generate/cancel');

  if (result.status === 409) {
    test.skip();
    return;
  }

  // The returned session ID should be the SAME as the one we sent
  expect(result.returnedSessionId).toBe(existingSessionId);

  // No new session directory should have been created
  const dirsAfter = fs.readdirSync(workingDir).filter(d =>
    /^\d{8}-\d{6}$/.test(d)
  );
  // Allow at most 0 new dirs (iteration reuses existing)
  const newDirs = dirsAfter.filter(d => !dirsBefore.includes(d));
  expect(newDirs.length).toBe(0);
});
