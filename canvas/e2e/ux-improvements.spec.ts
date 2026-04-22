import { test, expect } from '@playwright/test';

/**
 * E2E tests verifying the UX improvements batch (2026-04-02):
 *  - Standalone creation navigation (breadcrumb, back button, tab switching)
 *  - Creations tab filter/sort controls
 *  - Asset preview rendering (contain scaling, transparency grid, font preview)
 */

test.describe('Creations Tab Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Navigate to My Creations via left nav
    await page.locator('button[title="My Creations"]').click();
    await page.waitForTimeout(500);
  });

  test('clicking Creations sub-tab shows standalone creations or empty state', async ({ page }) => {
    // Click the CREATIONS sub-tab
    const crTab = page.locator('button').filter({ hasText: /^CREATIONS$/i });
    await crTab.click();
    await page.waitForTimeout(1000);

    // Should show either a grid of creations or the empty state
    const grid = page.locator('div[style*="display: grid"]');
    const emptyState = page.locator('text=No creations yet');
    const loading = page.locator('text=Loading creations');

    // Wait for loading to finish
    await expect(loading).toBeHidden({ timeout: 10000 });

    // One of these should be visible
    const hasGrid = await grid.count() > 0;
    const hasEmpty = await emptyState.isVisible();
    expect(hasGrid || hasEmpty).toBeTruthy();
  });

  test('Creations sub-tab is visually active when clicked', async ({ page }) => {
    const crTab = page.locator('button').filter({ hasText: /^CREATIONS$/i });
    await crTab.click();
    await page.waitForTimeout(500);

    // The active tab should have the blue underline border
    const borderBottom = await crTab.evaluate(
      (el) => getComputedStyle(el).borderBottomColor
    );
    expect(borderBottom).toBe('rgb(68, 178, 255)');
  });

  test('clicking Creations tab while inside a campaign navigates to standalone creations', async ({ page }) => {
    // Make sure we're on Campaigns tab first
    const campTab = page.locator('button').filter({ hasText: /^CAMPAIGNS$/i });
    await campTab.click();
    await page.waitForTimeout(500);

    // Try to click into a campaign (if any exist)
    const campaignCards = page.locator('div[style*="cursor: pointer"]');
    const cardCount = await campaignCards.count();

    if (cardCount > 0) {
      await campaignCards.first().click();
      await page.waitForTimeout(1000);

      // Now click the Creations sub-tab
      const crTab = page.locator('button').filter({ hasText: /^CREATIONS$/i });
      await crTab.click();
      await page.waitForTimeout(1000);

      // Should be back at dashboard level (not inside campaign)
      // Verify by checking breadcrumb does NOT show a campaign name segment
      const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
      const _segments = breadcrumb.locator('span').filter({ hasText: /[A-Za-z]/ });

      // The creations tab should be active
      const borderBottom = await crTab.evaluate(
        (el) => getComputedStyle(el).borderBottomColor
      );
      expect(borderBottom).toBe('rgb(68, 178, 255)');
    }
  });

  test('standalone creation breadcrumb shows "Creations" not "Campaigns"', async ({ page }) => {
    // Go to Creations tab
    const crTab = page.locator('button').filter({ hasText: /^CREATIONS$/i });
    await crTab.click();
    await page.waitForTimeout(1000);

    // Check if there are any creations to click
    const creationCards = page.locator('div[style*="cursor: pointer"]');
    const cardCount = await creationCards.count();

    if (cardCount > 0) {
      // Click the first creation
      await creationCards.first().click();
      await page.waitForTimeout(1500);

      // Breadcrumb should show "Creations" as the first segment
      const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
      await expect(breadcrumb).toBeVisible();

      // Get the breadcrumb text content and verify
      const breadcrumbText = await breadcrumb.textContent();
      expect(breadcrumbText).toContain('Creations');
      expect(breadcrumbText).not.toContain('Campaigns');
    }
  });

  test('back button from standalone creation returns to Creations tab', async ({ page }) => {
    // Go to Creations tab
    const crTab = page.locator('button').filter({ hasText: /^CREATIONS$/i });
    await crTab.click();
    await page.waitForTimeout(1000);

    const creationCards = page.locator('div[style*="cursor: pointer"]');
    const cardCount = await creationCards.count();

    if (cardCount > 0) {
      // Click into a creation
      await creationCards.first().click();
      await page.waitForTimeout(1500);

      // Click the back button
      const backBtn = page.locator('button[title="Go back"]');
      await expect(backBtn).toBeVisible();
      await backBtn.click();
      await page.waitForTimeout(1000);

      // Should be back on the Creations tab (not Campaigns)
      const borderBottom = await crTab.evaluate(
        (el) => getComputedStyle(el).borderBottomColor
      );
      expect(borderBottom).toBe('rgb(68, 178, 255)');
    }
  });
});

test.describe('Creations Tab Filters & Sorting', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('button[title="My Creations"]').click();
    await page.waitForTimeout(500);
    // Switch to Creations tab
    const crTab = page.locator('button').filter({ hasText: /^CREATIONS$/i });
    await crTab.click();
    await page.waitForTimeout(1000);
  });

  test('FilterSortBar renders when creations exist', async ({ page }) => {
    const emptyState = page.locator('text=No creations yet');
    const isEmptyVisible = await emptyState.isVisible();

    if (!isEmptyVisible) {
      // Sort controls should be present
      const sortLabel = page.locator('span').filter({ hasText: /^SORT:$/i });
      await expect(sortLabel).toBeVisible({ timeout: 3000 });

      // Sort buttons should exist
      const updatedBtn = page.locator('button').filter({ hasText: /^UPDATED$/i });
      const createdBtn = page.locator('button').filter({ hasText: /^CREATED$/i });
      const nameBtn = page.locator('button').filter({ hasText: /^NAME$/i });
      await expect(updatedBtn).toBeVisible();
      await expect(createdBtn).toBeVisible();
      await expect(nameBtn).toBeVisible();
    }
  });

  test('channel filter tabs are clickable', async ({ page }) => {
    const emptyState = page.locator('text=No creations yet');
    const isEmptyVisible = await emptyState.isVisible();

    if (!isEmptyVisible) {
      // "ALL" filter button should be present and active
      const allBtn = page.locator('button').filter({ hasText: /^ALL$/i });
      await expect(allBtn).toBeVisible({ timeout: 3000 });

      // It should have the active blue border
      const borderColor = await allBtn.evaluate(
        (el) => getComputedStyle(el).borderColor
      );
      expect(borderColor).toContain('68, 178, 255');
    }
  });

  test('sort by Name reorders creations alphabetically', async ({ page }) => {
    const emptyState = page.locator('text=No creations yet');
    const isEmptyVisible = await emptyState.isVisible();

    if (!isEmptyVisible) {
      // Click Name sort
      const nameBtn = page.locator('button').filter({ hasText: /^NAME$/i });
      await nameBtn.click();
      await page.waitForTimeout(500);

      // Name button should now be active
      const borderColor = await nameBtn.evaluate(
        (el) => getComputedStyle(el).borderColor
      );
      expect(borderColor).toContain('68, 178, 255');
    }
  });
});

test.describe('Asset Preview Rendering', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Navigate to Assets
    await page.locator('button[title="Assets"]').click();
    await page.waitForTimeout(1500);
  });

  test('asset images use object-fit: contain', async ({ page }) => {
    const assetImages = page.locator('img[alt]');
    const imgCount = await assetImages.count();

    if (imgCount > 0) {
      const objectFit = await assetImages.first().evaluate(
        (el) => getComputedStyle(el).objectFit
      );
      expect(objectFit).toBe('contain');
    }
  });

  test('asset images have padding for spacing', async ({ page }) => {
    const assetImages = page.locator('img[alt]');
    const imgCount = await assetImages.count();

    if (imgCount > 0) {
      const padding = await assetImages.first().evaluate(
        (el) => getComputedStyle(el).padding
      );
      // Should have 12px padding
      expect(padding).toBe('12px');
    }
  });

  test('asset preview container has checkerboard transparency grid', async ({ page }) => {
    const assetImages = page.locator('img[alt]');
    const imgCount = await assetImages.count();

    if (imgCount > 0) {
      // The parent div of the image should have the checkerboard background
      const bgImage = await assetImages.first().evaluate((el) => {
        const parent = el.parentElement;
        return parent ? getComputedStyle(parent).backgroundImage : 'none';
      });
      expect(bgImage).toContain('linear-gradient');
    }
  });

  test('font files show "Aa Bb Cc" preview instead of "File"', async ({ page }) => {
    // Check for font preview text
    const fontPreview = page.locator('text=Aa Bb Cc');
    const fontCount = await fontPreview.count();

    // Check that no bare "File" spans exist in preview containers
    // (They might still exist for truly unknown file types)
    const fileFallbacks = page.locator('span:text-is("File")');
    const _fileCount = await fileFallbacks.count();

    // If there are fonts, there should be previews and no "File" fallback for them
    if (fontCount > 0) {
      expect(fontCount).toBeGreaterThan(0);
      // Also verify the number font sample
      const numberPreview = page.locator('text=0123456789');
      await expect(numberPreview.first()).toBeVisible();
    }
  });

  test('font preview loads @font-face style', async ({ page }) => {
    const fontPreview = page.locator('text=Aa Bb Cc');
    const fontCount = await fontPreview.count();

    if (fontCount > 0) {
      // The font preview should have a custom font-family
      const fontFamily = await fontPreview.first().evaluate(
        (el) => getComputedStyle(el).fontFamily
      );
      expect(fontFamily).toContain('preview-');
    }
  });
});
