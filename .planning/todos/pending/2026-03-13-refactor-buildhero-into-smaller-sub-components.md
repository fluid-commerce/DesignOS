---
created: 2026-03-13T22:18:55.027Z
title: Refactor BuildHero into smaller sub-components
area: ui
files:
  - canvas/src/components/BuildHero.tsx
---

## Problem

BuildHero.tsx is 1,209 lines in a single file — a monolith containing inline styles, all state management, and every sub-component (form sections, dropdowns, DAM asset picker integration). Hard to maintain, test, or modify individual sections independently.

## Solution

Break into smaller components:
- Extract form section components (type selector, dimension picker, tool dropdown)
- Extract DAM asset picker integration into its own component
- Move inline styles to CSS modules or shared style objects
- Keep BuildHero as a thin orchestrator that composes the sub-components
