---
created: 2026-03-16T00:00:00.000Z
title: Refactor IdeasGetStarted 573-line monolith
area: ui
files:
  - canvas/src/components/IdeasGetStarted.tsx
---

## Problem

IdeasGetStarted.tsx is 573 lines with inline styles and duplicated design token constants (same BG_CARD, BORDER, etc. already defined in BuildHero). Same monolith pattern flagged in BuildHero from PR #4.

## Solution

Extract suggestion card into its own component, share design token constants from a common file (e.g. `tokens.ts`), and break the main component into composable pieces. Can be done alongside the BuildHero refactor todo.
