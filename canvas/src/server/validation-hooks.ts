/**
 * validation-hooks.ts
 * Harness-managed validation that runs automatically on save_creation / edit_creation.
 * The agent does not call these — the harness triggers them.
 */

import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { mergeCssLayers, extractStyleBlock, inlineResolvedCss, type MergeLayer } from './css-merge';
import { getBrandStyleByScope } from './db-api';
import { logChatEvent } from './observability';

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
export function runValidation(htmlPath: string, platform: string): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    blocking: [],
    warnings: [],
    fixIterations: 0,
  };

  // Determine context for brand-compliance
  const context = platform === 'one-pager' ? 'website' : 'social';

  // Run brand-compliance.cjs. Use execFileSync with an argv array so paths
  // and flags can never be shell-interpolated, even if htmlPath somehow picks
  // up a backtick or $() in a future code path.
  try {
    const complianceOutput = execFileSync(
      'node',
      [path.join(TOOLS_DIR, 'brand-compliance.cjs'), htmlPath, '--context', context],
      { encoding: 'utf-8', timeout: 15000 },
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

  // Run dimension-check.cjs (same execFileSync rationale as above).
  // Map canvas/MCP platform slugs → dimension-check target keys.
  // Keep in sync with tools/dimension-check.cjs KNOWN_DIMENSIONS.
  const dimTarget =
    platform === 'linkedin' ? 'linkedin_landscape'
    : platform === 'instagram-portrait' ? 'instagram_portrait'
    : platform === 'instagram-square' ? 'instagram_square'
    : platform;
  try {
    const dimOutput = execFileSync(
      'node',
      [path.join(TOOLS_DIR, 'dimension-check.cjs'), htmlPath, '--target', dimTarget],
      { encoding: 'utf-8', timeout: 10000 },
    );
    const dimResult = JSON.parse(dimOutput);
    if (dimResult.pass === false) {
      result.blocking.push({
        rule: 'dimension-mismatch',
        severity: 90,
        message: `Expected ${dimResult.target}, got ${dimResult.actual || 'unknown'}`,
      });
    }
  } catch (err) {
    // dimension-check failure is non-fatal, but log it so broken scripts
    // don't disappear silently.
    logChatEvent('tool_error', {
      tool: 'dimension_check',
      target: dimTarget,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  result.passed = result.blocking.length === 0;
  return result;
}

/**
 * Merge brand CSS layers into an HTML string in-memory. Returns the merged HTML,
 * or the original HTML if no layers apply or merging fails.
 *
 * Callers that are about to write the HTML anyway should use this and write once,
 * rather than calling applyCssLayerMerge which does an extra read+write cycle.
 */
export function mergeCssLayersForHtml(html: string, platform: string): string {
  try {
    const layers: MergeLayer[] = [];

    // Layer 1: Global brand styles
    const globalStyle = getBrandStyleByScope('global');
    if (globalStyle?.cssContent) {
      layers.push({ label: 'brand-global', css: globalStyle.cssContent });
    }

    // Layer 2: Platform brand styles
    const platformStyle = getBrandStyleByScope(platform);
    if (platformStyle?.cssContent) {
      layers.push({ label: `brand-${platform}`, css: platformStyle.cssContent });
    }

    if (layers.length === 0) return html;

    // Extract existing style from HTML
    const existingCss = extractStyleBlock(html);
    if (existingCss) {
      layers.unshift({ label: 'creation', css: existingCss });
    }

    const merged = mergeCssLayers(layers);
    return inlineResolvedCss(html, merged);
  } catch (err) {
    console.error('[validation-hooks] CSS layer merge failed:', err);
    logChatEvent('css_merge_failed', {
      platform,
      error: err instanceof Error ? err.message : String(err),
    });
    return html;
  }
}

/**
 * Apply CSS layer merge to an HTML file on disk.
 * Kept as a thin wrapper for call sites that don't have the HTML in-memory.
 */
export function applyCssLayerMerge(htmlPath: string, platform: string): void {
  try {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const merged = mergeCssLayersForHtml(html, platform);
    if (merged !== html) {
      fs.writeFileSync(htmlPath, merged, 'utf-8');
    }
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
