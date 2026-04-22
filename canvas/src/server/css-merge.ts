/**
 * css-merge.ts
 * Property-level CSS merge for the layered style system.
 * Merge order: global -> platform -> archetype -> brand-global -> brand-platform
 */

import * as csstree from 'css-tree';

export interface MergeLayer {
  label: string; // for debugging: 'global', 'instagram', 'archetype', 'brand-global', 'brand-instagram'
  css: string; // raw CSS text
}

/**
 * Merges CSS layers in order. Later layers override earlier ones
 * on a per-selector, per-property basis.
 * Returns a single CSS string with all conflicts resolved.
 */
export function mergeCssLayers(layers: MergeLayer[]): string {
  // Strategy: Parse each layer, build a map of selector -> { property -> value }
  // Then serialize back to CSS.

  // Map: selectorText -> Map<property, { value: string; important: boolean }>
  const selectorMap = new Map<string, Map<string, { value: string; important: boolean }>>();
  // Track selector order for stable output
  const selectorOrder: string[] = [];
  // Collect @font-face and other at-rules separately (they don't merge, they accumulate)
  const atRules: string[] = [];
  // Track seen @font-face to deduplicate
  const seenFontFaces = new Set<string>();

  for (const layer of layers) {
    if (!layer.css.trim()) continue;

    let ast: csstree.CssNode;
    try {
      ast = csstree.parse(layer.css, {
        parseCustomProperty: true,
      });
    } catch {
      // Skip malformed CSS layers gracefully
      console.warn(`[css-merge] Skipping malformed CSS in layer "${layer.label}"`);
      continue;
    }

    csstree.walk(ast, {
      visit: 'Rule',
      enter(node) {
        if (node.type !== 'Rule' || !node.prelude || !node.block) return;

        const selector = csstree.generate(node.prelude);

        if (!selectorMap.has(selector)) {
          selectorMap.set(selector, new Map());
          selectorOrder.push(selector);
        }
        const props = selectorMap.get(selector)!;

        // Walk declarations in this rule
        node.block.children.forEach((decl) => {
          if (decl.type !== 'Declaration') return;
          const property = decl.property;
          const value = csstree.generate(decl.value);
          const important = decl.important === true;

          // Later layers always override, unless existing is !important and new isn't
          const existing = props.get(property);
          if (existing?.important && !important) return;

          props.set(property, { value, important });
        });
      },
    });

    // Collect @font-face and other at-rules
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        if (node.type !== 'Atrule') return;
        const generated = csstree.generate(node);

        if (node.name === 'font-face') {
          // Deduplicate @font-face by content
          const key = generated.replace(/\s+/g, ' ').trim();
          if (!seenFontFaces.has(key)) {
            seenFontFaces.add(key);
            atRules.push(generated);
          }
        }
        // Skip other at-rules for now (could add @keyframes, @media support later)
      },
    });
  }

  // Serialize back to CSS
  const parts: string[] = [];

  // At-rules first (@font-face, etc.)
  for (const rule of atRules) {
    parts.push(rule);
  }

  // Then regular rules in selector order
  for (const selector of selectorOrder) {
    const props = selectorMap.get(selector)!;
    if (props.size === 0) continue;

    const declarations: string[] = [];
    for (const [prop, { value, important }] of props) {
      declarations.push(`  ${prop}: ${value}${important ? ' !important' : ''};`);
    }
    parts.push(`${selector} {\n${declarations.join('\n')}\n}`);
  }

  return parts.join('\n\n');
}

/**
 * Extract the <style> block content from an HTML string.
 * Returns the CSS text inside the first <style>...</style> tag, or empty string.
 */
export function extractStyleBlock(html: string): string {
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match ? match[1].trim() : '';
}

/**
 * Given an archetype HTML file and the resolved CSS string,
 * produces a new HTML file with all styles in a single <style> block.
 * Preserves inline style= attributes (positioning only).
 */
export function inlineResolvedCss(html: string, resolvedCss: string): string {
  // Replace the existing <style> block with the resolved CSS
  // If no <style> block exists, insert one in <head>
  const hasStyle = /<style[^>]*>[\s\S]*?<\/style>/i.test(html);

  if (hasStyle) {
    return html.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>\n${resolvedCss}\n</style>`);
  }

  // Insert before </head> if it exists
  const hasHead = /<\/head>/i.test(html);
  if (hasHead) {
    return html.replace(/<\/head>/i, `<style>\n${resolvedCss}\n</style>\n</head>`);
  }

  // Fallback: prepend to HTML
  return `<style>\n${resolvedCss}\n</style>\n${html}`;
}
