# Phase 13: DAM Sync - Research

**Researched:** 2026-03-17
**Domain:** Fluid DAM REST API, SQLite schema migration, Node.js file download, pull-based sync patterns
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sync Direction**
- Two-way sync scoped to brand assets: DAM → local for browsing/generation; local → DAM for uploads
- DAM is upstream source of truth: In conflicts, DAM version wins. Local DB is a cache with push-back capability
- Brand Elements folder in DAM: A dedicated folder holds brand elements. On first sync, the app creates this folder via DAM API if it doesn't exist
- Local uploads push to DAM: When a user uploads a brand asset locally, it immediately pushes to the Brand Elements folder in DAM (background, fails silently if offline — queued for next sync)

**Sync Trigger & Timing**
- On app startup + manual refresh: Sync runs when Vite server starts (like brand-seeder.ts pattern). Plus a "Sync now" button in the UI. No background polling
- Immediate push for local uploads: Local → DAM pushes happen immediately on save, not batched. Queued if offline
- No webhooks: Local dev environment cannot receive webhooks. Pull-based only

**Asset Scope & Mapping**
- Brand Elements folder only: Only assets in the designated DAM folder sync. Everything else stays in DAM
- Merge into brand_assets table with source column: Add `source: 'local' | 'dam'` and `dam_asset_id` columns to existing brand_assets table. One table, one /api/brand-assets endpoint, unified for agents and UI
- Download to local disk: DAM assets are cached to assets/brand/ like local assets today. DAM URL stored as metadata for sync tracking
- Medium scale (100–1,000 assets): Incremental sync by last_synced_at per asset. Pagination via cursor for DAM API calls

**Conflict & Staleness**
- DAM wins on conflict: If same asset is edited locally and in DAM, DAM version overwrites local on next sync
- Soft-delete on DAM removal: When a DAM asset is removed from Brand Elements folder, mark as dam_deleted locally. Keep file on disk. Show as "removed from DAM" in UI. User cleans up manually
- Per-asset sync timestamp: Each brand_assets row gets last_synced_at and dam_modified_at columns for incremental sync
- Stale cache used silently: When DAM is unreachable, app works with cached data. "Last synced: X ago" indicator, no blocking errors

**Auth & Infrastructure**
- Same token: Reuse VITE_FLUID_DAM_TOKEN for both client-side DAM Picker and server-side sync. One token to configure

### Claude's Discretion

- Exact DAM API integration approach (depends on research findings)
- File naming strategy for downloaded DAM assets on local disk
- Incremental sync algorithm details (etag, modified timestamp, or content hash)
- "Sync now" button placement and progress indicator design
- How to handle DAM folder creation API call on first sync
- Queue/retry mechanism for offline push-to-DAM operations

### Deferred Ideas (OUT OF SCOPE)

- Background polling for DAM changes — periodic sync beyond startup
- DAM webhook integration — real-time sync
- Full DAM library browsing — syncing beyond the Brand Elements folder
- DAM-backed voice rules and patterns — syncing brand copy/patterns
- Multi-user conflict resolution UI — showing both versions
</user_constraints>

---

## Summary

The Fluid DAM exposes a server-callable REST API at `https://api.fluid.app/api` that supports listing assets by folder path, creating assets, downloading asset URLs, and deleting assets. The key insight is that the **VITE_FLUID_DAM_TOKEN is a standard JWT Bearer token** — it works for both the client-side DAM Picker SDK and direct server-side `fetch()` calls with `Authorization: Bearer <token>`. No separate server token is required.

The DAM organizes assets via a dot-notation canonical path system (e.g., `{company_id}.images.*`). The `/dam/query` POST endpoint lists assets in a path with cursor-based pagination. Assets are served via CDN URLs stored in `default_variant_url`. Uploads use a two-step ImageKit workflow (create placeholder → upload to ImageKit → backfill), but downloads are simple: the `default_variant_url` is a public CDN URL that can be fetched directly with no auth.

The local DB schema needs migration: three new nullable columns on `brand_assets` (`source`, `dam_asset_id`, `last_synced_at`, `dam_modified_at`). The brand-seeder.ts startup pattern is the model for the DAM sync runner. All sync logic lives in server-only modules, never imported by React components.

**Primary recommendation:** Implement the DAM sync as a `dam-sync.ts` server module that mirrors the `brand-seeder.ts` pattern — runs on Vite startup, is idempotent, uses the existing `VITE_FLUID_DAM_TOKEN` with `Authorization: Bearer` header, calls `/dam/query` to list the Brand Elements folder, downloads CDN URLs to local disk, and upserts into `brand_assets` with source='dam'.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | already installed | DB upsert for synced assets | Already the project DB layer; sync rows fit the brand_assets table |
| `node:fs/promises` | built-in | Download DAM files to local disk | Same as asset-scanner.ts and brand-seeder.ts |
| `node:fetch` | built-in (Node 18+) | HTTP calls to Fluid DAM REST API | No dependency needed; Vite dev server already runs Node 18+ |
| `nanoid` | already installed | Generate local IDs for new DAM-sourced rows | Consistent with all other DB inserts in this project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:path` | built-in | Construct local file paths for downloaded assets | File naming strategy for assets/brand/ subdirectory |
| `node:stream` | built-in | Stream large file downloads to disk | For files over ~1MB to avoid buffering full content in memory |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| native fetch | `node-fetch`, `axios` | No reason to add a dependency; Node 18+ fetch is sufficient for REST calls |
| Manual HTTP download | ImageKit SDK | ImageKit SDK is browser-oriented; server-side download is just a CDN URL fetch |

**Installation:** No new packages required. All needed tools are built-in or already in `canvas/package.json`.

**Version verification:** `better-sqlite3` is already in use. `nanoid` already installed. No new packages needed — confirms no version risk.

---

## Architecture Patterns

### Recommended Project Structure

```
canvas/src/server/
├── dam-sync.ts          # NEW: DAM sync runner (startup + manual trigger)
├── dam-client.ts        # NEW: Typed fetch wrapper for Fluid DAM REST API
├── brand-seeder.ts      # EXISTING: voice guide + patterns seeder (unchanged)
├── asset-scanner.ts     # EXISTING: local filesystem scanner (unchanged)
├── db-api.ts            # EXISTING: extend with DAM columns + upsert functions
└── watcher.ts           # EXISTING: add /api/dam-sync POST endpoint + startup call
```

### Pattern 1: DAM REST API — Token Auth

The VITE_FLUID_DAM_TOKEN is a JWT Bearer token that works server-side. Confirmed by inspecting the fluid-mono `api-helpers.ts` which uses `Authorization: Bearer <token>` against `https://api.fluid.app/api`.

**Server-side DAM client:**
```typescript
// Source: fluid-mono/apps/fluid-admin/lib/api-helpers.ts + env.ts
const DAM_BASE_URL = 'https://api.fluid.app/api';

async function damFetch(endpoint: string, token: string, options?: RequestInit) {
  const res = await fetch(`${DAM_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-fluid-client': 'admin',
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`DAM API error: ${res.status} ${res.statusText}`);
  return res.json();
}
```

### Pattern 2: List Assets by Folder Path — POST /dam/query

The DAM uses ltree-style dot-notation paths. To list the Brand Elements folder for company 980191006:
- Path: `980191006.brand_elements.*` (or whatever category name is chosen)
- Use `*` as wildcard suffix to list all assets within the folder
- Supports cursor-based pagination via `meta.next_cursor`

**Confirmed endpoint and schema** (from `fluid-mono/apps/fluid-admin/networking/dam/query.api.ts` and `schema.ts`):
```typescript
// Source: fluid-mono/apps/fluid-admin/networking/dam/query.api.ts
// POST https://api.fluid.app/api/dam/query
// Body:
interface DamQueryParams {
  path: string;         // e.g. "980191006.brand_elements.*" or "*" for all
  search?: string;
  tags_string?: string;
  cursor?: string;      // for pagination
  limit?: number;
}

// Response:
interface DamQueryResponse {
  path: string;
  tree: Record<string, DamAsset | Record<string, unknown>>;  // nested tree structure
  meta?: {
    next_cursor?: string;  // present when more pages exist
  };
}
```

**CRITICAL:** The response is a `tree` object — a nested structure keyed by path components, not a flat array. Assets within the tree are identified by having `code` and `variants` properties. The `flattenTree` pattern from `useDamLibrary.ts` is the authoritative way to extract assets from the tree.

### Pattern 3: Asset Data Shape

Each asset in the tree (confirmed from `schema.ts`):
```typescript
// Source: fluid-mono/apps/fluid-admin/networking/dam/schema.ts
interface DamAsset {
  id: number;
  canonical_path: string;        // e.g. "980191006.brand_elements.abc123"
  category: string;
  code: string;                  // unique asset identifier (use as dam_asset_id)
  company: string;
  created_at: string;            // ISO datetime
  default_variant_id: string;
  default_variant_url?: string;  // CDN URL — direct download, no auth needed
  description: string;
  name: string;
  updated_at: string;            // ISO datetime — use for incremental sync
  variants?: DamVariant[];
}
```

**Asset download:** `default_variant_url` is a public CDN URL. Fetch it directly with no auth header. If null/undefined, fall back to: `https://api.fluid.app/api/dam/assets/{code}/variants/{default_variant_id}/content` with Bearer token.

### Pattern 4: Upload to DAM — Two-Step ImageKit Flow

For local → DAM pushes, the upload process is a 3-step flow (from `assets.api.ts`):
1. POST `/dam/assets` with `placeholder_asset: { mime_type, name }` → get `canonical_path` and `asset.id`
2. POST `/dam/assets/imagekit_auth` → get ImageKit auth token/signature/expire
3. POST to `https://upload.imagekit.io/api/v1/files/upload` with file + auth → get `fileId` and `url`
4. POST `/dam/assets/backfill_imagekit` with `imagekit_file_id`, `imagekit_url`, and `expected_path`

This is complex. Given the CONTEXT.md scopes local → DAM push to "fails silently if offline", consider whether a simpler direct upload approach exists. **If the placeholder+ImageKit flow is too complex for the server-side context, the MVP can defer local→DAM push to Phase 14** and focus Phase 13 on DAM→local sync which is the higher-value direction.

### Pattern 5: Startup Sync — brand-seeder.ts Model

```typescript
// Mirrors brand-seeder.ts idempotency pattern
export async function runDamSync(token: string, assetsDir: string): Promise<void> {
  // 1. Get company ID from token (decode JWT or config)
  // 2. Query Brand Elements folder via /dam/query
  // 3. For each asset: check last_synced_at vs dam_modified_at
  // 4. Download changed assets to assetsDir/brand/
  // 5. Upsert into brand_assets with source='dam'
  // 6. Soft-delete assets no longer in folder (set dam_deleted=1)
}
```

### Pattern 6: DB Schema Migration

```sql
-- Add to initSchema() in db.ts (try-catch pattern already established)
ALTER TABLE brand_assets ADD COLUMN source TEXT NOT NULL DEFAULT 'local';
ALTER TABLE brand_assets ADD COLUMN dam_asset_id TEXT;
ALTER TABLE brand_assets ADD COLUMN dam_asset_url TEXT;  -- original CDN URL for re-sync
ALTER TABLE brand_assets ADD COLUMN last_synced_at INTEGER;
ALTER TABLE brand_assets ADD COLUMN dam_modified_at TEXT; -- ISO datetime from DAM
ALTER TABLE brand_assets ADD COLUMN dam_deleted INTEGER NOT NULL DEFAULT 0;

-- Index for efficient DAM sync lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_assets_dam_id ON brand_assets(dam_asset_id);
```

**Migration strategy:** Use the established `try { ALTER TABLE ... } catch {}` pattern in `initSchema()`. SQLite throws if column already exists; catch is the idempotency guard. No migration framework needed.

### Pattern 7: Company ID from JWT

The DAM path requires `company_id`. Decode the JWT token to extract it — no extra API call needed:

```typescript
// Token payload contains company_id (confirmed from .env JWT inspection)
// { company_id: 980191006, ... }
function getCompanyIdFromToken(token: string): number {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  return payload.company_id;
}
```

### Anti-Patterns to Avoid

- **Polling in Vite middleware:** The sync should run once at startup and on manual POST /api/dam-sync, not on a timer. Timers in Vite middleware are hard to clean up and can cause port-in-use errors on HMR.
- **Storing full file content in DB:** DAM assets go to disk at `assets/brand/dam/{filename}`. The DB stores only the file path (consistent with local assets).
- **Blocking startup on sync:** Wrap the startup sync in a non-blocking async call. If DAM is unreachable, log a warning and continue. The app should start even if sync fails.
- **Treating tree as flat array:** The `/dam/query` response `tree` is a nested object. Must flatten it (see `flattenTree` pattern from useDamLibrary.ts) before processing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP auth headers | Custom auth middleware | Simple `Authorization: Bearer` header on each fetch | DAM uses stateless JWT; no session/cookie complexity |
| JWT decoding | Full JWT library | `Buffer.from(token.split('.')[1], 'base64')` | Only need payload for company_id; no signature verification needed server-side (server trusts itself) |
| Cursor pagination | Complex queue system | Loop on `meta.next_cursor` presence | DAM API handles the complexity; client just follows cursors |
| File download | Streaming framework | `fetch(url).then(r => r.arrayBuffer())` + `fs.writeFile` | CDN URLs are direct, no chunking needed at medium scale |
| DB migrations | Migration runner (knex, etc.) | `try { ALTER TABLE } catch {}` pattern | Already established in this codebase; no new dependencies |

**Key insight:** The DAM API's "tree" response is the trickiest part — everything else (auth, download, upsert) maps cleanly to existing patterns in this codebase.

---

## Common Pitfalls

### Pitfall 1: Tree Structure vs. Flat List
**What goes wrong:** Treating the `/dam/query` response `tree` as `{ assets: [] }` and getting undefined.
**Why it happens:** The API returns a nested tree keyed by path components, not a flat array.
**How to avoid:** Always use a `flattenTree()` helper to extract DamAsset objects (identified by having `code` and `variants` properties).
**Warning signs:** `tree.assets` is undefined; iterating tree with `Object.values()` returns folders not assets.

### Pitfall 2: Null default_variant_url
**What goes wrong:** Calling `fetch(asset.default_variant_url)` on null and crashing.
**Why it happens:** Newly uploaded or processing assets may not have a CDN URL yet (`processing_status !== 'completed'`).
**How to avoid:** Check `asset.default_variant_url` is truthy before downloading. Fall back to the authenticated variant content URL, or skip and retry on next sync.
**Warning signs:** 404 errors or null reference errors on file download.

### Pitfall 3: Token Expiry During Long Sync
**What goes wrong:** Sync starts with valid token, fails partway through with 401 on asset 57 of 200.
**Why it happens:** The JWT has an expiry. Long syncs spanning the expiry window will fail mid-run.
**How to avoid:** Check JWT expiry before sync starts. If < 5 minutes remaining, skip sync and surface "token expiring soon" warning. Normal syncs will be fast (< 30 seconds).
**Warning signs:** 401 errors appearing mid-sync, not at the start.

### Pitfall 4: File Path Collisions
**What goes wrong:** Two DAM assets with the same display name overwrite each other on disk.
**Why it happens:** DAM names are user-defined and not unique. Local disk path is derived from name.
**How to avoid:** Use `dam_asset_id` (the `code` field) as the filename prefix: `assets/brand/dam/{code}-{sanitized-name}.{ext}`. Guarantees uniqueness.
**Warning signs:** Brand assets disappearing or wrong image showing for an asset.

### Pitfall 5: Blocking Vite Startup
**What goes wrong:** Vite dev server hangs for 10+ seconds on startup when DAM is unreachable (timeout).
**Why it happens:** If `runDamSync()` is awaited synchronously in the Vite plugin setup, a slow/absent DAM will delay all server startup.
**How to avoid:** Call `runDamSync().catch(err => console.warn('[dam-sync] failed:', err))` without await. Startup sync is fire-and-forget.
**Warning signs:** `vite` command appears to hang; Ctrl+C required after timeout.

### Pitfall 6: INSERT OR IGNORE vs. Upsert for DAM Assets
**What goes wrong:** Using `INSERT OR IGNORE` (like asset-scanner.ts) means updated DAM assets never refresh locally.
**Why it happens:** asset-scanner.ts uses INSERT OR IGNORE because local files are immutable. DAM assets change.
**How to avoid:** Use `INSERT OR REPLACE` or `UPDATE SET` for DAM-sourced rows, checking `dam_modified_at` to determine if update is needed.
**Warning signs:** Updated DAM assets not reflected locally even after "Sync now".

---

## Code Examples

### Flatten DAM Tree Response
```typescript
// Source: fluid-mono/apps/fluid-admin/components/FilePicker/hooks/useDamLibrary.ts
// Adapted for server-side Node.js use

interface RawDamAsset {
  id: number;
  code: string;
  name: string;
  category: string;
  canonical_path: string;
  default_variant_url?: string | null;
  updated_at: string;
  variants?: Array<{ id: string; mime_type: string; processing_status: string }>;
}

function isRawDamAsset(value: unknown): value is RawDamAsset {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'name' in value &&
    'variants' in value &&
    Array.isArray((value as Record<string, unknown>).variants)
  );
}

function flattenDamTree(
  tree: Record<string, unknown>,
  depth = 0
): RawDamAsset[] {
  if (depth > 10) return [];
  const assets: RawDamAsset[] = [];
  for (const value of Object.values(tree)) {
    if (isRawDamAsset(value)) {
      assets.push(value);
    } else if (typeof value === 'object' && value !== null) {
      assets.push(...flattenDamTree(value as Record<string, unknown>, depth + 1));
    }
  }
  return assets;
}
```

### List Brand Elements Folder (Paginated)
```typescript
// Source: Fluid DAM REST API (confirmed from fluid-mono networking/dam/query.api.ts)
async function listBrandElementAssets(
  token: string,
  companyId: number,
  folderName = 'brand_elements'
): Promise<RawDamAsset[]> {
  const path = `${companyId}.${folderName}.*`;
  let cursor: string | undefined;
  const allAssets: RawDamAsset[] = [];

  do {
    const res = await fetch('https://api.fluid.app/api/dam/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-fluid-client': 'admin',
      },
      body: JSON.stringify({ path, cursor, limit: 100 }),
    });
    if (!res.ok) throw new Error(`DAM query failed: ${res.status}`);
    const data = await res.json() as { tree: Record<string, unknown>; meta?: { next_cursor?: string } };
    allAssets.push(...flattenDamTree(data.tree));
    cursor = data.meta?.next_cursor;
  } while (cursor);

  return allAssets;
}
```

### Upsert DAM Asset into brand_assets
```typescript
// Source: pattern based on brand-seeder.ts + asset-scanner.ts + db-api.ts
import { getDb } from '../lib/db';
import { nanoid } from 'nanoid';

interface DamAssetRow {
  damId: string;    // asset.code
  name: string;
  category: string; // 'brand_elements' or DAM category
  filePath: string; // relative path within assets/brand/
  mimeType: string;
  sizeBytes: number;
  damUrl: string;   // original CDN URL
  damModifiedAt: string; // ISO datetime from DAM updated_at
}

function upsertDamAsset(row: DamAssetRow): void {
  const db = getDb();
  const existing = db.prepare(
    'SELECT id, dam_modified_at FROM brand_assets WHERE dam_asset_id = ?'
  ).get(row.damId) as { id: string; dam_modified_at: string } | undefined;

  if (existing) {
    // Only update if DAM version is newer
    if (existing.dam_modified_at >= row.damModifiedAt) return;
    db.prepare(`
      UPDATE brand_assets SET
        name = ?, file_path = ?, mime_type = ?, size_bytes = ?,
        dam_asset_url = ?, dam_modified_at = ?, last_synced_at = ?, dam_deleted = 0
      WHERE dam_asset_id = ?
    `).run(row.name, row.filePath, row.mimeType, row.sizeBytes,
           row.damUrl, row.damModifiedAt, Date.now(), row.damId);
  } else {
    db.prepare(`
      INSERT INTO brand_assets
        (id, name, category, file_path, mime_type, size_bytes, tags,
         source, dam_asset_id, dam_asset_url, dam_modified_at, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'dam', ?, ?, ?, ?, ?)
    `).run(nanoid(), row.name, row.category, row.filePath, row.mimeType, row.sizeBytes,
           '[]', row.damId, row.damUrl, row.damModifiedAt, Date.now(), Date.now());
  }
}
```

### Soft-Delete Removed Assets
```typescript
// Source: pattern derived from decisions in CONTEXT.md
function softDeleteRemovedDamAssets(currentDamIds: Set<string>): void {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, dam_asset_id FROM brand_assets WHERE source = 'dam' AND dam_deleted = 0"
  ).all() as Array<{ id: string; dam_asset_id: string }>;

  for (const row of rows) {
    if (!currentDamIds.has(row.dam_asset_id)) {
      db.prepare('UPDATE brand_assets SET dam_deleted = 1 WHERE id = ?').run(row.id);
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DAM assets referenced by URL only (saved_assets table) | DAM assets downloaded to disk, cached in brand_assets table | Phase 13 | Enables offline access and fast iframe rendering without CDN dependency |
| brand_assets = local files only, single source | brand_assets = unified table with source column | Phase 13 | Agents and UI see one endpoint for all brand assets |
| No server-side DAM interaction | Server-side DAM REST API calls via Bearer token | Phase 13 | Sync no longer requires the browser/client-side Picker SDK |

**Deprecated/outdated in this phase:**
- AssetsScreen "Add from Fluid DAM" being the only way to get DAM assets into the app — sync makes this automatic

---

## Open Questions

1. **Brand Elements Folder — Path Format**
   - What we know: DAM path is `{company_id}.{category_name}.*`. Company ID is 980191006 (from JWT).
   - What's unclear: Does the DAM allow arbitrary category names like `brand_elements`, or only the predefined categories (`images`, `videos`, `audio`, `documents`, `files`)?
   - Recommendation: On first sync, attempt to query `980191006.brand_elements.*`. If 0 results, the folder may need to be created. If the API rejects the category name, fall back to using a tag-based filter (`tags_string: 'brand-element'`) instead of folder-based. Research suggests POST `/dam/assets` allows creating assets at any path — so creation should work.

2. **Folder Creation — Does the API Support It?**
   - What we know: The DAM creates assets at paths derived from canonical_path. Creating an asset in a new path implicitly creates the folder.
   - What's unclear: Is there a dedicated "create folder" endpoint? Or does creating the first asset in `brand_elements` category auto-create the folder?
   - Recommendation: On first sync, if the Brand Elements folder is empty (or query returns 0 results), treat this as "folder doesn't exist yet" and proceed. The folder will be auto-created when the first asset is uploaded to it.

3. **Upload Auth — Is VITE_FLUID_DAM_TOKEN Sufficient for ImageKit?**
   - What we know: The ImageKit upload flow requires: (a) Bearer token for `/dam/assets/imagekit_auth` → get ImageKit auth, (b) NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY for the ImageKit upload request.
   - What's unclear: Does the DesignOS app have access to the ImageKit public key? This env var doesn't exist in `.env.example`.
   - Recommendation: If local → DAM push is scoped to MVP, only implement DAM → local download in Phase 13. Defer the ImageKit upload path to a follow-on. This removes the IMAGEKIT_PUBLIC_KEY dependency entirely for Phase 13.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured in `canvas/vite.config.ts`) |
| Config file | `canvas/vite.config.ts` (test section with environmentMatchGlobs) |
| Quick run command | `cd canvas && npx vitest run src/__tests__/dam-sync.test.ts` |
| Full suite command | `cd canvas && npx vitest run` |

### Phase Requirements → Test Map

No formal REQ IDs were provided for this phase. Mapping by behavior:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| flattenDamTree extracts assets from nested tree | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "flattenDamTree"` | Wave 0 |
| upsertDamAsset inserts new DAM asset row | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "upsert"` | Wave 0 |
| upsertDamAsset skips if dam_modified_at unchanged | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "incremental"` | Wave 0 |
| softDeleteRemovedDamAssets marks missing assets | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "soft-delete"` | Wave 0 |
| DB migration adds new columns without error | unit | `npx vitest run src/__tests__/db.test.ts` | Extend existing |
| /api/brand-assets includes DAM-sourced assets | integration | `npx vitest run src/__tests__/brand-assets.test.ts` | Extend existing |
| /api/dam-sync POST returns sync status | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "POST endpoint"` | Wave 0 |
| runDamSync handles offline DAM gracefully | unit | `npx vitest run src/__tests__/dam-sync.test.ts -t "offline"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd canvas && npx vitest run src/__tests__/dam-sync.test.ts`
- **Per wave merge:** `cd canvas && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `canvas/src/__tests__/dam-sync.test.ts` — covers flattenDamTree, upsert, incremental sync, soft-delete, offline handling, POST endpoint
- [ ] `canvas/vite.config.ts` — add `['src/__tests__/dam-sync.test.ts', 'node']` to environmentMatchGlobs (DAM sync is server-only, needs node environment)

---

## Sources

### Primary (HIGH confidence)
- `fluid-mono/apps/fluid-admin/networking/dam/schema.ts` — Complete Zod schema for DamAsset, DamQueryResponse, DamAssetCreateRequest. Authoritative API contract.
- `fluid-mono/apps/fluid-admin/networking/dam/query.api.ts` — `/dam/query` POST endpoint, `/dam/assets/{code}` DELETE, `/dam/assets/{code}/discard` PATCH
- `fluid-mono/apps/fluid-admin/networking/dam/assets.api.ts` — POST `/dam/assets` create, ImageKit upload flow
- `fluid-mono/apps/fluid-admin/networking/imagekit/imagekit.api.ts` — POST `/dam/assets/imagekit_auth`, POST `/dam/assets/backfill_imagekit`
- `fluid-mono/apps/fluid-admin/env.ts` — API base URL confirmed: `https://api.fluid.app/api`
- `fluid-mono/apps/fluid-admin/lib/api-helpers.ts` — Auth pattern: `Authorization: Bearer <token>`, `x-fluid-client: admin` header
- `fluid-mono/apps/fluid-admin/components/FilePicker/hooks/useDamLibrary.ts` — `flattenTree` algorithm for DAM query response; path format `{company_id}.{category}.*`
- `/Users/cheyrasmussen/Fluid-DesignOS/.env` — JWT token confirms payload shape; `company_id: 980191006` extractable from JWT
- `canvas/node_modules/@fluid-commerce/dam-picker/README.md` — SDK is client-side only; `SelectedAsset.assetCode` = the `code` field; CDN URL in `url`
- `canvas/src/server/brand-seeder.ts` — Startup seeder pattern (idempotency, COUNT(*) guard, fs + db)
- `canvas/src/server/asset-scanner.ts` — INSERT OR IGNORE idempotency; category from subdirectory
- `canvas/src/lib/db.ts` — `brand_assets` schema; `try { ALTER TABLE } catch {}` migration pattern
- `canvas/src/server/db-api.ts` — `getBrandAssets()`, `BrandAsset` interface, `rowToBrandAsset()` mapping

### Secondary (MEDIUM confidence)
- `fluid-mono/apps/fluid-admin/utils/dam-utils.ts` — `getDamAssetUrl()` fallback pattern: `{base_url}/dam/assets/{code}/variants/{variant_id}/content`
- `fluid-mono/apps/fluid-admin/networking/dam/index.ts` — `damQueryKeys` structure suggests caching strategy

### Tertiary (LOW confidence)
- `https://docs.fluid.app/docs/guides/dam-picker-sdk-guide` — Page failed to render content; could not verify server-side API documentation from official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all required packages already installed; no new dependencies
- Architecture: HIGH — DAM REST API endpoints confirmed from fluid-mono source code
- Auth approach: HIGH — Bearer token pattern confirmed from api-helpers.ts + JWT structure confirmed from .env
- DAM response format: HIGH — full Zod schema in schema.ts; flattenTree algorithm in useDamLibrary.ts
- Upload flow: MEDIUM — ImageKit 4-step flow confirmed from source; but ImageKit public key availability for server-side use is unverified
- Folder creation: LOW — inferred from asset creation API; no explicit "create folder" endpoint found

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable Fluid internal API; low risk of change)
