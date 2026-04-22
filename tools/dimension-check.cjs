#!/usr/bin/env node
/**
 * dimension-check.cjs (CLI-03) — Validates HTML asset dimensions
 *
 * Extracts width/height from HTML files and compares against
 * known target dimensions.
 *
 * Usage: node tools/dimension-check.cjs path/to/file.html [--target instagram|linkedin_landscape|linkedin_tall|WxH]
 * Output: JSON to stdout, human summary to stderr
 * Exit code: 1 if mismatch, 0 if match
 *
 * Zero external dependencies — uses only Node.js built-ins.
 */

const fs = require('node:fs');
const path = require('node:path');
const pc = require('picocolors');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { parse: parseHtml } = require('parse5');

// ─── parse5 AST helpers ───────────────────────────────────────────────────────

function buildAst(htmlString) {
  return parseHtml(htmlString, { sourceCodeLocationInfo: true });
}

function findAll(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  if (node.childNodes) for (const c of node.childNodes) findAll(c, predicate, out);
  return out;
}

function findFirst(node, predicate) {
  if (predicate(node)) return node;
  if (node.childNodes) {
    for (const c of node.childNodes) {
      const f = findFirst(c, predicate);
      if (f) return f;
    }
  }
  return null;
}

const getAttr = (el, name) => el.attrs?.find(a => a.name === name)?.value;

function getTextContent(node) {
  if (!node.childNodes) return '';
  return node.childNodes
    .filter(c => c.nodeName === '#text')
    .map(c => c.value)
    .join('');
}

// Known target dimensions — authoritative values from brand specs
const KNOWN_DIMENSIONS = {
  instagram: { width: 1080, height: 1080 },
  linkedin_landscape: { width: 1200, height: 627 },
  linkedin_tall: { width: 1340, height: 630 },
};

function loadRules() {
  return { dimensions: KNOWN_DIMENSIONS };
}

/**
 * extractDimensions — parse5 AST-based dimension extraction.
 *
 * Replaces the previous regex-based implementation. Key improvement: comment
 * detection now only looks at AST nodes with nodeName '#comment', so the text
 * `target: 1080x1080` inside a data-* attribute (or any non-comment context)
 * is never matched. The previous regex operated on the raw HTML string, which
 * could be tricked by attribute values that contain the pattern.
 *
 * Strategy (in order of priority):
 *   1. HTML comment node with `target: WxH` pattern
 *   2. <body> element style attribute
 *   3. <div> with class matching container|wrapper|canvas|post, style attribute
 *   4. <style> text content — CSS rule for body/.container/etc.
 *   5. <meta name="viewport"> content attribute
 */
function extractDimensions(content) {
  const found = { width: null, height: null, source: null };
  const doc = buildAst(content);

  // 1. HTML comment nodes only — NOT arbitrary text matching the pattern.
  //
  //    We use a tighter regex that matches a DIRECTIVE-style comment: the
  //    keyword (target/dimensions/size) must appear at the start of the
  //    comment (after optional whitespace), and the comment must end
  //    immediately after the dimensions (after optional whitespace).
  //
  //    This prevents fixture-description comments like:
  //      <!-- FIXTURE: The phrase `target: 1080x1080` appears inside ... -->
  //    from being treated as dimension directives. A real directive comment
  //    is tightly formatted as:
  //      <!-- target: 1080x1080 -->
  const commentNodes = findAll(doc, n => n.nodeName === '#comment');
  for (const c of commentNodes) {
    const text = c.data || '';
    // Anchored: comment text must start and end with the dimension directive
    const m = text.match(/^\s*(?:target|dimensions?|size)\s*:\s*(\d+)\s*x\s*(\d+)\s*$/i);
    if (m) {
      found.width = parseInt(m[1]);
      found.height = parseInt(m[2]);
      found.source = 'html-comment';
      return found;
    }
  }

  // 2. <body> element inline style
  const bodyEl = findFirst(doc, n => n.nodeName === 'body');
  if (bodyEl) {
    const style = getAttr(bodyEl, 'style') || '';
    const w = style.match(/width\s*:\s*(\d+)px/i);
    const h = style.match(/height\s*:\s*(\d+)px/i);
    if (w && h) {
      found.width = parseInt(w[1]);
      found.height = parseInt(h[1]);
      found.source = 'body-inline-style';
      return found;
    }
  }

  // 3. Container/wrapper div inline styles
  const containerClassPattern = /container|wrapper|canvas|post/i;
  const divEls = findAll(doc, n => n.nodeName === 'div');
  for (const div of divEls) {
    const cls = getAttr(div, 'class') || '';
    if (!containerClassPattern.test(cls)) continue;
    const style = getAttr(div, 'style') || '';
    const w = style.match(/width\s*:\s*(\d+)px/i);
    const h = style.match(/height\s*:\s*(\d+)px/i);
    if (w && h) {
      found.width = parseInt(w[1]);
      found.height = parseInt(h[1]);
      found.source = 'container-inline-style';
      return found;
    }
  }

  // 4. <style> block CSS rules — text content only, regex on CSS text
  const styleEls = findAll(doc, n => n.nodeName === 'style');
  for (const styleEl of styleEls) {
    const css = getTextContent(styleEl);
    const bodyCSS = css.match(/(?:body|\.container|\.wrapper|\.canvas|\.post)\s*\{([^}]*)\}/i);
    if (bodyCSS) {
      const w = bodyCSS[1].match(/width\s*:\s*(\d+)px/i);
      const h = bodyCSS[1].match(/height\s*:\s*(\d+)px/i);
      if (w && h) {
        found.width = parseInt(w[1]);
        found.height = parseInt(h[1]);
        found.source = 'css-style-block';
        return found;
      }
    }
  }

  // 5. <meta name="viewport"> content attribute
  const metaEls = findAll(doc, n => n.nodeName === 'meta');
  for (const meta of metaEls) {
    const name = getAttr(meta, 'name') || '';
    if (name.toLowerCase() !== 'viewport') continue;
    const vp = getAttr(meta, 'content') || '';
    const w = vp.match(/width\s*=\s*(\d+)/i);
    const h = vp.match(/height\s*=\s*(\d+)/i);
    if (w && h) {
      found.width = parseInt(w[1]);
      found.height = parseInt(h[1]);
      found.source = 'meta-viewport';
      return found;
    }
  }

  return found;
}

function autoDetectTarget(content, dimensions, rules) {
  const dims = rules.dimensions;

  // Try to match by found dimensions
  if (dimensions.width && dimensions.height) {
    for (const [name, target] of Object.entries(dims)) {
      if (dimensions.width === target.width && dimensions.height === target.height) {
        return name;
      }
    }
  }

  // Try to detect from content hints
  if (/instagram/i.test(content)) return 'instagram';
  if (/linkedin/i.test(content)) {
    if (dimensions.height && dimensions.height > 628) return 'linkedin_tall';
    return 'linkedin_landscape';
  }
  if (/1080/i.test(content)) return 'instagram';

  return null;
}

function parseCustomTarget(targetStr) {
  const match = targetStr.match(/^(\d+)\s*x\s*(\d+)$/i);
  if (match) {
    return { width: parseInt(match[1]), height: parseInt(match[2]) };
  }
  return null;
}

// --- Main ---
const argv = yargs(hideBin(process.argv))
  .scriptName('dimension-check')
  .usage('dimension-check.cjs (CLI-03) — Validate HTML asset dimensions\n\nUsage: $0 <file> [options]')
  .command('$0 <file>', 'Validate HTML asset dimensions', (y) =>
    y.positional('file', { describe: 'Path to .html file', type: 'string' })
  )
  .option('target', {
    describe: 'Target dimensions: instagram, linkedin_landscape, linkedin_tall, or WxH (e.g. 800x600). Auto-detected if not specified.',
    type: 'string',
  })
  .strict()
  .help()
  .parseSync();

const filePath = path.resolve(argv.file);
if (!fs.existsSync(filePath)) {
  process.stderr.write(`Error: File not found: ${filePath}\n`);
  process.exit(2);
}

const rules = loadRules();
const content = fs.readFileSync(filePath, 'utf-8');
const dimensions = extractDimensions(content);

let targetName = null;
let target = null;

if (argv.target) {
  if (rules.dimensions[argv.target]) {
    targetName = argv.target;
    target = rules.dimensions[argv.target];
  } else {
    target = parseCustomTarget(argv.target);
    targetName = argv.target;
  }
} else {
  targetName = autoDetectTarget(content, dimensions, rules);
  if (targetName && rules.dimensions[targetName]) {
    target = rules.dimensions[targetName];
  }
}

const match = target && dimensions.width && dimensions.height
  ? dimensions.width === target.width && dimensions.height === target.height
  : null;

const result = {
  file: filePath,
  status: match === true ? 'pass' : match === false ? 'fail' : 'unknown',
  target: target ? { name: targetName, ...target } : null,
  found: dimensions.width && dimensions.height ? {
    width: dimensions.width,
    height: dimensions.height,
    source: dimensions.source,
  } : null,
  match,
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');

// Human summary
process.stderr.write(`\nDimension Check: ${path.basename(filePath)}\n`);

if (!dimensions.width || !dimensions.height) {
  process.stderr.write(`  ${pc.yellow('WARNING')}: Could not extract dimensions from file\n`);
} else {
  process.stderr.write(`  Found: ${dimensions.width}x${dimensions.height} (from ${dimensions.source})\n`);
}

if (target) {
  process.stderr.write(`  Target: ${target.width}x${target.height} (${targetName})\n`);
} else {
  process.stderr.write(`  ${pc.yellow('WARNING')}: No target specified or auto-detected\n`);
}

if (match === true) {
  process.stderr.write(`  ${pc.green('PASS')} — Dimensions match\n\n`);
} else if (match === false) {
  process.stderr.write(`  ${pc.red('FAIL')} — Expected ${target.width}x${target.height}, found ${dimensions.width}x${dimensions.height}\n\n`);
} else {
  process.stderr.write(`  ${pc.yellow('UNKNOWN')} — Could not compare (missing target or dimensions)\n\n`);
}

process.exit(match === false ? 1 : 0);
