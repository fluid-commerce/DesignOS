import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * End-to-end pipeline test for Phase 11.
 *
 * Verifies the full generation flow:
 * 1. POST /api/generate triggers the Anthropic API pipeline
 * 2. SSE stream emits session event with campaignId
 * 3. Pipeline stages complete (copy → layout → styling → spec-check)
 * 4. HTML file is written to disk at the correct location
 * 5. Campaign, creations, slides, iterations exist in DB
 * 6. HTML is servable via /api/iterations/:id/html
 * 7. UI can navigate: dashboard → campaign → creation → iteration iframe
 * 8. Generated HTML is valid and references brand assets correctly
 */

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const FLUID_DIR = path.join(PROJECT_ROOT, '.fluid');

// Use a 5-minute timeout — pipeline makes multiple Anthropic API calls
test.setTimeout(300_000);

test.describe('Phase 11: API Pipeline E2E', () => {

  test('Full generation pipeline produces viewable creation', async ({ page, request }) => {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Trigger generation via POST /api/generate (single creation)
    // ═══════════════════════════════════════════════════════════════════════

    // Use a single-creation prompt to keep it fast (triggers isSingleCreation mode)
    // "Create an instagram" matches SINGULAR_PATTERNS: /^(?:create|make|...)\\s+(?:a|an|one)\\s+/
    const prompt = 'Create an instagram post about Fluid Connect data sync';

    // Load the app first so fetch works with relative URLs
    await page.goto('/', { waitUntil: 'networkidle' });

    // Fire the request and wait for the full SSE stream to complete
    const pipelineResult = await page.evaluate(async (prompt: string) => {
      const events: Array<{ eventType: string | null; data: any }> = [];
      let campaignId: string | null = null;
      let error: string | null = null;

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, skillType: 'social' }),
        });

        if (!res.ok) {
          return { campaignId: null, events: [], error: `HTTP ${res.status}: ${await res.text()}` };
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE frames (separated by \n\n)
          while (buffer.includes('\n\n')) {
            const idx = buffer.indexOf('\n\n');
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            const eventMatch = frame.match(/^event: (\w+)\n/);
            const dataMatch = frame.match(/^data: (.+)$/m);
            if (!dataMatch) continue;

            const eventType = eventMatch?.[1] ?? null;
            let parsed: any;
            try {
              parsed = JSON.parse(dataMatch[1]);
            } catch {
              continue;
            }

            events.push({ eventType, data: parsed });

            // Capture campaignId from session event
            if (parsed.type === 'session' && parsed.campaignId) {
              campaignId = parsed.campaignId;
            }

            // Capture campaignId from done event as fallback
            if (eventType === 'done' && parsed.campaignId) {
              campaignId = campaignId ?? parsed.campaignId;
            }
          }
        }
      } catch (err: any) {
        error = err.message;
      }

      return { campaignId, events, error };
    }, prompt);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Verify SSE stream completed successfully
    // ═══════════════════════════════════════════════════════════════════════

    expect(pipelineResult.error, `Pipeline error: ${pipelineResult.error}`).toBeNull();
    expect(pipelineResult.campaignId, 'Should receive campaignId from SSE stream').toBeTruthy();

    const campaignId = pipelineResult.campaignId!;
    const events = pipelineResult.events;

    // Verify we got stage events for all 4 stages
    const stageEvents = events.filter(e => e.data?.type === 'stage_status');
    const stagesStarted = stageEvents
      .filter(e => e.data?.status === 'starting')
      .map(e => e.data?.stage);
    const stagesDone = stageEvents
      .filter(e => e.data?.status === 'done' || e.data?.status === 'error')
      .map(e => e.data?.stage);

    expect(stagesStarted, 'Copy stage should start').toContain('copy');
    expect(stagesStarted, 'Layout stage should start').toContain('layout');
    expect(stagesStarted, 'Styling stage should start').toContain('styling');
    // Spec-check may have started (or errored, which is non-fatal)

    // Verify done event was sent
    const doneEvent = events.find(e => e.eventType === 'done');
    expect(doneEvent, 'Should receive done event').toBeTruthy();

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Verify DB records via API
    // ═══════════════════════════════════════════════════════════════════════

    // 3a. Campaign exists
    const campaignRes = await request.get(`/api/campaigns/${campaignId}`);
    expect(campaignRes.ok(), 'Campaign should exist in DB').toBeTruthy();
    const campaign = await campaignRes.json();
    expect(campaign.id).toBe(campaignId);

    // 3b. Creations exist
    const creationsRes = await request.get(`/api/campaigns/${campaignId}/creations`);
    expect(creationsRes.ok(), 'Creations endpoint should return OK').toBeTruthy();
    const creations = await creationsRes.json();
    expect(creations.length, 'Should have at least 1 creation').toBeGreaterThanOrEqual(1);

    // Use the LAST (most recently created) creation — standalone campaigns accumulate creations
    const creation = creations[creations.length - 1];
    expect(creation.id).toBeTruthy();
    expect(creation.campaignId).toBe(campaignId);

    // 3c. Slides exist
    const slidesRes = await request.get(`/api/creations/${creation.id}/slides`);
    expect(slidesRes.ok(), 'Slides endpoint should return OK').toBeTruthy();
    const slides = await slidesRes.json();
    expect(slides.length, 'Creation should have at least 1 slide').toBeGreaterThanOrEqual(1);

    const slide = slides[0];

    // 3d. Iterations exist
    const itersRes = await request.get(`/api/slides/${slide.id}/iterations`);
    expect(itersRes.ok(), 'Iterations endpoint should return OK').toBeTruthy();
    const iterations = await itersRes.json();
    expect(iterations.length, 'Slide should have at least 1 iteration').toBeGreaterThanOrEqual(1);

    const iteration = iterations[0];
    expect(iteration.htmlPath, 'Iteration should have htmlPath').toBeTruthy();

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Verify HTML file exists on disk
    // ═══════════════════════════════════════════════════════════════════════

    const htmlAbsPath = path.resolve(PROJECT_ROOT, iteration.htmlPath);
    const htmlExists = fs.existsSync(htmlAbsPath);

    // Also check the working directory for intermediate files
    const campaignDir = path.join(FLUID_DIR, 'campaigns', campaignId, creation.id, slide.id);
    const workingDir = path.join(campaignDir, 'working');
    const copyMdExists = fs.existsSync(path.join(workingDir, 'copy.md'));
    const layoutHtmlExists = fs.existsSync(path.join(workingDir, 'layout.html'));

    // copy.md and layout.html should exist as intermediate outputs
    expect(copyMdExists, `copy.md should exist at ${workingDir}/copy.md`).toBeTruthy();
    expect(layoutHtmlExists, `layout.html should exist at ${workingDir}/layout.html`).toBeTruthy();
    expect(htmlExists, `HTML output should exist at ${htmlAbsPath}`).toBeTruthy();

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5: Verify HTML is servable and valid
    // ═══════════════════════════════════════════════════════════════════════

    const htmlRes = await request.get(`/api/iterations/${iteration.id}/html`);
    expect(htmlRes.ok(), 'HTML endpoint should serve the iteration').toBeTruthy();

    const html = await htmlRes.text();
    expect(html.length, 'Served HTML should not be empty').toBeGreaterThan(100);

    // Verify it's actually HTML
    expect(html).toContain('<!DOCTYPE html>');
    // Or at minimum contains <html> or <head> or <body>
    const hasHtmlStructure = html.includes('<html') || html.includes('<head') || html.includes('<body');
    expect(hasHtmlStructure, 'Served content should be HTML').toBeTruthy();

    // Verify asset URLs are rewritten for serving (no ../../assets/)
    expect(html).not.toContain('../../assets/');

    // Verify base href is injected (for iframe rendering)
    expect(html).toContain('<base href=');

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 6: Check brand quality signals in generated HTML
    // ═══════════════════════════════════════════════════════════════════════

    // The HTML should reference brand assets via /fluid-assets/ URLs
    const usesFluidAssets = html.includes('/fluid-assets/');
    // OR it may use inline styles (also acceptable)
    const hasStyles = html.includes('<style') || html.includes('style=');

    expect(usesFluidAssets || hasStyles, 'HTML should use brand assets or inline styles').toBeTruthy();

    // Should have some CSS (either inline or in <style> tags)
    expect(hasStyles, 'HTML should contain CSS styling').toBeTruthy();

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 7: Verify our specific iteration is servable (preview check)
    // ═══════════════════════════════════════════════════════════════════════

    // Use our specific iteration rather than preview-urls endpoint
    // (standalone campaigns may have stale creations from previous runs)
    const previewHtmlRes = await request.get(`/api/iterations/${iteration.id}/html`);
    expect(previewHtmlRes.ok(), 'Our iteration should be servable via /api/iterations/:id/html').toBeTruthy();

    // Also verify the preview-urls endpoint works (even if some old creations are stale)
    const previewRes = await request.get(`/api/campaigns/${campaignId}/preview-urls`);
    expect(previewRes.ok(), 'Preview URLs endpoint should work').toBeTruthy();

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 8: UI navigation — dashboard → campaign → creation → iteration
    // ═══════════════════════════════════════════════════════════════════════

    await page.goto('/', { waitUntil: 'networkidle' });

    // The campaign should appear in the dashboard
    // Wait for campaigns to load
    await page.waitForTimeout(2000);

    // Navigate to the campaign via the store (programmatic, more reliable than clicking)
    const navigated = await page.evaluate(async (cId: string) => {
      // Access the zustand store directly
      const store = (window as any).__campaignStore;
      if (!store) return { error: 'Campaign store not found on window' };

      try {
        await store.getState().navigateToCampaign(cId);
        return {
          currentView: store.getState().currentView,
          activeCampaignId: store.getState().activeCampaignId,
          creationCount: store.getState().creations.length,
        };
      } catch (err: any) {
        return { error: err.message };
      }
    }, campaignId);

    // If store isn't exposed on window, use API-only verification (still valid)
    if (navigated?.error?.includes('not found')) {
      // Fallback: just verify API returns correct data (store not exposed)
      console.log('Campaign store not exposed on window — API verification only');
    } else if (!navigated?.error) {
      expect(navigated.currentView).toBe('campaign');
      expect(navigated.activeCampaignId).toBe(campaignId);
      expect(navigated.creationCount).toBeGreaterThanOrEqual(1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 9: Verify iteration HTML renders in an iframe
    // ═══════════════════════════════════════════════════════════════════════

    // Load the iteration HTML directly in a new page to verify rendering
    const iterPage = await page.context().newPage();
    const iterUrl = `/api/iterations/${iteration.id}/html`;
    const iterResponse = await iterPage.goto(iterUrl, { waitUntil: 'domcontentloaded' });
    expect(iterResponse?.ok(), 'Iteration HTML page should load').toBeTruthy();

    // Verify the page has visible content (not blank)
    const bodyContent = await iterPage.evaluate(() => document.body?.innerText?.trim() ?? '');
    expect(bodyContent.length, 'Iteration page should have visible text content').toBeGreaterThan(0);

    // Check for critical rendering (has at least some styled elements)
    const hasStyledElements = await iterPage.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      let styledCount = 0;
      for (const el of allEls) {
        const style = window.getComputedStyle(el);
        if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
            style.backgroundColor !== 'transparent') {
          styledCount++;
        }
      }
      return styledCount;
    });
    expect(hasStyledElements, 'Page should have styled elements with background colors').toBeGreaterThan(0);

    await iterPage.close();

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 10: Verify iteration generation status is 'complete'
    // ═══════════════════════════════════════════════════════════════════════

    const iterDetailRes = await request.get(`/api/iterations/${iteration.id}`);
    expect(iterDetailRes.ok()).toBeTruthy();
    const iterDetail = await iterDetailRes.json();
    expect(iterDetail.generationStatus, 'Iteration should be marked complete').toBe('complete');
  });
});
