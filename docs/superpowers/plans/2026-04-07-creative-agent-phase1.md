# Creative Agent Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working single-agent chat that can generate creations with harness-enforced validation, replacing the old 4-stage pipeline.

**Architecture:** Cherry-pick the agent core from `feat/sandbox-pipeline` branch (agent loop, tools, chat routes, UI), then build the harness layer on top: Brand Brief assembler, validation lifecycle hooks, CSS merge on save, token tracking, and render preview improvements. The old `api-pipeline.ts` and subagent files are deleted; the new `agent.ts` + harness hooks become the generation engine.

**Tech Stack:** React 19, TypeScript, Zustand 5, better-sqlite3, Anthropic SDK, Playwright, Vite middleware.

**Spec:** `docs/superpowers/specs/2026-04-07-creative-agent-architecture.md`

**Branch:** `feat/sandbox-pipeline` has the agent core. Work on `harness-improve` (current branch), cherry-picking from sandbox as needed.

---

### Task 1: Add chat tables to database schema

The sandbox branch added `chats` and `chat_messages` tables. We need these in our schema.

**Files:**
- Modify: `canvas/src/lib/db.ts` (add CREATE TABLE statements in `initSchema`)

- [ ] **Step 1: Add chats and chat_messages tables to initSchema**

In `canvas/src/lib/db.ts`, add to the `initSchema` function, after the existing `CREATE TABLE` statements (after the `brand_styles` table around line 216):

```sql
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  tool_calls TEXT,
  tool_results TEXT,
  ui_context TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
```

- [ ] **Step 2: Verify the app starts clean**

Run: `cd canvas && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors.

Delete `canvas/fluid.db` and restart the dev server to verify tables are created:
Run: `rm -f canvas/fluid.db && cd canvas && npm run dev`
Expected: App starts, DB rebuilds with new tables.

- [ ] **Step 3: Commit**

```bash
git add canvas/src/lib/db.ts
git commit -m "feat: add chats and chat_messages tables to schema"
```

---

### Task 2: Add agent core (agent loop + tools + system prompt)

Cherry-pick and adapt the agent core from the sandbox branch. This is the biggest task — it brings in the tool-use loop, all 20 tools, the system prompt, and the render engine.

**Files:**
- Create: `canvas/src/server/agent.ts` (from `feat/sandbox-pipeline`)
- Create: `canvas/src/server/agent-tools.ts` (from `feat/sandbox-pipeline`)
- Create: `canvas/src/server/agent-system-prompt.ts` (rewritten per spec)
- Create: `canvas/src/server/render-engine.ts` (from `feat/sandbox-pipeline`, modified for WebP)

- [ ] **Step 1: Copy agent.ts from sandbox branch**

```bash
git show feat/sandbox-pipeline:canvas/src/server/agent.ts > canvas/src/server/agent.ts
```

- [ ] **Step 2: Copy agent-tools.ts from sandbox branch**

```bash
git show feat/sandbox-pipeline:canvas/src/server/agent-tools.ts > canvas/src/server/agent-tools.ts
```

- [ ] **Step 3: Copy render-engine.ts from sandbox branch**

```bash
git show feat/sandbox-pipeline:canvas/src/server/render-engine.ts > canvas/src/server/render-engine.ts
```

- [ ] **Step 4: Modify render-engine.ts for WebP output + timeout**

In `canvas/src/server/render-engine.ts`, replace the screenshot section in `renderPreview`:

```typescript
export async function renderPreview(
  html: string,
  width: number,
  height: number
): Promise<string> {
  const ctx = await ensureBrowser();
  const page = await ctx.newPage();

  try {
    await page.setViewportSize({ width, height });

    // Rewrite /fluid-assets/ URLs to absolute file paths
    const assetsDir = path.join(PROJECT_ROOT, 'assets');
    const resolvedHtml = html.replace(
      /\/fluid-assets\//g,
      `file://${assetsDir}/`
    ).replace(
      /\/api\/brand-assets\/serve\//g,
      `file://${assetsDir}/`
    );

    // Write to temp file so file:// URLs resolve correctly
    const tmpFile = path.join(os.tmpdir(), `fluid-render-${Date.now()}.html`);
    fs.writeFileSync(tmpFile, resolvedHtml, 'utf-8');

    // 10-second timeout for page load
    await page.goto(`file://${tmpFile}`, {
      waitUntil: 'networkidle',
      timeout: 10000,
    });

    // Brief pause for fonts/images to load
    await page.waitForTimeout(200);

    // WebP at 75% quality — 3-5x smaller than PNG, sufficient for layout checks
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 75 });
    const base64 = screenshot.toString('base64');

    fs.unlinkSync(tmpFile);
    return base64;
  } catch (err) {
    // Non-fatal — creation still saves, just without visual self-check
    throw new Error(`Render preview failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await page.close();
  }
}
```

Note: Playwright doesn't support WebP screenshots natively. We use JPEG at 75% quality which achieves the same size reduction goal. If WebP is needed later, a post-processing step with `sharp` can be added.

- [ ] **Step 5: Write the system prompt per spec Section 10**

Create `canvas/src/server/agent-system-prompt.ts`:

```typescript
/**
 * Agent system prompt — assembled from Tier 1 constants + Tier 2 Brand Brief.
 * The Brand Brief section is injected dynamically from the DB.
 */

// Tier 1: Static system rules (brand-agnostic, universal)
const TIER1_PROMPT = `You are a creative partner for a brand design system. You generate marketing assets, discuss brand strategy, and iterate based on user feedback.

## Workflow

When creating an asset:
1. Review the Brand Brief below for context
2. Choose an appropriate archetype (use list_archetypes / read_archetype)
3. Generate complete, self-contained HTML
4. Render a preview to visually check your work
5. Fix obvious issues (spacing, hierarchy, missing elements)
6. Save with save_creation — the system will validate automatically and tell you if there are issues
7. Present to the user: "Here you go, what next?"

## Structural Rules (non-negotiable)

- All CSS in \`<style>\` blocks with class selectors. Never use inline \`style=""\` attributes.
- Self-contained HTML. No external CDN links or stylesheet references.
- Decorative/background elements use \`<div>\` with \`background-image: url()\`, never \`<img>\` tags.
- Only use fonts that appear in the Asset Manifest section of the Brand Brief.
- Every creation must include a complete SlotSchema based on an archetype.
- Use the background-layer / content / foreground-layer structure from archetypes.

## Intent Gating

- Only modify brand data (patterns, voice guide) when the user explicitly asks.
- When iterating on a creation, preserve the user's direct edits (from the slot editor) unless they say otherwise.

## Platform Dimensions

Instagram Square: 1080x1080
Instagram Story: 1080x1920
LinkedIn Post: 1200x627
LinkedIn Article: 1200x644
Facebook Post: 1200x630
Twitter/X Post: 1200x675
One-Pager: 1280x1600`;

/**
 * Build the full system prompt by combining Tier 1 rules with Tier 2 Brand Brief
 * and current UI context.
 */
export function buildSystemPrompt(
  brandBrief: string,
  uiContext?: { currentView?: string; activeCampaignId?: string; activeCreationId?: string; activeIterationId?: string } | null,
): string {
  const parts = [TIER1_PROMPT];

  // Tier 2: Brand Brief (from DB)
  if (brandBrief) {
    parts.push(brandBrief);
  }

  // UI context awareness
  if (uiContext) {
    parts.push(`## Current Context

The user is currently viewing: ${uiContext.currentView || 'dashboard'}
Active campaign: ${uiContext.activeCampaignId || 'none'}
Active creation: ${uiContext.activeCreationId || 'none'}
Active iteration: ${uiContext.activeIterationId || 'none'}

When the user says "make it punchier" or "try a different color," they mean the active creation. When they reference "the campaign," they mean the active campaign.`);
  }

  return parts.join('\n\n');
}
```

- [ ] **Step 6: Update agent.ts to use buildSystemPrompt instead of static SYSTEM_PROMPT**

In `canvas/src/server/agent.ts`, change the import and usage:

Replace:
```typescript
import { SYSTEM_PROMPT } from './agent-system-prompt';
```

With:
```typescript
import { buildSystemPrompt } from './agent-system-prompt';
import { buildBrandBrief } from './brand-brief';
```

In the `runAgent` function, before the tool-use loop, build the system prompt dynamically:

Replace the line:
```typescript
system: SYSTEM_PROMPT,
```

With:
```typescript
system: buildSystemPrompt(buildBrandBrief(), uiContext),
```

(The `buildBrandBrief` function is created in Task 3.)

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd canvas && npx tsc --noEmit 2>&1 | head -30`
Expected: Errors about missing `buildBrandBrief` import (expected — Task 3 creates it). No other errors.

- [ ] **Step 8: Commit**

```bash
git add canvas/src/server/agent.ts canvas/src/server/agent-tools.ts canvas/src/server/agent-system-prompt.ts canvas/src/server/render-engine.ts
git commit -m "feat: add agent core with tool-use loop, tools, system prompt, and render engine"
```

---

### Task 3: Build the Brand Brief assembler

The Brand Brief is the Tier 2 context document assembled from DB tables and injected into the system prompt. It reuses the existing `context_map` table and `loadContextForStage` pattern from `api-pipeline.ts`, adapted for the single-agent model.

**Files:**
- Create: `canvas/src/server/brand-brief.ts`

- [ ] **Step 1: Write the Brand Brief assembler**

Create `canvas/src/server/brand-brief.ts`:

```typescript
/**
 * brand-brief.ts
 * Assembles the Tier 2 Brand Brief from DB tables for injection into the agent system prompt.
 *
 * Sources: voice_guide_docs, brand_patterns, brand_assets, brand_styles, context_map.
 * The brief is rebuilt on each chat message (cheap — all reads are local SQLite).
 */

import { getDb } from '../lib/db';

// 4-chars-per-token heuristic for budget enforcement
const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_TOKENS = 6000;
const PER_SECTION_CAP_RATIO = 0.6;

interface BriefSection {
  slug: string;
  label: string;
  content: string;
  tokens: number;
}

/**
 * Build the Brand Brief markdown string from DB tables.
 * Uses context_map entries where stage='brief' to determine which sections to include.
 * Falls back to loading all high-weight content if no brief entries exist.
 */
export function buildBrandBrief(creationType?: string): string {
  const db = getDb();

  const parts: string[] = ['## Brand Brief'];

  // --- Voice Guide (top entries) ---
  const voiceDocs = db.prepare(
    'SELECT slug, label, content FROM voice_guide_docs ORDER BY sort_order ASC'
  ).all() as Array<{ slug: string; label: string; content: string }>;

  if (voiceDocs.length > 0) {
    parts.push('### Voice');
    // Include first 3 docs (condensed) — adjust via context_map in future
    for (const doc of voiceDocs.slice(0, 3)) {
      const truncated = doc.content.length > 800
        ? doc.content.slice(0, 800) + '\n[truncated]'
        : doc.content;
      parts.push(`**${doc.label}**\n${truncated}`);
    }
  }

  // --- Hard Rules (weight >= 81) ---
  const hardRules = db.prepare(
    'SELECT slug, label, content FROM brand_patterns WHERE weight >= 81 ORDER BY weight DESC, sort_order ASC'
  ).all() as Array<{ slug: string; label: string; content: string }>;

  if (hardRules.length > 0) {
    parts.push('### Hard Rules (non-negotiable)');
    for (const rule of hardRules) {
      parts.push(`**${rule.label}** (mandatory)\n${rule.content}`);
    }
  }

  // --- Color System ---
  const colorPatterns = db.prepare(
    "SELECT slug, label, content FROM brand_patterns WHERE category = 'colors' ORDER BY weight DESC, sort_order ASC"
  ).all() as Array<{ slug: string; label: string; content: string }>;

  if (colorPatterns.length > 0) {
    parts.push('### Color System');
    for (const p of colorPatterns) {
      parts.push(`**${p.label}**\n${p.content}`);
    }
  }

  // --- Typography ---
  const typoPatterns = db.prepare(
    "SELECT slug, label, content FROM brand_patterns WHERE category = 'typography' ORDER BY weight DESC, sort_order ASC"
  ).all() as Array<{ slug: string; label: string; content: string }>;

  if (typoPatterns.length > 0) {
    parts.push('### Typography');
    for (const p of typoPatterns) {
      parts.push(`**${p.label}**\n${p.content}`);
    }
  }

  // --- Asset Manifest ---
  const assets = db.prepare(
    "SELECT name, category, file_path, mime_type FROM brand_assets WHERE (dam_deleted = 0 OR dam_deleted IS NULL) ORDER BY category, name"
  ).all() as Array<{ name: string; category: string; file_path: string; mime_type: string }>;

  if (assets.length > 0) {
    parts.push('### Asset Manifest');
    parts.push('Use these URLs verbatim. Do NOT modify paths or add extensions.\n');

    const byCategory = new Map<string, typeof assets>();
    for (const a of assets) {
      if (!byCategory.has(a.category)) byCategory.set(a.category, []);
      byCategory.get(a.category)!.push(a);
    }

    for (const [category, catAssets] of byCategory) {
      parts.push(`**${category}**`);
      for (const a of catAssets) {
        const serveUrl = `/api/brand-assets/serve/${encodeURIComponent(a.name)}`;
        if (a.mime_type.startsWith('font/') || a.name.toLowerCase().includes('font')) {
          parts.push(`- ${a.name}: \`url('${serveUrl}') format('truetype')\``);
        } else {
          parts.push(`- ${a.name}: \`url('${serveUrl}')\``);
        }
      }
    }
  }

  // --- Active CSS Layers ---
  const styles = db.prepare(
    "SELECT scope, css_content FROM brand_styles WHERE css_content != '' ORDER BY scope"
  ).all() as Array<{ scope: string; css_content: string }>;

  if (styles.length > 0) {
    parts.push('### Active CSS Layers');
    parts.push('These CSS layers are automatically merged into creations on save. You do not need to duplicate them.\n');
    for (const s of styles) {
      const preview = s.css_content.length > 300
        ? s.css_content.slice(0, 300) + '\n/* ... truncated ... */'
        : s.css_content;
      parts.push(`**${s.scope}**\n\`\`\`css\n${preview}\n\`\`\``);
    }
  }

  // --- Decoration Rules ---
  const decoPatterns = db.prepare(
    "SELECT slug, label, content FROM brand_patterns WHERE category = 'decorations' ORDER BY weight DESC, sort_order ASC"
  ).all() as Array<{ slug: string; label: string; content: string }>;

  if (decoPatterns.length > 0) {
    parts.push('### Decoration Rules');
    for (const p of decoPatterns) {
      parts.push(`**${p.label}**\n${p.content}`);
    }
  }

  // --- Token budget enforcement ---
  const brief = parts.join('\n\n');
  const tokenEstimate = Math.ceil(brief.length / CHARS_PER_TOKEN);

  if (tokenEstimate > DEFAULT_MAX_TOKENS) {
    // Truncate the brief to stay within budget
    const maxChars = DEFAULT_MAX_TOKENS * CHARS_PER_TOKEN;
    return brief.slice(0, maxChars) + '\n\n[Brand Brief truncated to fit token budget]';
  }

  return brief;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd canvas && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (the `buildBrandBrief` import in agent.ts now resolves).

- [ ] **Step 3: Commit**

```bash
git add canvas/src/server/brand-brief.ts
git commit -m "feat: add Brand Brief assembler for Tier 2 context injection"
```

---

### Task 4: Add chat routes to Vite middleware

Wire the chat API endpoints into `watcher.ts` so the frontend can create chats, send messages, and receive SSE streams.

**Files:**
- Create: `canvas/src/server/chat-routes.ts` (from `feat/sandbox-pipeline`)
- Modify: `canvas/src/server/watcher.ts` (add chat route handler)

- [ ] **Step 1: Copy chat-routes.ts from sandbox branch**

```bash
git show feat/sandbox-pipeline:canvas/src/server/chat-routes.ts > canvas/src/server/chat-routes.ts
```

- [ ] **Step 2: Wire chat routes into watcher.ts**

In `canvas/src/server/watcher.ts`, add the import at the top with the other imports:

```typescript
import { handleChatRoutes } from './chat-routes';
```

Then in the Vite plugin's `configureServer` hook, add chat route handling early in the middleware chain (before the existing API routes). Find the middleware function and add at the beginning of the route handling:

```typescript
// Chat routes (SSE streaming for agent)
const chatUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
if (chatUrl.pathname.startsWith('/api/chat')) {
  const handled = await handleChatRoutes(req, res, chatUrl);
  if (handled) return;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd canvas && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Start dev server and verify chat endpoints respond**

Run: `cd canvas && npm run dev`

Test in another terminal:
```bash
curl -s http://localhost:5174/api/chats | head -5
```
Expected: `[]` (empty array — no chats yet).

```bash
curl -s -X POST http://localhost:5174/api/chats | head -5
```
Expected: JSON with `{ "id": "chat_...", "title": null, ... }`

- [ ] **Step 5: Commit**

```bash
git add canvas/src/server/chat-routes.ts canvas/src/server/watcher.ts
git commit -m "feat: wire chat API routes into Vite middleware"
```

---

### Task 5: Add validation lifecycle hooks to save_creation and edit_creation

When the agent calls `save_creation` or `edit_creation`, the harness automatically runs validation (brand-compliance + dimension-check), applies CSS layer merge, resolves SlotSchema, and injects results back into the conversation.

**Files:**
- Modify: `canvas/src/server/agent-tools.ts` (wrap save_creation and edit_creation with validation)
- Create: `canvas/src/server/validation-hooks.ts` (harness validation logic)

- [ ] **Step 1: Create validation-hooks.ts**

Create `canvas/src/server/validation-hooks.ts`:

```typescript
/**
 * validation-hooks.ts
 * Harness-managed validation that runs automatically on save_creation / edit_creation.
 * The agent does not call these — the harness triggers them.
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { mergeCssLayers, extractStyleBlock, inlineResolvedCss, type MergeLayer } from './css-merge';
import { getBrandStyleByScope } from './db-api';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const TOOLS_DIR = path.join(PROJECT_ROOT, 'tools');

export interface ValidationResult {
  passed: boolean;
  blocking: Array<{ rule: string; severity: number; message: string }>;
  warnings: Array<{ rule: string; severity: number; message: string }>;
  fixIterations: number;
}

/**
 * Run brand-compliance.cjs and dimension-check.cjs on an HTML file.
 * Returns structured results for injection into the agent conversation.
 */
export function runValidation(
  htmlPath: string,
  platform: string,
): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    blocking: [],
    warnings: [],
    fixIterations: 0,
  };

  // Determine context for brand-compliance
  const context = platform === 'one-pager' ? 'website' : 'social';

  // Run brand-compliance.cjs
  try {
    const complianceOutput = execSync(
      `node "${path.join(TOOLS_DIR, 'brand-compliance.cjs')}" "${htmlPath}" --context ${context}`,
      { encoding: 'utf-8', timeout: 15000 }
    );

    const complianceResult = JSON.parse(complianceOutput);
    if (complianceResult.violations) {
      for (const v of complianceResult.violations) {
        const entry = {
          rule: v.rule || 'unknown',
          severity: v.weight || v.severity || 50,
          message: v.message || v.description || v.rule,
        };
        if (entry.severity >= 81) {
          result.blocking.push(entry);
        } else if (entry.severity >= 51) {
          result.warnings.push(entry);
        }
      }
    }
  } catch (err) {
    // brand-compliance exits with code 1 on errors — parse stderr/stdout
    const output = err instanceof Error && 'stdout' in err ? (err as any).stdout : '';
    try {
      const parsed = JSON.parse(output);
      if (parsed.violations) {
        for (const v of parsed.violations) {
          const entry = {
            rule: v.rule || 'unknown',
            severity: v.weight || v.severity || 50,
            message: v.message || v.description || v.rule,
          };
          if (entry.severity >= 81) {
            result.blocking.push(entry);
          } else if (entry.severity >= 51) {
            result.warnings.push(entry);
          }
        }
      }
    } catch {
      // Parse failed — treat as non-fatal
    }
  }

  // Run dimension-check.cjs
  const dimTarget = platform === 'linkedin' ? 'linkedin_landscape' : platform;
  try {
    const dimOutput = execSync(
      `node "${path.join(TOOLS_DIR, 'dimension-check.cjs')}" "${htmlPath}" --target ${dimTarget}`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    const dimResult = JSON.parse(dimOutput);
    if (dimResult.pass === false) {
      result.blocking.push({
        rule: 'dimension-mismatch',
        severity: 90,
        message: `Expected ${dimResult.target}, got ${dimResult.actual || 'unknown'}`,
      });
    }
  } catch {
    // dimension-check failure is non-fatal
  }

  result.passed = result.blocking.length === 0;
  return result;
}

/**
 * Apply CSS layer merge to an HTML file.
 * Reads brand_styles from DB, merges with the HTML's existing <style> block.
 */
export function applyCssLayerMerge(htmlPath: string, platform: string): void {
  try {
    let html = fs.readFileSync(htmlPath, 'utf-8');

    const layers: MergeLayer[] = [];

    // Layer 1: Global brand styles
    const globalStyle = getBrandStyleByScope('global');
    if (globalStyle?.css_content) {
      layers.push({ label: 'brand-global', css: globalStyle.css_content });
    }

    // Layer 2: Platform brand styles
    const platformStyle = getBrandStyleByScope(platform);
    if (platformStyle?.css_content) {
      layers.push({ label: `brand-${platform}`, css: platformStyle.css_content });
    }

    if (layers.length === 0) return;

    // Extract existing style from HTML
    const existingCss = extractStyleBlock(html);
    if (existingCss) {
      layers.unshift({ label: 'creation', css: existingCss });
    }

    const merged = mergeCssLayers(layers);
    html = inlineResolvedCss(html, merged);

    fs.writeFileSync(htmlPath, html, 'utf-8');
  } catch (err) {
    console.error('[validation-hooks] CSS layer merge failed:', err);
    // Non-fatal — HTML is already written
  }
}

/**
 * Format validation results as a human-readable message for injection into the conversation.
 */
export function formatValidationMessage(result: ValidationResult): string {
  if (result.passed && result.warnings.length === 0) {
    return 'Validation passed. No issues found.';
  }

  const lines: string[] = [];

  if (result.blocking.length > 0) {
    lines.push(`Validation: ${result.blocking.length} blocking issue(s).`);
    for (const b of result.blocking) {
      lines.push(`- [BLOCKING] ${b.message}`);
    }
  }

  if (result.warnings.length > 0) {
    if (result.blocking.length === 0) {
      lines.push('Validation passed with warnings.');
    }
    for (const w of result.warnings) {
      lines.push(`- [WARNING] ${w.message}`);
    }
  }

  if (result.blocking.length > 0) {
    lines.push('\nPlease fix the blocking issues and save again.');
  }

  return lines.join('\n');
}
```

- [ ] **Step 2: Modify agent-tools.ts to run validation after save_creation and edit_creation**

In `canvas/src/server/agent-tools.ts`, add the import:

```typescript
import { runValidation, applyCssLayerMerge, formatValidationMessage } from './validation-hooks';
```

In the `saveCreation` function, after writing the HTML file to disk and inserting the DB record, add:

```typescript
  // Harness validation hooks (automatic)
  applyCssLayerMerge(htmlPath, platform);
  const validation = runValidation(htmlPath, platform);
  const validationMessage = formatValidationMessage(validation);

  return {
    campaignId: cId,
    creationId,
    slideId,
    iterationId,
    htmlPath: relativePath,
    validation: validationMessage,
  };
```

Similarly in `editCreation`, after writing the updated HTML:

```typescript
  // Re-run validation
  const fullPath = path.resolve(PROJECT_ROOT, '.fluid', existingPath);
  applyCssLayerMerge(fullPath, platform);
  const validation = runValidation(fullPath, platform);

  return {
    success: true,
    validation: formatValidationMessage(validation),
  };
```

- [ ] **Step 3: Update agent.ts executeTool to surface validation messages**

In the `executeTool` function in `agent.ts`, when processing `save_creation` or `edit_creation` results, ensure the `validation` field is included in the tool result returned to the model. The existing tool result flow already passes the full return value as JSON, so the model will see the validation message in the tool result.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd canvas && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add canvas/src/server/validation-hooks.ts canvas/src/server/agent-tools.ts
git commit -m "feat: add harness validation hooks for save_creation and edit_creation"
```

---

### Task 6: Add token tracking and cost guards to agent loop

Track token usage per turn, enforce per-chat budget (500K tokens), and enforce render budget (max 3 per production pass).

**Files:**
- Modify: `canvas/src/server/agent.ts` (add token tracking, budget enforcement, render counting)

- [ ] **Step 1: Add token tracking to the agent loop**

In `canvas/src/server/agent.ts`, add a session state interface and tracking variables. In the `runAgent` function, after `const model = ...`:

```typescript
  // Cost tracking
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let renderCount = 0;
  const CHAT_TOKEN_BUDGET = 500_000;
  const MAX_RENDERS_PER_PASS = 3;
```

After each `client.messages.create()` call, add token tracking:

```typescript
      // Track token usage
      if (response.usage) {
        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;
      }

      // Budget enforcement
      const totalTokens = totalInputTokens + totalOutputTokens;
      if (totalTokens >= CHAT_TOKEN_BUDGET) {
        sendSSE(res, 'text', {
          text: '\n\n[Token budget reached. Please start a new chat to continue.]',
        });
        break;
      }
      if (totalTokens >= CHAT_TOKEN_BUDGET * 0.8 && totalTokens - (response.usage?.input_tokens ?? 0) - (response.usage?.output_tokens ?? 0) < CHAT_TOKEN_BUDGET * 0.8) {
        // Just crossed 80% threshold
        sendSSE(res, 'text', {
          text: '\n\n[Note: This chat has used 80% of its token budget.]',
        });
      }
```

- [ ] **Step 2: Add render budget enforcement**

In the `executeTool` function in `agent.ts`, before executing `render_preview`, check the render count:

```typescript
      if (call.name === 'render_preview') {
        renderCount++;
        if (renderCount > MAX_RENDERS_PER_PASS) {
          toolResults.push({
            tool_use_id: call.id,
            content: JSON.stringify({
              error: `Render budget exceeded (max ${MAX_RENDERS_PER_PASS} per creation). Save the creation and the system will validate it.`,
            }),
          });
          sendSSE(res, 'tool_result', {
            toolUseId: call.id,
            name: call.name,
            hasImage: false,
            error: 'Render budget exceeded',
          });
          continue; // Skip to next tool call
        }
      }
```

- [ ] **Step 3: Emit token usage in the done event**

When emitting the `done` SSE event, include token stats:

```typescript
    sendSSE(res, 'done', {
      chatId,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    });
```

- [ ] **Step 4: Commit**

```bash
git add canvas/src/server/agent.ts
git commit -m "feat: add token tracking, per-chat budget, and render budget to agent loop"
```

---

### Task 7: Add chat store and ChatSidebar UI

Bring in the frontend pieces from the sandbox branch — the Zustand chat store and the ChatSidebar React component.

**Files:**
- Create: `canvas/src/store/chat.ts` (from `feat/sandbox-pipeline`)
- Create: `canvas/src/components/ChatSidebar.tsx` (from `feat/sandbox-pipeline`)
- Create: `canvas/src/components/ChatSidebar.css` (styles)
- Create: `canvas/src/components/ChatMessage.tsx` (from `feat/sandbox-pipeline`)
- Create: `canvas/src/components/ChatHistory.tsx` (from `feat/sandbox-pipeline`)
- Modify: `canvas/src/App.tsx` or `canvas/src/components/AppShell.tsx` (add ChatSidebar)

- [ ] **Step 1: Copy store and components from sandbox branch**

```bash
git show feat/sandbox-pipeline:canvas/src/store/chat.ts > canvas/src/store/chat.ts
git show feat/sandbox-pipeline:canvas/src/components/ChatSidebar.tsx > canvas/src/components/ChatSidebar.tsx
git show feat/sandbox-pipeline:canvas/src/components/ChatSidebar.css > canvas/src/components/ChatSidebar.css
git show feat/sandbox-pipeline:canvas/src/components/ChatMessage.tsx > canvas/src/components/ChatMessage.tsx
git show feat/sandbox-pipeline:canvas/src/components/ChatHistory.tsx > canvas/src/components/ChatHistory.tsx
```

- [ ] **Step 2: Add ChatSidebar to the app shell**

In `canvas/src/components/AppShell.tsx`, import and render the ChatSidebar. Add it as a sibling to the main content area so it appears as a right-side panel:

```typescript
import { ChatSidebar } from './ChatSidebar';
```

Add `<ChatSidebar />` in the component's JSX, typically as the last child of the main layout flex container.

- [ ] **Step 3: Add chatSidebarOpen state to campaign store**

If not already present, add a `chatSidebarOpen` boolean to the campaign store (`canvas/src/store/campaign.ts`) and a toggle action. The ChatSidebar reads this to determine its width.

Check first: `grep -n chatSidebarOpen canvas/src/store/campaign.ts`

If missing, add to the store interface and initial state:
```typescript
chatSidebarOpen: boolean;
toggleChatSidebar: () => void;
```

And the implementation:
```typescript
chatSidebarOpen: false,
toggleChatSidebar: () => set(s => ({ chatSidebarOpen: !s.chatSidebarOpen })),
```

- [ ] **Step 4: Verify the app renders with ChatSidebar**

Run: `cd canvas && npm run dev`
Open http://localhost:5174/app/ in the browser. Verify:
- The chat sidebar toggle is visible
- Opening the sidebar shows the empty chat state
- Creating a new chat works (POST /api/chats succeeds)

- [ ] **Step 5: Commit**

```bash
git add canvas/src/store/chat.ts canvas/src/components/ChatSidebar.tsx canvas/src/components/ChatSidebar.css canvas/src/components/ChatMessage.tsx canvas/src/components/ChatHistory.tsx canvas/src/components/AppShell.tsx canvas/src/store/campaign.ts
git commit -m "feat: add ChatSidebar UI with chat store and history"
```

---

### Task 8: Add structured SSE events (creation_ready, validation_result)

The spec requires specific SSE events so the frontend knows when a creation is ready to display and what validation found.

**Files:**
- Modify: `canvas/src/server/agent.ts` (emit new event types after save_creation)
- Modify: `canvas/src/store/chat.ts` (handle new SSE event types)

- [ ] **Step 1: Emit creation_ready and validation_result events from agent.ts**

In the `executeTool` function, after `save_creation` completes successfully, emit structured events:

```typescript
      if (call.name === 'save_creation' || call.name === 'edit_creation') {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        if (parsed.iterationId || parsed.creationId) {
          sendSSE(res, 'creation_ready', {
            campaignId: parsed.campaignId,
            creationId: parsed.creationId,
            iterationId: parsed.iterationId,
            htmlPath: parsed.htmlPath,
          });
        }
        if (parsed.validation) {
          sendSSE(res, 'validation_result', {
            iterationId: parsed.iterationId,
            result: parsed.validation,
          });
        }
      }
```

- [ ] **Step 2: Handle creation_ready in the chat store**

In `canvas/src/store/chat.ts`, in the SSE event parsing loop, add handlers for new event types:

```typescript
      case 'creation_ready': {
        // Notify campaign store to refresh — the creation is ready to display
        // Import and call the campaign store's refresh method
        break;
      }
      case 'validation_result': {
        // Append validation result as a system-style message in the chat
        const validationData = JSON.parse(data);
        // Add as a visual indicator in the chat UI (non-message, just info)
        break;
      }
```

The exact integration with the campaign store depends on existing patterns. The key is that `creation_ready` triggers a canvas refresh so the user sees the new creation.

- [ ] **Step 3: Commit**

```bash
git add canvas/src/server/agent.ts canvas/src/store/chat.ts
git commit -m "feat: add creation_ready and validation_result SSE events"
```

---

### Task 9: Remove old pipeline code

Now that the new agent is wired in, remove the old 4-stage pipeline, generation UI, and subagent definitions. This mirrors what the sandbox branch did in commit `c1fc3b4`.

**Files:**
- Delete: `canvas/src/server/api-pipeline.ts`
- Delete: `canvas/src/components/GenerationStreamView.tsx`
- Delete: `canvas/src/components/PromptSidebar.tsx`
- Delete: `canvas/src/components/StreamMessage.tsx`
- Delete: `canvas/src/hooks/useGenerationStream.ts`
- Delete: `canvas/src/lib/stream-parser.ts`
- Delete: `canvas/src/store/generation.ts`
- Delete: `.claude/agents/copy-agent.md`
- Delete: `.claude/agents/layout-agent.md`
- Delete: `.claude/agents/styling-agent.md`
- Delete: `.claude/agents/spec-check-agent.md`
- Modify: `canvas/src/server/watcher.ts` (remove /api/generate routes)
- Modify: `canvas/src/components/BuildHero.tsx` (remove generation hook references)
- Modify: `canvas/src/hooks/useFileWatcher.ts` (remove generation status references)

- [ ] **Step 1: Delete old pipeline files**

```bash
rm -f canvas/src/server/api-pipeline.ts
rm -f canvas/src/components/GenerationStreamView.tsx
rm -f canvas/src/components/PromptSidebar.tsx
rm -f canvas/src/components/StreamMessage.tsx
rm -f canvas/src/hooks/useGenerationStream.ts
rm -f canvas/src/lib/stream-parser.ts
rm -f canvas/src/store/generation.ts
rm -f .claude/agents/copy-agent.md
rm -f .claude/agents/layout-agent.md
rm -f .claude/agents/styling-agent.md
rm -f .claude/agents/spec-check-agent.md
```

- [ ] **Step 2: Remove /api/generate routes from watcher.ts**

In `canvas/src/server/watcher.ts`, find and remove the `/api/generate` and `/api/generate/cancel` route handlers and the `import { runApiPipeline }` import. Also remove any imports from `api-pipeline.ts`.

- [ ] **Step 3: Remove generation references from BuildHero and useFileWatcher**

In `canvas/src/components/BuildHero.tsx` and `canvas/src/components/build-hero/BuildHero.tsx`, remove any imports from `useGenerationStream` or `generation.ts` store. Remove any generation-specific UI elements (progress bars, stage badges).

In `canvas/src/hooks/useFileWatcher.ts`, remove any references to generation status pausing.

- [ ] **Step 4: Remove any remaining imports of deleted files**

Run: `cd canvas && npx tsc --noEmit 2>&1 | head -40`

Fix any import errors pointing to deleted files. Common pattern: change imports to use the new agent/chat system instead.

- [ ] **Step 5: Verify the app builds and runs**

Run: `cd canvas && npx tsc --noEmit && npm run dev`
Expected: No errors. App runs with ChatSidebar as the generation interface.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove old 4-stage pipeline, subagent definitions, and generation UI"
```

---

### Task 10: End-to-end verification

Verify the full production pass works: user sends prompt → agent generates → harness validates → creation appears in canvas.

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

```bash
cd canvas && npm run dev
```

- [ ] **Step 2: Open the app and test the full flow**

1. Open http://localhost:5174/app/
2. Open the chat sidebar
3. Type: "Create an Instagram post about Fluid Connect"
4. Verify:
   - Agent streams text responses
   - Tool calls appear (list_archetypes, read_archetype, render_preview, save_creation)
   - Validation results appear in the chat
   - Creation appears in the canvas
   - Token usage is tracked (check server logs)

- [ ] **Step 3: Test iteration**

In the same chat, type: "Make the headline bigger"
Verify:
- Agent reads the existing creation
- Agent calls edit_creation with updated HTML
- Validation reruns
- Updated creation appears

- [ ] **Step 4: Test page reload persistence**

Reload the page. Verify:
- Chat history is preserved
- Opening the same chat shows all messages
- Creations are still visible in the canvas

- [ ] **Step 5: Run existing tests**

```bash
cd canvas && npm test 2>&1 | tail -20
```

Fix any test failures caused by the refactor (likely: tests that import deleted files).

- [ ] **Step 6: Commit any test fixes**

```bash
git add -A
git commit -m "fix: update tests for new agent architecture"
```

---

## Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Chat tables in DB schema | `db.ts` |
| 2 | Agent core (loop, tools, prompt, render) | `agent.ts`, `agent-tools.ts`, `agent-system-prompt.ts`, `render-engine.ts` |
| 3 | Brand Brief assembler | `brand-brief.ts` |
| 4 | Chat routes in Vite middleware | `chat-routes.ts`, `watcher.ts` |
| 5 | Validation lifecycle hooks | `validation-hooks.ts`, `agent-tools.ts` |
| 6 | Token tracking + cost guards | `agent.ts` |
| 7 | Chat store + ChatSidebar UI | `chat.ts`, `ChatSidebar.tsx`, `AppShell.tsx` |
| 8 | Structured SSE events | `agent.ts`, `chat.ts` |
| 9 | Remove old pipeline | Delete ~15 files, clean imports |
| 10 | End-to-end verification | Testing only |

**Deferred to Phase 2 (lower priority within Phase 1 scope):**
- Stale generation reaper on startup (simple but not blocking for initial testing)
- Idempotency keys on generation (edge case until multi-user)
- SlotSchema resolution with full archetype decorative field injection (existing `saveCreation` creates basic `ai_baseline`; full resolution needs archetype-aware logic from the old pipeline)

**After Phase 1:** The system has a working conversational agent that generates creations with automatic validation, CSS layer merging, token tracking, and persistent chat history. The old pipeline is gone. Phase 2 (tier boundary cleanup, confirmation gates) builds on this foundation.
