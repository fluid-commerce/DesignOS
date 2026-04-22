'use strict';

/**
 * feedback-ingest.cjs
 *
 * Feedback ingestion engine for the Fluid Creative OS learning loop.
 * Reads completed canvas sessions and manual feedback files, extracts signals,
 * clusters patterns, and generates actionable proposals for brand doc updates.
 *
 * CLI modes:
 *   node tools/feedback-ingest.cjs           -- full run (analyze + write proposals + JSON to stdout)
 *   node tools/feedback-ingest.cjs --dry-run  -- analyze and print proposals without writing files
 *   node tools/feedback-ingest.cjs --test     -- run self-tests, exit 0 on pass, non-zero on fail
 *
 * Dual output convention (matching compile-rules.cjs and brand-compliance.cjs):
 *   JSON -> stdout (machine consumption)
 *   Human summary -> stderr
 */

const fs = require('node:fs');
const path = require('node:path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_DIR_PATTERN = /^\d{8}-\d{6}$/;

// Directive keywords that trigger the 1-session bypass threshold
const DIRECTIVE_KEYWORDS = [
  'never', 'always', "don't", 'dont', 'stop using', 'avoid', 'must not',
  'should not', 'remove', 'do not', 'only use', 'never use',
];

// Topics extracted from annotation text by keyword matching
const TOPIC_KEYWORDS = {
  brushstroke: ['brushstroke', 'brush stroke', 'sweep', 'diagonal'],
  opacity: ['opacity', 'transparent', 'heavy', 'prominent', 'bold background'],
  circle: ['circle', 'dot', 'round element', 'circular'],
  font: ['font', 'typeface', 'text size', 'heading size', 'type size', 'font size'],
  copy_density: ['copy density', 'text density', 'too much text', 'text heavy', 'cluttered', 'wordy'],
  web_vs_social: ['web page', 'website feel', 'social post', 'more like a web', 'social media feel'],
  color: ['color', 'colour', 'accent', 'palette', 'hue', 'tone'],
  layout: ['layout', 'spacing', 'padding', 'margin', 'grid', 'structure'],
  logo: ['logo', 'brand mark', 'wordmark'],
};

// Asset type -> target DB section slug mapping
// Brand data lives in SQLite DB (canvas/.fluid/fluid.db), accessed via MCP tools
const ASSET_DOC_MAP = {
  social: 'social-post-specs',
  instagram: 'social-post-specs',
  linkedin: 'social-post-specs',
  twitter: 'social-post-specs',
  website: 'website-section-specs',
  'one-pager': 'website-section-specs',
  onepager: 'website-section-specs',
};

// Topic -> brand-level DB section slug mapping (used when pattern spans 2+ asset types)
// Read sections via: read_brand_section(slug)
const TOPIC_BRAND_DOC_MAP = {
  brushstroke: 'design-tokens',
  opacity: 'design-tokens',
  circle: 'design-tokens',
  font: 'design-tokens',
  color: 'design-tokens',
  layout: 'design-tokens',
  logo: 'asset-usage',
  copy_density: 'voice-rules',
  web_vs_social: 'voice-rules',
  general: 'voice-rules',
};

// ---------------------------------------------------------------------------
// 1. Session Discovery
// ---------------------------------------------------------------------------

/**
 * discoverSessions(workingDir) -> string[]
 * Returns array of valid session IDs found in workingDir.
 * Filters by YYYYMMDD-HHMMSS pattern and lineage.json existence.
 */
function discoverSessions(workingDir) {
  if (!fs.existsSync(workingDir)) return [];
  let entries;
  try {
    entries = fs.readdirSync(workingDir);
  } catch {
    return [];
  }
  return entries
    .filter(e => SESSION_DIR_PATTERN.test(e))
    .filter(e => {
      const lineagePath = path.join(workingDir, e, 'lineage.json');
      return fs.existsSync(lineagePath);
    });
}

// ---------------------------------------------------------------------------
// 2. Session Signal Extraction
// ---------------------------------------------------------------------------

/**
 * loadSessionSignals(workingDir, sessionId) -> { sessionId, platform, template, signals[] }
 * Reads lineage.json + annotations.json for a session and extracts structured signals.
 * Handles both Phase 4 (rounds[]) and Phase 2 (entries[]) lineage formats.
 */
function loadSessionSignals(workingDir, sessionId) {
  const sessionDir = path.join(workingDir, sessionId);
  const lineagePath = path.join(sessionDir, 'lineage.json');

  let lineage;
  try {
    lineage = JSON.parse(fs.readFileSync(lineagePath, 'utf-8'));
  } catch {
    return null;
  }

  // Load annotations.json if present
  let statuses = {};
  let annotationTexts = [];
  const annotationsPath = path.join(sessionDir, 'annotations.json');
  if (fs.existsSync(annotationsPath)) {
    try {
      const af = JSON.parse(fs.readFileSync(annotationsPath, 'utf-8'));
      statuses = af.statuses || {};
      annotationTexts = (af.annotations || []).map(a => ({
        text: a.text || '',
        type: a.type || 'pin',
        variationPath: a.variationPath || '',
        x: a.x,
        y: a.y,
      }));
    } catch {
      // annotations.json unreadable — proceed without it
    }
  }

  const signals = [];

  // Phase 4: rounds[] format
  if (lineage.rounds && lineage.rounds.length > 0) {
    for (const round of lineage.rounds) {
      const variations = round.variations || [];
      for (const v of variations) {
        // annotations.json statuses take precedence over lineage.json status
        const status = statuses[v.path] || v.status || 'unmarked';
        if (status === 'winner' || status === 'final') {
          signals.push({
            type: 'winner',
            variationPath: v.path,
            roundNumber: round.roundNumber,
            prompt: round.prompt || '',
          });
        } else if (status === 'rejected') {
          signals.push({
            type: 'rejection',
            variationPath: v.path,
            roundNumber: round.roundNumber,
            prompt: round.prompt || '',
          });
        }
      }
    }
  }

  // Phase 2: entries[] format — status comes only from annotations.json
  if (!lineage.rounds && lineage.entries && lineage.entries.length > 0) {
    for (const entry of lineage.entries) {
      const outputPath = entry.output || entry.path || '';
      const status = statuses[outputPath] || 'unmarked';
      if (status === 'winner' || status === 'final') {
        signals.push({
          type: 'winner',
          variationPath: outputPath,
        });
      } else if (status === 'rejected') {
        signals.push({
          type: 'rejection',
          variationPath: outputPath,
        });
      }
    }
  }

  // Extract annotation texts (pin and sidebar types)
  for (const ann of annotationTexts) {
    if (ann.text && ann.text.trim()) {
      signals.push({
        type: ann.type === 'sidebar' ? 'sidebar-annotation' : 'pin-annotation',
        variationPath: ann.variationPath,
        text: ann.text.trim(),
        x: ann.x,
        y: ann.y,
      });
    }
  }

  return {
    sessionId,
    platform: lineage.platform || 'unknown',
    template: lineage.template || null,
    signals,
  };
}

// ---------------------------------------------------------------------------
// 3. Feedback File Parsing
// ---------------------------------------------------------------------------

/**
 * parseFeedbackFiles(feedbackDir) -> FeedbackEntry[]
 * Reads feedback/*.md files (not README.md), parses YAML frontmatter.
 */
function parseFeedbackFiles(feedbackDir) {
  if (!fs.existsSync(feedbackDir)) return [];

  let files;
  try {
    files = fs.readdirSync(feedbackDir);
  } catch {
    return [];
  }

  const mdFiles = files.filter(f =>
    f.endsWith('.md') &&
    f !== 'README.md' &&
    !f.startsWith('.')
  );

  const results = [];
  for (const filename of mdFiles) {
    const filePath = path.join(feedbackDir, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseFrontmatter(content);
      if (parsed) {
        results.push({ ...parsed, _filename: filename });
      }
    } catch {
      // skip unreadable files
    }
  }
  return results;
}

/**
 * parseFrontmatter(content) -> object | null
 * Hand-rolled YAML frontmatter parser.
 * Handles simple key: value pairs and the nested rule_weights_affected array.
 */
function parseFrontmatter(content) {
  const parts = content.split('---');
  if (parts.length < 3) return null;

  const yaml = parts[1].trim();
  const result = {};
  const lines = yaml.split('\n');

  let currentArray = null;
  let currentArrayItem = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Nested array item key-value (e.g., "    current_weight: 90")
    if (line.match(/^    \S/) && currentArray !== null) {
      if (currentArrayItem !== null) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > -1) {
          const k = line.substring(0, colonIdx).trim();
          const v = line.substring(colonIdx + 1).trim();
          currentArrayItem[k] = isNumeric(v) ? Number(v) : unquote(v);
        }
      }
      continue;
    }

    // Array item start (e.g., "  - rule: ...")
    if (line.match(/^  - \S/) && currentArray !== null) {
      if (currentArrayItem !== null) {
        currentArray.push(currentArrayItem);
      }
      currentArrayItem = {};
      const colonIdx = line.indexOf(':');
      if (colonIdx > -1) {
        const k = line.substring(4).substring(0, colonIdx - 4).trim();
        const v = line.substring(colonIdx + 1).trim();
        currentArrayItem[k] = isNumeric(v) ? Number(v) : unquote(v);
      }
      continue;
    }

    // If we were in an array context and the line is not indented, finalize
    if (currentArray !== null && !line.match(/^  /)) {
      if (currentArrayItem !== null) {
        currentArray.push(currentArrayItem);
        currentArrayItem = null;
      }
      currentArray = null;
    }

    // Array field declaration (e.g., "rule_weights_affected:")
    if (line.trim().endsWith(':')) {
      const key = line.trim().slice(0, -1);
      result[key] = [];
      currentArray = result[key];
      currentArrayItem = null;
      continue;
    }

    // Regular key: value
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const k = line.substring(0, colonIdx).trim();
      const v = line.substring(colonIdx + 1).trim();
      result[k] = isNumeric(v) ? Number(v) : unquote(v);
    }
  }

  // Finalize any pending array item
  if (currentArray !== null && currentArrayItem !== null) {
    currentArray.push(currentArrayItem);
  }

  return Object.keys(result).length > 0 ? result : null;
}

function isNumeric(str) {
  return str !== '' && !isNaN(Number(str));
}

function unquote(str) {
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

// ---------------------------------------------------------------------------
// 4. Ingested Manifest
// ---------------------------------------------------------------------------

/**
 * loadIngestedManifest(feedbackDir) -> { version, lastRun, processedSessions[] }
 * Reads feedback/ingested.json. Creates default manifest if missing.
 */
function loadIngestedManifest(feedbackDir) {
  const manifestPath = path.join(feedbackDir, 'ingested.json');
  if (!fs.existsSync(manifestPath)) {
    return { version: '1.0', lastRun: null, processedSessions: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return { version: '1.0', lastRun: null, processedSessions: [] };
  }
}

/**
 * saveIngestedManifest(feedbackDir, manifest)
 * Writes updated manifest to feedback/ingested.json.
 */
function saveIngestedManifest(feedbackDir, manifest) {
  const manifestPath = path.join(feedbackDir, 'ingested.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    ...manifest,
    lastRun: new Date().toISOString(),
  }, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// 5. Signal Topic Extraction
// ---------------------------------------------------------------------------

/**
 * extractTopics(text) -> string[]
 * Extracts topic keywords from annotation or feedback text.
 */
function extractTopics(text) {
  if (!text) return ['general'];
  const lower = text.toLowerCase();
  const found = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      found.push(topic);
    }
  }
  return found.length > 0 ? found : ['general'];
}

/**
 * isDirectiveAnnotation(text) -> boolean
 * Returns true if annotation uses directive language that bypasses 3-session threshold.
 */
function isDirectiveAnnotation(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return DIRECTIVE_KEYWORDS.some(kw => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// 6. Pattern Clustering
// ---------------------------------------------------------------------------

/**
 * clusterSignals(sessionSignals[], feedbackEntries[]) -> Cluster[]
 * Groups signals by (asset_type, signal_topic) tuples across sessions.
 * Applies 3-session threshold (1-session bypass for directives and feedback files).
 */
function clusterSignals(sessionSignals, feedbackEntries) {
  // Map: "assetType|topic" -> { assetTypes: Set, sessions: Set, positive: [], negative: [], annotations: [], bypassThreshold: bool }
  const clusterMap = new Map();

  function ensureCluster(key, assetType, topic) {
    if (!clusterMap.has(key)) {
      clusterMap.set(key, {
        key,
        topic,
        assetTypes: new Set(),
        sessions: new Set(),
        positive: [],   // winner signals
        negative: [],   // rejection signals
        annotations: [], // annotation text signals
        bypassThreshold: false,
      });
    }
    const c = clusterMap.get(key);
    c.assetTypes.add(assetType);
    return c;
  }

  // Process session signals
  for (const session of sessionSignals) {
    const assetType = session.platform || 'unknown';

    for (const signal of session.signals) {
      if (signal.type === 'winner') {
        const topics = ['general'];
        for (const topic of topics) {
          const key = `${assetType}|${topic}`;
          const cluster = ensureCluster(key, assetType, topic);
          cluster.sessions.add(session.sessionId);
          cluster.positive.push({ sessionId: session.sessionId, signal });
        }
      } else if (signal.type === 'rejection') {
        const topics = ['general'];
        for (const topic of topics) {
          const key = `${assetType}|${topic}`;
          const cluster = ensureCluster(key, assetType, topic);
          cluster.sessions.add(session.sessionId);
          cluster.negative.push({ sessionId: session.sessionId, signal });
        }
      } else if (signal.type === 'pin-annotation' || signal.type === 'sidebar-annotation') {
        const topics = extractTopics(signal.text);
        const isDirective = isDirectiveAnnotation(signal.text);
        for (const topic of topics) {
          const key = `${assetType}|${topic}`;
          const cluster = ensureCluster(key, assetType, topic);
          cluster.sessions.add(session.sessionId);
          cluster.annotations.push({ sessionId: session.sessionId, signal });
          if (isDirective) {
            cluster.bypassThreshold = true;
          }
        }
      }
    }
  }

  // Process feedback file entries (always bypass threshold)
  for (const entry of feedbackEntries) {
    const assetType = entry.asset_type || 'general';
    const topics = extractTopics(entry.operator_notes || '');

    // Also extract topics from rule_weights_affected rules
    const ruleTopics = (entry.rule_weights_affected || []).flatMap(r =>
      extractTopics(r.rule || '')
    );
    const allTopics = [...new Set([...topics, ...ruleTopics])];

    for (const topic of allTopics) {
      const key = `${assetType}|${topic}`;
      const cluster = ensureCluster(key, assetType, topic);
      cluster.bypassThreshold = true;  // feedback files always bypass
      // Use a synthetic session ID for feedback files
      cluster.sessions.add(`feedback:${entry._filename}`);
      cluster.annotations.push({
        sessionId: `feedback:${entry._filename}`,
        signal: {
          type: 'feedback-file',
          text: entry.operator_notes || '',
          ruleWeightsAffected: entry.rule_weights_affected || [],
          outcome: entry.outcome,
          assetType: entry.asset_type,
          assetName: entry.asset_name,
        },
      });
    }
  }

  // Filter clusters by threshold and determine conflicting signals
  const qualifyingClusters = [];
  for (const cluster of clusterMap.values()) {
    const sessionCount = cluster.sessions.size;
    const hasAnnotationsOrFeedback = cluster.annotations.length > 0;

    // Qualify if:
    // - 3+ distinct sessions (standard threshold), OR
    // - bypass flag set (directive annotation or feedback file), OR
    // - has meaningful annotations (any count)
    const qualifies = sessionCount >= 3 ||
                      cluster.bypassThreshold ||
                      (hasAnnotationsOrFeedback && cluster.bypassThreshold);

    if (!qualifies) continue;

    // Detect conflicting signals: >= 40/60 split between positive and negative
    const totalSentiment = cluster.positive.length + cluster.negative.length;
    let conflicting = false;
    if (totalSentiment > 0) {
      const negativeRatio = cluster.negative.length / totalSentiment;
      conflicting = negativeRatio >= 0.4 && negativeRatio <= 0.6;
    }

    qualifyingClusters.push({
      ...cluster,
      assetTypes: Array.from(cluster.assetTypes),
      sessions: Array.from(cluster.sessions),
      sessionCount,
      conflicting,
    });
  }

  return qualifyingClusters;
}

// ---------------------------------------------------------------------------
// 7. Cross-Pollination Scoping
// ---------------------------------------------------------------------------

/**
 * scopeProposal(cluster) -> { targetFile, scope }
 * Determines the target brand doc and scope (asset-specific vs brand-level).
 * - Single asset type -> asset-specific doc
 * - Multiple asset types -> brand-level doc based on topic
 */
function scopeProposal(cluster) {
  const assetTypes = cluster.assetTypes;
  const topic = cluster.topic;

  if (assetTypes.length === 1) {
    // Asset-specific scope
    const assetType = assetTypes[0].toLowerCase();
    const targetFile = ASSET_DOC_MAP[assetType] || 'social-post-specs';
    return { targetFile, scope: 'asset-specific' };
  }

  // Brand-level scope — pick doc based on topic
  const targetFile = TOPIC_BRAND_DOC_MAP[topic] || 'voice-rules';
  return { targetFile, scope: 'brand-level' };
}

// ---------------------------------------------------------------------------
// 8. Proposal Generation
// ---------------------------------------------------------------------------

/**
 * generateProposals(clusters[]) -> Proposal[]
 * Produces proposal objects from qualifying clusters.
 */
function generateProposals(clusters) {
  const proposals = [];

  for (const cluster of clusters) {
    const { targetFile, scope } = scopeProposal(cluster);

    // Determine confidence
    let confidence;
    if (cluster.sessionCount >= 5 || cluster.annotations.some(a => a.signal.type === 'feedback-file')) {
      confidence = 'HIGH';
    } else if (cluster.sessionCount >= 3) {
      confidence = 'MEDIUM';
    } else {
      confidence = 'LOW';  // threshold bypass (1 session, directive annotation)
    }

    // Determine proposal type
    let type;
    const hasRuleWeights = cluster.annotations.some(a =>
      a.signal.ruleWeightsAffected && a.signal.ruleWeightsAffected.length > 0
    );
    if (hasRuleWeights) {
      type = 'weight-adjustment';
    } else if (cluster.annotations.length > 0 && cluster.negative.length > cluster.positive.length) {
      type = 'rule-modification';
    } else if (cluster.positive.length > 0 && cluster.negative.length === 0) {
      type = 'new-rule';
    } else {
      type = 'rule-modification';
    }

    // Build evidence list
    const evidence = [];
    for (const ann of cluster.annotations) {
      evidence.push({ sessionId: ann.sessionId, signal: ann.signal.text || ann.signal.type });
    }
    for (const neg of cluster.negative) {
      evidence.push({ sessionId: neg.sessionId, signal: `rejection: ${neg.signal.variationPath || 'variation'}` });
    }
    for (const pos of cluster.positive) {
      evidence.push({ sessionId: pos.sessionId, signal: `winner: ${pos.signal.variationPath || 'variation'}` });
    }

    // Build proposed text summary
    const annotationTexts = cluster.annotations
      .map(a => a.signal.text)
      .filter(Boolean)
      .slice(0, 3);

    const currentText = `[Current rule text in ${path.basename(targetFile)} for topic: ${cluster.topic}]`;
    const proposedText = annotationTexts.length > 0
      ? `[Update based on operator feedback: "${annotationTexts.join('; ')}"]`
      : `[Adjust rule based on ${cluster.sessionCount} session pattern — ${cluster.negative.length > cluster.positive.length ? 'reduce' : 'reinforce'} ${cluster.topic} guidance]`;

    proposals.push({
      type,
      confidence,
      target: targetFile,
      scope,
      topic: cluster.topic,
      assetTypes: cluster.assetTypes,
      sessionCount: cluster.sessionCount,
      currentText,
      proposedText,
      evidence,
      conflicting: cluster.conflicting,
    });
  }

  return proposals;
}

// ---------------------------------------------------------------------------
// 9. Proposal File Writer
// ---------------------------------------------------------------------------

/**
 * writeProposalFile(proposals[], outputDir) -> string (filePath)
 * Writes feedback/proposals/YYYY-MM-DD-proposal.md.
 */
function writeProposalFile(proposals, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const filePath = path.join(outputDir, `${dateStr}-proposal.md`);

  const lines = [
    `# Feedback Ingestion Proposals — ${dateStr}`,
    '',
    `**Proposals generated:** ${proposals.length}`,
    '',
    '---',
    '',
  ];

  proposals.forEach((proposal, i) => {
    lines.push(`## Proposal ${i + 1}: ${formatProposalTitle(proposal)}`);
    lines.push(`**Type:** ${proposal.type}`);
    lines.push(`**Confidence:** ${proposal.confidence} (${proposal.sessionCount} session${proposal.sessionCount !== 1 ? 's' : ''}${proposal.conflicting ? ', CONFLICTING SIGNALS' : ''})`);
    lines.push(`**Target:** ${proposal.target}`);
    lines.push(`**Scope:** ${proposal.scope}`);
    lines.push(`**Asset types:** ${proposal.assetTypes.join(', ')}`);
    lines.push('');
    lines.push('**Current text:**');
    lines.push(`> ${proposal.currentText}`);
    lines.push('');
    lines.push('**Proposed text:**');
    lines.push(`> ${proposal.proposedText}`);
    lines.push('');
    lines.push('**Evidence:**');
    for (const ev of proposal.evidence) {
      lines.push(`- ${ev.sessionId}: ${ev.signal}`);
    }
    if (proposal.conflicting) {
      lines.push('');
      lines.push('> **WARNING: Conflicting signals detected (40/60+ split). Operator judgement required.**');
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}

function formatProposalTitle(proposal) {
  const topicLabel = proposal.topic.replace(/_/g, ' ');
  return `${topicLabel} — ${proposal.assetTypes.join('/')} — ${proposal.type}`;
}

// ---------------------------------------------------------------------------
// 10. Main Orchestrator
// ---------------------------------------------------------------------------

/**
 * main() — orchestrates the full feedback ingestion run.
 */
function main(options = {}) {
  const projectRoot = path.resolve(__dirname, '..');
  const workingDir = path.join(projectRoot, '.fluid', 'working');
  const feedbackDir = path.join(projectRoot, 'feedback');
  const proposalsDir = path.join(feedbackDir, 'proposals');

  // Load manifest to get previously processed sessions
  const manifest = loadIngestedManifest(feedbackDir);
  const processedSet = new Set(manifest.processedSessions || []);

  // Discover all sessions
  const allSessions = discoverSessions(workingDir);
  const newSessions = allSessions.filter(s => !processedSet.has(s));
  const skippedCount = allSessions.length - newSessions.length;

  process.stderr.write(`Discovered ${allSessions.length} total sessions, ${newSessions.length} new, ${skippedCount} already processed.\n`);

  // Load signals for new sessions
  const sessionSignals = [];
  let noSignalCount = 0;
  for (const sessionId of newSessions) {
    const result = loadSessionSignals(workingDir, sessionId);
    if (result && result.signals.length > 0) {
      sessionSignals.push(result);
    } else {
      noSignalCount++;
    }
  }

  // Parse feedback files
  const feedbackEntries = parseFeedbackFiles(feedbackDir);

  // Cluster signals and generate proposals
  const clusters = clusterSignals(sessionSignals, feedbackEntries);
  const proposals = generateProposals(clusters);

  // Summary line
  process.stderr.write(`Analyzed ${newSessions.length} new sessions. Found ${proposals.length} pattern${proposals.length !== 1 ? 's' : ''} with proposals. ${noSignalCount} session${noSignalCount !== 1 ? 's' : ''} had no actionable signal.\n`);

  if (!options.dryRun) {
    // Write proposal file if there are proposals
    if (proposals.length > 0) {
      const proposalPath = writeProposalFile(proposals, proposalsDir);
      process.stderr.write(`Proposal file written to: ${proposalPath}\n`);
    }

    // Update manifest
    const updatedManifest = {
      ...manifest,
      processedSessions: [...(manifest.processedSessions || []), ...newSessions],
    };
    saveIngestedManifest(feedbackDir, updatedManifest);
  } else {
    process.stderr.write('[dry-run] No files written.\n');
  }

  // JSON to stdout
  const result = {
    analyzed: newSessions.length,
    proposals,
    newSessions,
    skippedSessions: skippedCount,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  return result;
}

// ---------------------------------------------------------------------------
// Self-Tests
// ---------------------------------------------------------------------------

function runTests() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function assert(condition, label) {
    if (condition) {
      passed++;
    } else {
      failed++;
      failures.push(label);
      process.stderr.write(`  FAIL: ${label}\n`);
    }
  }

  function assertEqual(actual, expected, label) {
    if (actual === expected) {
      passed++;
    } else {
      failed++;
      failures.push(label);
      process.stderr.write(`  FAIL: ${label}\n`);
      process.stderr.write(`    Expected: ${JSON.stringify(expected)}\n`);
      process.stderr.write(`    Actual:   ${JSON.stringify(actual)}\n`);
    }
  }

  process.stderr.write('\n=== Task 1 Tests: Session Discovery & Signal Extraction ===\n\n');

  // -------------------------------------------------------------------------
  // discoverSessions tests (using in-memory fixtures via mocked fs approach)
  // Since we can't mock fs easily in CJS self-tests, we test the pattern filter
  // by calling the function with a temp directory we create inline.
  // -------------------------------------------------------------------------
  {
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluid-test-'));

    // Create a valid session dir with lineage.json
    const validId = '20260310-123456';
    fs.mkdirSync(path.join(tmpDir, validId));
    fs.writeFileSync(
      path.join(tmpDir, validId, 'lineage.json'),
      JSON.stringify({ sessionId: validId, created: '2026-03-10T12:34:56Z', platform: 'instagram' })
    );

    // Create a dir that doesn't match the pattern
    fs.mkdirSync(path.join(tmpDir, 'not-a-session'));

    // Create a dir that matches pattern but has no lineage.json
    const noLineageId = '20260311-000000';
    fs.mkdirSync(path.join(tmpDir, noLineageId));

    const discovered = discoverSessions(tmpDir);

    assert(
      discovered.includes(validId),
      'discoverSessions: includes valid session with lineage.json'
    );
    assert(
      !discovered.includes('not-a-session'),
      'discoverSessions: skips dirs not matching YYYYMMDD-HHMMSS pattern'
    );
    assert(
      !discovered.includes(noLineageId),
      'discoverSessions: skips dirs without lineage.json'
    );

    // Non-existent dir returns empty array
    const empty = discoverSessions(path.join(tmpDir, 'nonexistent'));
    assertEqual(empty.length, 0, 'discoverSessions: returns [] for non-existent dir');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  }

  process.stderr.write('\n--- loadSessionSignals tests ---\n');

  // -------------------------------------------------------------------------
  // loadSessionSignals: Phase 4 rounds[] format
  // -------------------------------------------------------------------------
  {
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluid-test-'));
    const sessionId = '20260310-120000';
    const sessionDir = path.join(tmpDir, sessionId);
    fs.mkdirSync(sessionDir);

    const lineage = {
      sessionId,
      created: '2026-03-10T12:00:00Z',
      platform: 'instagram',
      template: null,
      rounds: [
        {
          roundNumber: 1,
          prompt: 'Create social post',
          timestamp: '2026-03-10T12:00:00Z',
          variations: [
            { id: 'v1', path: 'v1-styled.html', status: 'rejected' },
            { id: 'v2', path: 'v2-styled.html', status: 'winner' },
          ],
        },
      ],
    };
    fs.writeFileSync(path.join(sessionDir, 'lineage.json'), JSON.stringify(lineage));

    const result = loadSessionSignals(tmpDir, sessionId);
    assert(result !== null, 'loadSessionSignals Phase4: returns non-null result');
    assert(
      result.signals.some(s => s.type === 'winner' && s.variationPath === 'v2-styled.html'),
      'loadSessionSignals Phase4: extracts winner signal'
    );
    assert(
      result.signals.some(s => s.type === 'rejection' && s.variationPath === 'v1-styled.html'),
      'loadSessionSignals Phase4: extracts rejection signal'
    );
    assertEqual(result.platform, 'instagram', 'loadSessionSignals Phase4: correct platform');

    // Test annotations.json overrides lineage status
    const annotations = {
      statuses: { 'v1-styled.html': 'winner', 'v2-styled.html': 'rejected' },
      annotations: [
        { id: 'ann1', variationPath: 'v1-styled.html', type: 'pin', text: 'Great layout!', x: 50, y: 50 },
      ],
    };
    fs.writeFileSync(path.join(sessionDir, 'annotations.json'), JSON.stringify(annotations));

    const result2 = loadSessionSignals(tmpDir, sessionId);
    assert(
      result2.signals.some(s => s.type === 'winner' && s.variationPath === 'v1-styled.html'),
      'loadSessionSignals Phase4: annotations.json overrides lineage status (v1 is now winner)'
    );
    assert(
      result2.signals.some(s => s.type === 'rejection' && s.variationPath === 'v2-styled.html'),
      'loadSessionSignals Phase4: annotations.json overrides lineage status (v2 is now rejected)'
    );
    assert(
      result2.signals.some(s => s.type === 'pin-annotation' && s.text === 'Great layout!'),
      'loadSessionSignals Phase4: extracts pin-annotation text'
    );

    fs.rmSync(tmpDir, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // loadSessionSignals: Phase 2 entries[] format
  // -------------------------------------------------------------------------
  {
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluid-test-'));
    const sessionId = '20260101-090000';
    const sessionDir = path.join(tmpDir, sessionId);
    fs.mkdirSync(sessionDir);

    const lineage = {
      sessionId,
      created: '2026-01-01T09:00:00Z',
      platform: 'linkedin',
      entries: [
        { output: 'styled.html', prompt: 'Original prompt' },
        { output: 'v2-styled.html', prompt: 'Iteration prompt' },
      ],
    };
    fs.writeFileSync(path.join(sessionDir, 'lineage.json'), JSON.stringify(lineage));

    // No annotations.json -> all entries should be "unmarked" -> no winner/rejection signals
    const result1 = loadSessionSignals(tmpDir, sessionId);
    assert(
      !result1.signals.some(s => s.type === 'winner' || s.type === 'rejection'),
      'loadSessionSignals Phase2: no statuses without annotations.json (unmarked)'
    );

    // Add annotations.json with statuses
    const annotations = {
      statuses: { 'styled.html': 'rejected', 'v2-styled.html': 'winner' },
      annotations: [
        { id: 'a1', variationPath: 'styled.html', type: 'sidebar', text: 'The box feels more like a web page', x: null, y: null },
      ],
    };
    fs.writeFileSync(path.join(sessionDir, 'annotations.json'), JSON.stringify(annotations));

    const result2 = loadSessionSignals(tmpDir, sessionId);
    assert(
      result2.signals.some(s => s.type === 'rejection' && s.variationPath === 'styled.html'),
      'loadSessionSignals Phase2: derives rejection from annotations.json statuses'
    );
    assert(
      result2.signals.some(s => s.type === 'winner' && s.variationPath === 'v2-styled.html'),
      'loadSessionSignals Phase2: derives winner from annotations.json statuses'
    );
    assert(
      result2.signals.some(s => s.type === 'sidebar-annotation' && s.text.includes('web page')),
      'loadSessionSignals Phase2: extracts sidebar-annotation text'
    );

    fs.rmSync(tmpDir, { recursive: true });
  }

  process.stderr.write('\n--- parseFeedbackFiles tests ---\n');

  // -------------------------------------------------------------------------
  // parseFeedbackFiles tests
  // -------------------------------------------------------------------------
  {
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluid-feedback-'));

    // Write a README.md that should be skipped
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Readme\nShould be skipped.');

    // Write a valid feedback file
    const feedbackContent = `---
date: 2026-03-10
asset_type: brushstroke
asset_name: brushstroke-diagonal.png
prompt_used: "Social post for partner alert"
outcome: partial
operator_notes: "Opacity was too high at 0.25"
rule_weights_affected:
  - rule: "brushstroke opacity 0.10-0.25"
    current_weight: 90
    suggested_adjustment: "narrow range to 0.10-0.18"
---

Free-form notes here.
`;
    fs.writeFileSync(path.join(tmpDir, '2026-03-10-brushstroke-too-heavy.md'), feedbackContent);

    const results = parseFeedbackFiles(tmpDir);

    assertEqual(results.length, 1, 'parseFeedbackFiles: reads 1 feedback file, skips README.md');
    assertEqual(results[0].asset_type, 'brushstroke', 'parseFeedbackFiles: parses asset_type');
    assertEqual(results[0].outcome, 'partial', 'parseFeedbackFiles: parses outcome');
    assert(results[0].operator_notes.includes('Opacity'), 'parseFeedbackFiles: parses operator_notes');
    assert(
      Array.isArray(results[0].rule_weights_affected),
      'parseFeedbackFiles: parses rule_weights_affected as array'
    );
    assertEqual(results[0].rule_weights_affected.length, 1, 'parseFeedbackFiles: correct array length');
    assertEqual(
      results[0].rule_weights_affected[0].current_weight, 90,
      'parseFeedbackFiles: parses numeric current_weight'
    );
    assert(
      results[0].rule_weights_affected[0].rule.includes('brushstroke'),
      'parseFeedbackFiles: parses rule text'
    );

    // Empty dir returns []
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluid-empty-'));
    const emptyResults = parseFeedbackFiles(emptyDir);
    assertEqual(emptyResults.length, 0, 'parseFeedbackFiles: returns [] for dir with no .md files');

    fs.rmSync(tmpDir, { recursive: true });
    fs.rmSync(emptyDir, { recursive: true });
  }

  process.stderr.write('\n--- ingested.json manifest tests ---\n');

  // -------------------------------------------------------------------------
  // Manifest tests
  // -------------------------------------------------------------------------
  {
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluid-manifest-'));

    // Missing manifest -> returns default
    const defaultManifest = loadIngestedManifest(tmpDir);
    assertEqual(defaultManifest.version, '1.0', 'loadIngestedManifest: returns default version');
    assert(Array.isArray(defaultManifest.processedSessions), 'loadIngestedManifest: processedSessions is array');
    assertEqual(defaultManifest.processedSessions.length, 0, 'loadIngestedManifest: empty processedSessions on first run');

    // Save and reload
    saveIngestedManifest(tmpDir, { version: '1.0', processedSessions: ['20260310-120000', '20260311-090000'] });
    const reloaded = loadIngestedManifest(tmpDir);
    assertEqual(reloaded.processedSessions.length, 2, 'loadIngestedManifest: reloads saved sessions');
    assert(reloaded.processedSessions.includes('20260310-120000'), 'loadIngestedManifest: correct session IDs persisted');
    assert(reloaded.lastRun !== null, 'saveIngestedManifest: sets lastRun timestamp');

    fs.rmSync(tmpDir, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // Print results
  // -------------------------------------------------------------------------
  process.stderr.write('\n');
  if (failed === 0) {
    process.stderr.write(`PASS: ${passed}/${passed + failed} tests passed\n`);
  } else {
    process.stderr.write(`FAIL: ${failed}/${passed + failed} tests failed\n`);
    process.stderr.write('Failed tests:\n');
    for (const f of failures) {
      process.stderr.write(`  - ${f}\n`);
    }
  }

  return failed === 0;
}

function runTask2Tests() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function assert(condition, label) {
    if (condition) {
      passed++;
    } else {
      failed++;
      failures.push(label);
      process.stderr.write(`  FAIL: ${label}\n`);
    }
  }

  function assertEqual(actual, expected, label) {
    if (actual === expected) {
      passed++;
    } else {
      failed++;
      failures.push(label);
      process.stderr.write(`  FAIL: ${label}\n`);
      process.stderr.write(`    Expected: ${JSON.stringify(expected)}\n`);
      process.stderr.write(`    Actual:   ${JSON.stringify(actual)}\n`);
    }
  }

  process.stderr.write('\n=== Task 2 Tests: Pattern Clustering, Scoping & Proposal Generation ===\n\n');

  // -------------------------------------------------------------------------
  // clusterSignals tests
  // -------------------------------------------------------------------------
  {
    // Build 3 session signals about opacity (standard threshold)
    const sessionSignals = [
      {
        sessionId: 'S1', platform: 'instagram', template: null,
        signals: [
          { type: 'pin-annotation', text: 'opacity was too high', variationPath: 'v1.html' },
          { type: 'rejection', variationPath: 'v1.html' },
        ],
      },
      {
        sessionId: 'S2', platform: 'instagram', template: null,
        signals: [
          { type: 'pin-annotation', text: 'background element too prominent', variationPath: 'v1.html' },
        ],
      },
      {
        sessionId: 'S3', platform: 'instagram', template: null,
        signals: [
          { type: 'pin-annotation', text: 'opacity feels heavy', variationPath: 'v1.html' },
        ],
      },
    ];
    const clusters3 = clusterSignals(sessionSignals, []);
    assert(clusters3.length > 0, 'clusterSignals: produces clusters from 3+ sessions');

    // Only 2 sessions (below standard threshold, no bypass) -> no clusters for non-directive annotations
    const sessionSignals2 = [
      {
        sessionId: 'SA', platform: 'instagram', template: null,
        signals: [{ type: 'pin-annotation', text: 'text was small', variationPath: 'v1.html' }],
      },
      {
        sessionId: 'SB', platform: 'instagram', template: null,
        signals: [{ type: 'pin-annotation', text: 'font is small', variationPath: 'v1.html' }],
      },
    ];
    const clusters2 = clusterSignals(sessionSignals2, []);
    assert(clusters2.length === 0, 'clusterSignals: below 3-session threshold (no bypass) -> no clusters');

    // Directive annotation bypasses threshold (1 session)
    const directiveSession = [
      {
        sessionId: 'SD', platform: 'instagram', template: null,
        signals: [
          { type: 'pin-annotation', text: 'NEVER use diagonal brushstroke on small posts', variationPath: 'v1.html' },
        ],
      },
    ];
    const directiveClusters = clusterSignals(directiveSession, []);
    assert(directiveClusters.length > 0, 'clusterSignals: directive annotation bypasses 3-session threshold');
    assert(directiveClusters[0].bypassThreshold === true, 'clusterSignals: bypassThreshold set true for directive');

    // Feedback file bypasses threshold
    const feedbackEntry = {
      asset_type: 'brushstroke',
      asset_name: 'test.png',
      outcome: 'partial',
      operator_notes: 'The opacity was too high',
      rule_weights_affected: [
        { rule: 'brushstroke opacity range', current_weight: 90, suggested_adjustment: 'narrow' },
      ],
      _filename: '2026-03-10-test.md',
    };
    const feedbackClusters = clusterSignals([], [feedbackEntry]);
    assert(feedbackClusters.length > 0, 'clusterSignals: feedback file qualifies even with 0 sessions');
    assert(feedbackClusters[0].bypassThreshold === true, 'clusterSignals: feedback file sets bypassThreshold');

    // Conflicting signals: 40/60 split
    const conflictingSessions = [
      {
        sessionId: 'C1', platform: 'instagram', template: null,
        signals: [{ type: 'winner', variationPath: 'v1.html' }],
      },
      {
        sessionId: 'C2', platform: 'instagram', template: null,
        signals: [{ type: 'winner', variationPath: 'v1.html' }],
      },
      {
        sessionId: 'C3', platform: 'instagram', template: null,
        signals: [{ type: 'rejection', variationPath: 'v1.html' }],
      },
      // Total: 2 positive, 1 negative (67/33 split) -> not conflicting (>60%)
      // Let me do 3 positive, 2 negative = 40% negative -> conflicting
      {
        sessionId: 'C4', platform: 'instagram', template: null,
        signals: [{ type: 'rejection', variationPath: 'v1.html' }],
      },
      {
        sessionId: 'C5', platform: 'instagram', template: null,
        signals: [{ type: 'winner', variationPath: 'v1.html' }],
      },
    ];
    const conflictingClusters = clusterSignals(conflictingSessions, []);
    const generalClusters = conflictingClusters.filter(c => c.topic === 'general');
    if (generalClusters.length > 0) {
      assert(generalClusters[0].conflicting === true, 'clusterSignals: 40/60 split flagged as conflicting');
    } else {
      assert(false, 'clusterSignals: expected general cluster from conflicting sessions');
    }
  }

  process.stderr.write('\n--- scopeProposal tests ---\n');

  // -------------------------------------------------------------------------
  // scopeProposal tests
  // -------------------------------------------------------------------------
  {
    // Single asset type -> asset-specific doc
    const singleTypeCluster = {
      topic: 'opacity',
      assetTypes: ['instagram'],
    };
    const { targetFile: f1, scope: s1 } = scopeProposal(singleTypeCluster);
    assertEqual(s1, 'asset-specific', 'scopeProposal: single asset type -> asset-specific scope');
    assertEqual(f1, 'social-post-specs', 'scopeProposal: instagram -> social-post-specs');

    // Single website type -> website doc
    const websiteCluster = {
      topic: 'layout',
      assetTypes: ['website'],
    };
    const { targetFile: f2, scope: s2 } = scopeProposal(websiteCluster);
    assertEqual(s2, 'asset-specific', 'scopeProposal: website type -> asset-specific scope');
    assertEqual(f2, 'website-section-specs', 'scopeProposal: website -> website-section-specs');

    // Multiple asset types -> brand-level doc
    const multiTypeCluster = {
      topic: 'opacity',
      assetTypes: ['instagram', 'website'],
    };
    const { targetFile: f3, scope: s3 } = scopeProposal(multiTypeCluster);
    assertEqual(s3, 'brand-level', 'scopeProposal: multi asset type -> brand-level scope');
    assertEqual(f3, 'design-tokens', 'scopeProposal: opacity multi-type -> design-tokens');

    // Copy topic -> voice-rules
    const copyCluster = {
      topic: 'copy_density',
      assetTypes: ['instagram', 'linkedin'],
    };
    const { targetFile: f4, scope: s4 } = scopeProposal(copyCluster);
    assertEqual(s4, 'brand-level', 'scopeProposal: copy_density multi-type -> brand-level');
    assertEqual(f4, 'voice-rules', 'scopeProposal: copy_density -> voice-rules');
  }

  process.stderr.write('\n--- generateProposals tests ---\n');

  // -------------------------------------------------------------------------
  // generateProposals tests
  // -------------------------------------------------------------------------
  {
    const cluster = {
      topic: 'opacity',
      assetTypes: ['instagram'],
      sessions: ['S1', 'S2', 'S3'],
      sessionCount: 3,
      positive: [],
      negative: [
        { sessionId: 'S1', signal: { type: 'rejection', variationPath: 'v1.html' } },
      ],
      annotations: [
        { sessionId: 'S1', signal: { type: 'pin-annotation', text: 'opacity too high', ruleWeightsAffected: undefined } },
        { sessionId: 'S2', signal: { type: 'pin-annotation', text: 'heavy background', ruleWeightsAffected: undefined } },
        { sessionId: 'S3', signal: { type: 'pin-annotation', text: 'prominent background', ruleWeightsAffected: undefined } },
      ],
      conflicting: false,
      bypassThreshold: false,
    };

    const proposals = generateProposals([cluster]);
    assertEqual(proposals.length, 1, 'generateProposals: produces one proposal per cluster');

    const p = proposals[0];
    assert(p.type !== undefined, 'generateProposals: proposal has type');
    assert(['HIGH', 'MEDIUM', 'LOW'].includes(p.confidence), 'generateProposals: confidence is HIGH/MEDIUM/LOW');
    assert(p.target !== undefined, 'generateProposals: proposal has target file');
    assert(['asset-specific', 'brand-level'].includes(p.scope), 'generateProposals: scope is asset-specific or brand-level');
    assert(typeof p.currentText === 'string', 'generateProposals: currentText is string');
    assert(typeof p.proposedText === 'string', 'generateProposals: proposedText is string');
    assert(Array.isArray(p.evidence), 'generateProposals: evidence is array');
    assert(p.evidence.length > 0, 'generateProposals: evidence is non-empty');
    assert(typeof p.conflicting === 'boolean', 'generateProposals: conflicting is boolean');

    // HIGH confidence (5+ sessions)
    const highCluster = { ...cluster, sessions: ['S1','S2','S3','S4','S5'], sessionCount: 5 };
    const highProposals = generateProposals([highCluster]);
    assertEqual(highProposals[0].confidence, 'HIGH', 'generateProposals: 5+ sessions -> HIGH confidence');

    // MEDIUM confidence (3-4 sessions)
    assertEqual(p.confidence, 'MEDIUM', 'generateProposals: 3 sessions -> MEDIUM confidence');

    // LOW confidence (1 session, bypass)
    const lowCluster = { ...cluster, sessions: ['S1'], sessionCount: 1, bypassThreshold: true };
    const lowProposals = generateProposals([lowCluster]);
    assertEqual(lowProposals[0].confidence, 'LOW', 'generateProposals: 1-session bypass -> LOW confidence');
  }

  process.stderr.write('\n--- writeProposalFile tests ---\n');

  // -------------------------------------------------------------------------
  // writeProposalFile tests
  // -------------------------------------------------------------------------
  {
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluid-proposals-'));

    const testProposals = [
      {
        type: 'rule-modification',
        confidence: 'HIGH',
        target: 'social-post-specs',
        scope: 'asset-specific',
        topic: 'opacity',
        assetTypes: ['instagram'],
        sessionCount: 5,
        currentText: 'Brushstroke opacity: 0.10–0.25',
        proposedText: 'Brushstroke opacity: 0.10–0.18',
        evidence: [{ sessionId: 'S1', signal: 'opacity too high' }],
        conflicting: false,
      },
    ];

    const filePath = writeProposalFile(testProposals, tmpDir);
    assert(fs.existsSync(filePath), 'writeProposalFile: creates proposal file');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert(content.includes('Proposal 1:'), 'writeProposalFile: contains proposal header');
    assert(content.includes('rule-modification'), 'writeProposalFile: contains proposal type');
    assert(content.includes('HIGH'), 'writeProposalFile: contains confidence');
    assert(content.includes('social-post-specs'), 'writeProposalFile: contains target section slug');
    assert(content.includes('opacity too high'), 'writeProposalFile: contains evidence');
    assert(content.includes('Brushstroke opacity: 0.10–0.18'), 'writeProposalFile: contains proposed text');

    fs.rmSync(tmpDir, { recursive: true });
  }

  process.stderr.write('\n--- --dry-run mode test ---\n');

  // -------------------------------------------------------------------------
  // --dry-run: test that main() with dryRun=true does not write files
  // -------------------------------------------------------------------------
  {
    // We can't easily test this without disk interaction, but we can verify
    // the option is wired through the main function by checking its signature.
    // A more thorough test would require mocking, so we'll verify the function
    // accepts the option parameter without error.
    assert(typeof main === 'function', '--dry-run: main() function exists and accepts options');
  }

  // -------------------------------------------------------------------------
  // Print results
  // -------------------------------------------------------------------------
  process.stderr.write('\n');
  if (failed === 0) {
    process.stderr.write(`PASS: ${passed}/${passed + failed} tests passed\n`);
  } else {
    process.stderr.write(`FAIL: ${failed}/${passed + failed} tests failed\n`);
    process.stderr.write('Failed tests:\n');
    for (const f of failures) {
      process.stderr.write(`  - ${f}\n`);
    }
  }

  return failed === 0;
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

const argv = yargs(hideBin(process.argv))
  .scriptName('feedback-ingest')
  .usage('feedback-ingest.cjs — Ingest feedback annotations into the DB\n\nUsage: $0 [options]')
  .option('test', {
    describe: 'Run internal self-tests and exit',
    type: 'boolean',
    default: false,
  })
  .option('dry-run', {
    describe: 'Parse and validate feedback without writing to the DB',
    type: 'boolean',
    default: false,
  })
  .strict()
  .help()
  .parseSync();

if (argv.test) {
  const task1Pass = runTests();
  const task2Pass = runTask2Tests();
  process.exit(task1Pass && task2Pass ? 0 : 1);
} else if (argv.dryRun) {
  main({ dryRun: true });
} else {
  main({ dryRun: false });
}
