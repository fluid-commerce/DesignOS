---
created: 2026-03-16T00:00:00.000Z
title: Deduplicate assets fetch between AssetsScreen and BuildHero
area: ui
files:
  - canvas/src/components/AssetsScreen.tsx
  - canvas/src/components/BuildHero.tsx
---

## Problem

Both AssetsScreen and BuildHero independently `fetch('/api/assets')` on mount. If both tabs have been visited, the same data is fetched twice with no shared cache. As asset count grows this becomes wasteful and can show stale data in one view after changes in the other.

## Solution

Move saved assets into the Zustand campaign store (or a dedicated assets store) so both components read from a single source of truth. Fetch once, invalidate on create/delete.
