/**
 * Typed fetch wrapper for the Fluid DAM REST API.
 * Server-only module — NEVER import from React components or client code.
 *
 * Auth: VITE_FLUID_DAM_TOKEN is a standard JWT Bearer token that works
 * for both the client-side DAM Picker SDK and direct server-side fetch() calls.
 */

const DAM_BASE_URL = 'https://api.fluid.app/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawDamAsset {
  id: number;
  code: string;
  name: string;
  category: string;
  canonical_path: string;
  default_variant_url?: string | null;
  updated_at: string;
  variants?: Array<{ id: string; mime_type: string; processing_status: string }>;
}

interface DamQueryResponse {
  tree: Record<string, unknown>;
  meta?: {
    next_cursor?: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Type guard: checks if a value looks like a RawDamAsset (has code, name, and variants array).
 */
export function isRawDamAsset(value: unknown): value is RawDamAsset {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'name' in value &&
    'variants' in value &&
    Array.isArray((value as Record<string, unknown>).variants)
  );
}

/**
 * Recursively walk the DAM tree response and extract all RawDamAsset objects.
 * Assets are identified by having code, name, and variants properties.
 * Stops recursing at depth > 10 to prevent infinite loops on malformed data.
 *
 * Source: adapted from fluid-mono useDamLibrary.ts flattenTree algorithm.
 */
export function flattenDamTree(tree: Record<string, unknown>, depth = 0): RawDamAsset[] {
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

/**
 * Decode the JWT payload (no signature verification needed server-side).
 * Returns the company_id number embedded in the token.
 */
export function getCompanyIdFromToken(token: string): number {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()) as {
    company_id: number;
  };
  return payload.company_id;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * POST /dam/query — list assets by folder path with cursor-based pagination.
 * Returns the raw tree response for the caller to flatten.
 */
export async function damQuery(
  token: string,
  params: { path: string; cursor?: string; limit?: number },
): Promise<DamQueryResponse> {
  const res = await fetch(`${DAM_BASE_URL}/dam/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-fluid-client': 'admin',
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`DAM query failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<DamQueryResponse>;
}

/**
 * List all assets in the Brand Elements folder (paginated).
 * Path format: `{companyId}.{folderName}.*`
 *
 * Fetches all pages via cursor and returns a flat array of all assets.
 */
export async function listBrandElements(
  token: string,
  companyId: number,
  folderName = 'brand_elements',
): Promise<RawDamAsset[]> {
  const path = `${companyId}.${folderName}.*`;
  let cursor: string | undefined;
  const allAssets: RawDamAsset[] = [];

  do {
    const data = await damQuery(token, { path, cursor, limit: 100 });
    allAssets.push(...flattenDamTree(data.tree));
    cursor = data.meta?.next_cursor;
  } while (cursor);

  return allAssets;
}
