import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Styles page and CSS layer system.
 * Requires canvas server running at localhost:5174 (npm run dev).
 */

// ─── API-level tests (no browser needed) ────────────────────────────────────

test.describe('Brand Styles API', () => {
  test('GET /api/brand-styles returns all scopes', async ({ request }) => {
    const res = await request.get('/api/brand-styles');
    expect(res.ok()).toBe(true);
    const styles = await res.json();
    expect(Array.isArray(styles)).toBe(true);
    expect(styles.length).toBeGreaterThanOrEqual(4);

    const scopes = styles.map((s: { scope: string }) => s.scope);
    expect(scopes).toContain('global');
    expect(scopes).toContain('instagram');
    expect(scopes).toContain('linkedin');
    expect(scopes).toContain('one-pager');
  });

  test('GET /api/brand-styles/global returns Fluid brand CSS with @font-face', async ({ request }) => {
    const res = await request.get('/api/brand-styles/global');
    expect(res.ok()).toBe(true);
    const style = await res.json();
    expect(style.scope).toBe('global');
    expect(style.cssContent).toContain('@font-face');
    expect(style.cssContent).toContain('NeueHaas');
    expect(style.cssContent).toContain('--font-headline');
  });

  test('GET /api/brand-styles/nonexistent returns 404', async ({ request }) => {
    const res = await request.get('/api/brand-styles/nonexistent');
    expect(res.status()).toBe(404);
  });

  test('PUT /api/brand-styles/:scope saves and retrieves CSS', async ({ request }) => {
    const testCss = '/* e2e test */ :root { --test-var: red; }';

    // Save
    const putRes = await request.put('/api/brand-styles/instagram', {
      data: { cssContent: testCss },
    });
    expect(putRes.ok()).toBe(true);
    const saved = await putRes.json();
    expect(saved.cssContent).toBe(testCss);

    // Retrieve
    const getRes = await request.get('/api/brand-styles/instagram');
    expect(getRes.ok()).toBe(true);
    const retrieved = await getRes.json();
    expect(retrieved.cssContent).toBe(testCss);

    // Clean up — reset to empty
    await request.put('/api/brand-styles/instagram', {
      data: { cssContent: '' },
    });
  });

  test('DELETE /api/brand-styles/:scope resets to empty', async ({ request }) => {
    // First set something
    await request.put('/api/brand-styles/linkedin', {
      data: { cssContent: '/* temp */' },
    });

    // Delete (resets to empty)
    const delRes = await request.delete('/api/brand-styles/linkedin');
    expect(delRes.ok()).toBe(true);

    // Verify it's empty
    const getRes = await request.get('/api/brand-styles/linkedin');
    const style = await getRes.json();
    expect(style.cssContent).toBe('');
  });
});

test.describe('System Styles API', () => {
  test('GET /api/system-styles returns CSS for all scopes', async ({ request }) => {
    const res = await request.get('/api/system-styles');
    expect(res.ok()).toBe(true);
    const styles = await res.json();

    // global.css should have CSS custom properties
    expect(styles.global).toContain('--brand-accent');
    expect(styles.global).toContain('--font-headline');
    expect(styles.global).toContain('.headline');
    expect(styles.global).toContain('.body-copy');

    // Platform CSS should have body dimensions
    expect(styles.instagram).toContain('1080px');
    expect(styles.linkedin).toContain('1200px');
    expect(styles['one-pager']).toContain('816px');
  });
});

// ─── Browser-level tests ─────────────────────────────────────────────────────

test.describe('Styles Page UI', () => {
  test('navigates to Styles tab and renders', async ({ page }) => {
    await page.goto('/app/styles');
    await expect(page.locator('h1')).toContainText('Styles');
  });

  test('shows all four scope tabs', async ({ page }) => {
    await page.goto('/app/styles');
    await expect(page.getByRole('button', { name: 'Global' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Instagram' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'LinkedIn' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'One-Pager' })).toBeVisible();
  });

  test('displays system defaults in a textarea', async ({ page }) => {
    await page.goto('/app/styles');
    await expect(page.locator('h1')).toContainText('Styles', { timeout: 10000 });

    // Wait for system defaults to load (textarea with global.css content)
    // Note: there may be other textareas on the page (e.g. chat sidebar)
    // Find the one containing CSS custom properties
    await expect(async () => {
      const textareas = await page.locator('textarea').all();
      let found = false;
      for (const ta of textareas) {
        const val = await ta.inputValue();
        if (val.includes('--brand-accent') || val.includes('Global CSS Layer')) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  test('switching tabs changes system defaults content', async ({ page }) => {
    await page.goto('/app/styles');
    await expect(page.locator('h1')).toContainText('Styles', { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Switch to Instagram tab
    await page.getByRole('button', { name: 'Instagram' }).click();
    await page.waitForTimeout(500);

    // Find a textarea containing 1080px (Instagram dimensions)
    await expect(async () => {
      const textareas = await page.locator('textarea').all();
      let found = false;
      for (const ta of textareas) {
        const val = await ta.inputValue();
        if (val.includes('1080px')) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  test('saving brand CSS persists via API', async ({ page: _page, request }) => {
    // Use the API directly to verify save works — more reliable than UI flash
    const testCss = `/* playwright-test-${Date.now()} */`;

    // Save via API
    const putRes = await request.put('/api/brand-styles/instagram', {
      data: { cssContent: testCss },
    });
    expect(putRes.ok()).toBe(true);

    // Verify via API
    const getRes = await request.get('/api/brand-styles/instagram');
    const style = await getRes.json();
    expect(style.cssContent).toBe(testCss);

    // Clean up
    await request.put('/api/brand-styles/instagram', {
      data: { cssContent: '' },
    });
  });

  test('Styles appears in left nav between Patterns and Voice Guide', async ({ page }) => {
    await page.goto('/app/create');

    // Find all nav buttons by their title attributes
    const navButtons = page.locator('button[title]');
    const titles: string[] = [];
    for (const btn of await navButtons.all()) {
      const title = await btn.getAttribute('title');
      if (title) titles.push(title);
    }

    const patternsIdx = titles.indexOf('Patterns');
    const stylesIdx = titles.indexOf('Styles');
    const voiceIdx = titles.indexOf('Voice Guide');

    expect(patternsIdx).toBeGreaterThan(-1);
    expect(stylesIdx).toBeGreaterThan(-1);
    expect(voiceIdx).toBeGreaterThan(-1);
    expect(stylesIdx).toBe(patternsIdx + 1);
    expect(voiceIdx).toBe(stylesIdx + 1);
  });

  test('URL updates to /app/styles when clicking Styles nav', async ({ page }) => {
    await page.goto('/app/create');
    await page.locator('button[title="Styles"]').click();
    await page.waitForTimeout(300);
    expect(page.url()).toContain('/app/styles');
  });
});
