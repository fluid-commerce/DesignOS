/**
 * Tests for the standalone-save routing behavior introduced when
 * saveCreation was made campaign-optional.
 *
 * Guarantees:
 *   - When saveCreation is called with no campaignId, the resulting creation
 *     lives under the singleton "__standalone__" sentinel campaign.
 *   - Subsequent campaignless saves reuse the same sentinel — a brand-new
 *     "Agent Campaign {date}" row is NEVER created.
 *   - getOrCreateStandaloneCampaignId is idempotent.
 *   - The on-disk .fluid/campaigns/<cId>/ path matches the sentinel ID.
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

import { closeDb, getDb } from '../lib/db';
import {
  getOrCreateStandaloneCampaignId,
  STANDALONE_CAMPAIGN_TITLE,
  getCampaign,
  getCampaigns,
} from '../server/db-api';
import { saveCreation } from '../server/agent-tools';

// Use a temp database so tests never pollute fluid.db.
// saveCreation writes under PROJECT_ROOT/.fluid/campaigns/... — PROJECT_ROOT
// is derived from import.meta.dirname at module load, so we can't redirect
// it. We track every campaign ID we touch and rm -rf each
// .fluid/campaigns/<cId> tree on teardown.
let tempRoot: string;
const createdCampaignDirs = new Set<string>();
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

function track(cId: string): void {
  createdCampaignDirs.add(cId);
}

beforeAll(() => {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standalone-save-test-'));
  process.env.FLUID_DB_PATH = path.join(dir, 'test.db');
  tempRoot = dir;
});

afterAll(() => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch {}
  for (const cId of createdCampaignDirs) {
    try {
      fs.rmSync(path.join(PROJECT_ROOT, '.fluid', 'campaigns', cId), {
        recursive: true,
        force: true,
      });
    } catch {}
  }
});

describe('getOrCreateStandaloneCampaignId', () => {
  it('creates the sentinel campaign on first call with title "__standalone__"', () => {
    const id = getOrCreateStandaloneCampaignId();
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);

    const campaign = getCampaign(id);
    expect(campaign).toBeDefined();
    expect(campaign?.title).toBe(STANDALONE_CAMPAIGN_TITLE);
    expect(campaign?.channels).toEqual(['standalone']);
  });

  it('is idempotent — repeated calls return the same campaign ID', () => {
    const a = getOrCreateStandaloneCampaignId();
    const b = getOrCreateStandaloneCampaignId();
    const c = getOrCreateStandaloneCampaignId();
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('never creates more than one row with title "__standalone__"', () => {
    // Call the helper many times, then assert there's still only one sentinel.
    for (let i = 0; i < 5; i++) getOrCreateStandaloneCampaignId();
    const db = getDb();
    const rows = db
      .prepare('SELECT id FROM campaigns WHERE title = ?')
      .all(STANDALONE_CAMPAIGN_TITLE) as { id: string }[];
    expect(rows.length).toBe(1);
  });
});

describe('saveCreation — campaignless routing', () => {
  const SAMPLE_HTML =
    '<!doctype html><html><head><style>.x{color:red}</style></head><body><div class="x">hi</div></body></html>';

  it('routes a campaignless save to the sentinel campaign', () => {
    const sentinelId = getOrCreateStandaloneCampaignId();
    const result = saveCreation(SAMPLE_HTML, null, 'instagram', undefined);
    track(result.campaignId);
    expect(result.campaignId).toBe(sentinelId);

    const campaign = getCampaign(result.campaignId);
    expect(campaign?.title).toBe(STANDALONE_CAMPAIGN_TITLE);
  });

  it('reuses the same sentinel across multiple campaignless saves', () => {
    const a = saveCreation(SAMPLE_HTML, null, 'instagram', undefined);
    const b = saveCreation(SAMPLE_HTML, null, 'linkedin', undefined);
    const c = saveCreation(SAMPLE_HTML, null, 'one-pager', undefined);
    track(a.campaignId);
    track(b.campaignId);
    track(c.campaignId);
    expect(a.campaignId).toBe(b.campaignId);
    expect(b.campaignId).toBe(c.campaignId);
  });

  it('never creates an "Agent Campaign ..." row', () => {
    // Even after many campaignless saves, no auto-named campaigns exist.
    for (let i = 0; i < 3; i++) {
      const r = saveCreation(SAMPLE_HTML, null, 'instagram', undefined);
      track(r.campaignId);
    }
    const campaigns = getCampaigns();
    const autoNamed = campaigns.filter((c) => c.title.startsWith('Agent Campaign '));
    expect(autoNamed).toEqual([]);
  });

  it('honors an explicit campaignId and does not route to the sentinel', () => {
    const db = getDb();
    const now = Date.now();
    const realId = 'explicit-campaign-id-xyz';
    db.prepare(
      'INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(realId, 'Real Campaign', JSON.stringify(['instagram']), now, now);

    const result = saveCreation(SAMPLE_HTML, null, 'instagram', realId);
    track(result.campaignId);
    expect(result.campaignId).toBe(realId);
    expect(result.campaignId).not.toBe(getOrCreateStandaloneCampaignId());
  });
});
