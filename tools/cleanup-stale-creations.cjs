#!/usr/bin/env node
/**
 * Delete iteration rows whose html_path file no longer exists on disk, then
 * cascade-delete empty slides/creations/campaigns.
 *
 * Run: node tools/cleanup-stale-creations.cjs [--dry-run] [--url <url>]
 *
 * Requires the dev server to be running. The endpoint is gated by
 * FLUID_ADMIN_ENABLED=true — start the server with that env set, e.g.:
 *
 *   FLUID_ADMIN_ENABLED=true npm --prefix canvas run dev
 *
 * Modes:
 *   --dry-run   Report what would be deleted; perform no mutations.
 *   (default)   Execute the cleanup.
 *
 * --url overrides the default http://localhost:5174 target.
 *
 * Exits:
 *   0 on success (including "no stale rows" and dry-run)
 *   1 on network/DB/admin-disabled errors
 */

const DEFAULT_URL = 'http://localhost:5174';

function parseArgs(argv) {
  const out = { dryRun: false, url: DEFAULT_URL };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '-n') out.dryRun = true;
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node tools/cleanup-stale-creations.cjs [--dry-run] [--url <base-url>]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

async function main() {
  const { dryRun, url } = parseArgs(process.argv.slice(2));
  const endpoint = `${url.replace(/\/$/, '')}/api/admin/cleanup-stale-creations${dryRun ? '?dryRun=1' : ''}`;

  console.log(`${dryRun ? 'DRY-RUN' : 'EXECUTE'} — POST ${endpoint}`);

  let res;
  try {
    res = await fetch(endpoint, { method: 'POST' });
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    console.error(`Is the dev server running on ${url}?`);
    process.exit(1);
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(`Non-JSON response (${res.status}): ${text.slice(0, 500)}`);
    process.exit(1);
  }

  if (res.status === 403) {
    console.error(`Admin endpoints disabled: ${json.error || 'FLUID_ADMIN_ENABLED=true required'}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`Server error (${res.status}): ${JSON.stringify(json)}`);
    process.exit(1);
  }

  const { iterationsDeleted, slidesDeleted, creationsDeleted, campaignsDeleted, details } = json;

  console.log('');
  console.log('Stale iteration summary');
  console.log('-----------------------');
  console.log(`  detected:       ${details.length}`);
  console.log(`  iterations del: ${iterationsDeleted}`);
  console.log(`  slides del:     ${slidesDeleted}`);
  console.log(`  creations del:  ${creationsDeleted}`);
  console.log(`  campaigns del:  ${campaignsDeleted}`);

  if (details.length > 0) {
    console.log('');
    console.log('Detected stale rows:');
    for (const d of details) {
      const ageMin = (d.age_ms / 60_000).toFixed(1);
      console.log(`  ${d.id}  age=${ageMin}m  ${d.html_path}`);
    }
  }

  if (dryRun && details.length > 0) {
    console.log('');
    console.log('Re-run without --dry-run to perform the deletions.');
  }

  process.exit(0);
}

main();
