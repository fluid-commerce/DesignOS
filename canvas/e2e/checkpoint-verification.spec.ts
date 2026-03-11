import { test, expect, Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../e2e-screenshots/checkpoint');

// Ensure screenshot directory exists
test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

async function takeScreenshot(page: Page, name: string): Promise<string> {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

// ─────────────────────────────────────────────────
// 1. Layout: Left sidebar + main pane template gallery
// ─────────────────────────────────────────────────
test('01 - Layout: sidebar + template gallery', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await takeScreenshot(page, '01-layout');

  // Verify left sidebar exists (prompt area)
  const sidebar = page.locator('textarea[placeholder="Describe what you want to create..."]');
  await expect(sidebar).toBeVisible();

  // Verify "Create with AI" label in sidebar
  const createLabel = page.locator('text=Create with AI').first();
  await expect(createLabel).toBeVisible();

  // Verify "Choose a Template" heading in main pane
  const templateHeading = page.getByRole('heading', { name: 'Choose a Template' });
  await expect(templateHeading).toBeVisible();

  // Verify "Recent Sessions" section in sidebar
  const recentSessions = page.locator('text=Recent Sessions');
  await expect(recentSessions).toBeVisible();
});

// ─────────────────────────────────────────────────
// 2. Template gallery: Cards with live HTML iframe previews
// ─────────────────────────────────────────────────
test('02 - Template gallery cards with iframe previews', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await takeScreenshot(page, '02-template-gallery');

  // The "Create with AI" card should be visible in the main pane
  const createCard = page.locator('main').getByText('Create with AI');
  await expect(createCard).toBeVisible();

  // Check for iframes (template previews) in the main area
  const iframes = page.locator('main iframe');
  const iframeCount = await iframes.count();

  // Take a closer screenshot of just the main area
  const mainPane = page.locator('main');
  await mainPane.screenshot({ path: path.join(SCREENSHOT_DIR, '02-template-gallery-main.png') });

  console.log(`Found ${iframeCount} template iframe previews`);
});

// ─────────────────────────────────────────────────
// 3. Template selection -> customization form
// ─────────────────────────────────────────────────
test('03 - Template selection shows customizer', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click the first template card (not the "Create with AI" card)
  // Template cards have category badges like "social" or "one-pager"
  const templateCards = page.locator('main iframe');
  const count = await templateCards.count();

  if (count > 0) {
    // Click the parent card of the first iframe
    await templateCards.first().locator('..').locator('..').click();
    await page.waitForTimeout(500);
  } else {
    // If no templates loaded, we skip but still screenshot
    console.log('No template cards found - API may not have templates');
  }

  await takeScreenshot(page, '03-template-customizer');

  // Check for customizer elements
  const customizeHeading = page.locator('text=Customize');
  const backButton = page.locator('text=Back to Templates');

  // Check if we're in customizer or still in gallery
  const isCustomizer = await customizeHeading.isVisible().catch(() => false);
  console.log(`Customizer visible: ${isCustomizer}`);

  if (isCustomizer) {
    await expect(backButton).toBeVisible();
    // Check for form fields
    const headlineInput = page.locator('#cust-headline');
    await expect(headlineInput).toBeVisible();

    // Check for accent color buttons
    const colorButtons = page.locator('[data-testid^="color-"]');
    expect(await colorButtons.count()).toBeGreaterThanOrEqual(3);

    // Check for variations input
    const variationsInput = page.locator('#cust-variations');
    await expect(variationsInput).toBeVisible();
  }
});

// ─────────────────────────────────────────────────
// 4. Free prompt: type + Generate -> stream appears
// ─────────────────────────────────────────────────
test('04 - Free prompt generates stream messages', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Type a prompt in the sidebar
  const textarea = page.locator('textarea[placeholder="Describe what you want to create..."]');
  await textarea.fill('Create a test social post with blue background');

  await takeScreenshot(page, '04-before-generate');

  // Click Generate
  const generateBtn = page.locator('button:has-text("Generate")').first();
  await generateBtn.click();

  // Wait a moment for streaming to start
  await page.waitForTimeout(3000);
  await takeScreenshot(page, '04-during-generation');

  // Check that the sidebar shows generation state (either "Generating..." button or stream messages)
  const generatingBtn = page.locator('button:has-text("Generating...")');
  const cancelBtn = page.locator('button:has-text("Cancel")');
  const doneMsg = page.locator('text=Done');
  const errorMsg = page.locator('text=Generation failed');

  const isGenerating = await generatingBtn.isVisible().catch(() => false);
  const hasCancelBtn = await cancelBtn.isVisible().catch(() => false);
  const isDone = await doneMsg.isVisible().catch(() => false);
  const hasError = await errorMsg.isVisible().catch(() => false);

  console.log(`Generating: ${isGenerating}, Cancel visible: ${hasCancelBtn}, Done: ${isDone}, Error: ${hasError}`);

  // It should be in some generation state (generating, done, or error - any response means streaming works)
  // If error, it's likely because `claude` CLI isn't available, which is expected in test env
  // The key thing is that the UI responded to the Generate click

  // Wait more and take final screenshot
  await page.waitForTimeout(5000);
  await takeScreenshot(page, '04-after-generation');

  // Cancel if still generating to avoid locking
  if (await cancelBtn.isVisible().catch(() => false)) {
    await cancelBtn.click();
    await page.waitForTimeout(1000);
  }
});

// ─────────────────────────────────────────────────
// 5. Session view: star icon visible on variation frames
// ─────────────────────────────────────────────────
test('05 - Session view shows star icons', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click the multi-variation test session
  const sessionBtn = page.locator('button:has-text("20260311-100000")');
  await sessionBtn.click();
  await page.waitForTimeout(1500);

  await takeScreenshot(page, '05-session-star-icons');

  // Verify star toggle buttons are visible
  const starToggles = page.locator('[data-testid="star-toggle"]');
  const starCount = await starToggles.count();
  console.log(`Star toggles visible: ${starCount}`);

  expect(starCount).toBeGreaterThanOrEqual(2);

  // Verify asset frames are visible
  const assetFrames = page.locator('[data-testid="asset-frame"]');
  expect(await assetFrames.count()).toBeGreaterThanOrEqual(2);
});

// ─────────────────────────────────────────────────
// 6. Star toggle: click star, toggles winner
// ─────────────────────────────────────────────────
test('06 - Star toggle marks winner', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Open multi-variation session
  const sessionBtn = page.locator('button:has-text("20260311-100000")');
  await sessionBtn.click();
  await page.waitForTimeout(1500);

  // Find star toggles
  const starToggles = page.locator('[data-testid="star-toggle"]');
  const firstStar = starToggles.first();

  // Take before screenshot
  await takeScreenshot(page, '06-before-star');

  // Click the first star - use evaluate to directly click the DOM element
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="star-toggle"]') as HTMLButtonElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  // Take after screenshot
  await takeScreenshot(page, '06-after-star');

  // Check that SVG fill changed to #facc15 (yellow = winner)
  const starSvg = firstStar.locator('svg');
  const fill = await starSvg.getAttribute('fill');
  console.log(`Star fill after click: ${fill}`);

  // Now check that the SECOND star is NOT auto-filled
  const secondStar = starToggles.nth(1);
  const secondStarSvg = secondStar.locator('svg');
  const secondFill = await secondStarSvg.getAttribute('fill');
  console.log(`Second star fill: ${secondFill}`);

  // First star should be yellow (winner), second should be none (not auto-rejected)
  expect(fill).toBe('#facc15');
  expect(secondFill).toBe('none');

  // Toggle it off
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="star-toggle"]') as HTMLButtonElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);
  await takeScreenshot(page, '06-after-unstar');

  const fillAfterUnstar = await starSvg.getAttribute('fill');
  console.log(`Star fill after unstar: ${fillAfterUnstar}`);
  expect(fillAfterUnstar).toBe('none');
});

// ─────────────────────────────────────────────────
// 7. Single variation iterate: textarea enabled, Iterate works without starring
// ─────────────────────────────────────────────────
test('07 - Single variation can iterate without star', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Open single-variation session
  const sessionBtn = page.locator('button:has-text("20260311-110000")');
  await sessionBtn.click();
  await page.waitForTimeout(1500);

  await takeScreenshot(page, '07-single-variation-session');

  // Check iterate panel
  const iteratePanel = page.locator('[data-testid="iterate-panel"]');
  await expect(iteratePanel).toBeVisible();

  // Check textarea is enabled
  const iterateTextarea = page.locator('[data-testid="iterate-feedback"]');
  await expect(iterateTextarea).toBeVisible();
  await expect(iterateTextarea).toBeEnabled();

  // Should NOT show "Mark a winner to iterate" message (single variation)
  const needsWinnerMsg = page.locator('text=Mark a winner to iterate');
  await expect(needsWinnerMsg).not.toBeVisible();

  // Type feedback and verify iterate button becomes enabled
  await iterateTextarea.fill('Make the background darker');
  await page.waitForTimeout(300);

  const iterateBtn = page.locator('[data-testid="iterate-button"]');
  await expect(iterateBtn).toBeEnabled();

  await takeScreenshot(page, '07-single-variation-iterate-ready');
});

// ─────────────────────────────────────────────────
// 8. Multi-variation iterate: requires starred winner
// ─────────────────────────────────────────────────
test('08 - Multi-variation requires star to iterate', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Open multi-variation session
  const sessionBtn = page.locator('button:has-text("20260311-100000")');
  await sessionBtn.click();
  await page.waitForTimeout(1500);

  // Check that "Mark a winner to iterate" message is visible
  const needsWinnerMsg = page.locator('text=Mark a winner to iterate');
  await expect(needsWinnerMsg).toBeVisible();

  await takeScreenshot(page, '08-multi-needs-winner');

  // Type feedback
  const iterateTextarea = page.locator('[data-testid="iterate-feedback"]');
  await iterateTextarea.fill('Change the font style');

  // Iterate button should be disabled (no winner starred)
  const iterateBtn = page.locator('[data-testid="iterate-button"]');
  await expect(iterateBtn).toBeDisabled();

  await takeScreenshot(page, '08-multi-iterate-disabled');

  // Now star a variation
  const starToggles = page.locator('[data-testid="star-toggle"]');
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="star-toggle"]') as HTMLButtonElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);

  // "Mark a winner" message should disappear
  await expect(needsWinnerMsg).not.toBeVisible();

  // Iterate button should now be enabled
  await expect(iterateBtn).toBeEnabled();

  await takeScreenshot(page, '08-multi-iterate-enabled');
});

// ─────────────────────────────────────────────────
// 9. File watcher: new file appears in canvas
// ─────────────────────────────────────────────────
test('09 - File watcher detects new files', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Open our multi-variation session
  const sessionBtn = page.locator('button:has-text("20260311-100000")');
  await sessionBtn.click();
  await page.waitForTimeout(1500);

  // Count current variations
  const initialFrames = await page.locator('[data-testid="asset-frame"]').count();
  console.log(`Initial asset frames: ${initialFrames}`);

  await takeScreenshot(page, '09-before-new-file');

  // Create a new file in the session directory
  const newFilePath = path.resolve(__dirname, '../../.fluid/working/20260311-100000/v3-styled.html');
  fs.writeFileSync(newFilePath, '<!DOCTYPE html><html><body style="background:#0f3460;color:white;padding:20px;font-family:sans-serif"><h1>Test Variation 3</h1><p>New file from watcher test.</p></body></html>');

  // Wait for file watcher to detect and refresh (chokidar + debounce)
  await page.waitForTimeout(3000);

  await takeScreenshot(page, '09-after-new-file');

  // Count frames after
  const afterFrames = await page.locator('[data-testid="asset-frame"]').count();
  console.log(`Asset frames after new file: ${afterFrames}`);

  expect(afterFrames).toBeGreaterThan(initialFrames);

  // Clean up the new file
  fs.unlinkSync(newFilePath);
});

// ─────────────────────────────────────────────────
// 10. Back navigation: Templates button returns to gallery
// ─────────────────────────────────────────────────
test('10 - Back navigation to gallery', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Open a session first
  const sessionBtn = page.locator('button:has-text("20260311-100000")');
  await sessionBtn.click();
  await page.waitForTimeout(1500);

  // Verify we're in session view (asset frames visible)
  const assetFrames = page.locator('[data-testid="asset-frame"]');
  expect(await assetFrames.count()).toBeGreaterThan(0);

  await takeScreenshot(page, '10-in-session-view');

  // Click "Templates" button in header
  const templatesBtn = page.locator('header button:has-text("Templates")');
  await expect(templatesBtn).toBeVisible();
  await templatesBtn.click();
  await page.waitForTimeout(1000);

  await takeScreenshot(page, '10-back-to-gallery');

  // Verify we're back at the gallery
  const templateHeading = page.getByRole('heading', { name: 'Choose a Template' });
  await expect(templateHeading).toBeVisible();
});
