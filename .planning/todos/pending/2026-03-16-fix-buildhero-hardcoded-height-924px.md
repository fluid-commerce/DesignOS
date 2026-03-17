---
created: 2026-03-16T00:00:00.000Z
title: Fix BuildHero hardcoded height 924px
area: ui
files:
  - canvas/src/components/BuildHero.tsx
---

## Problem

BuildHero sets `height: 924` (fixed pixel value) on its root container. This will clip or overflow on screens shorter than 924px (most laptops). Combined with `paddingTop: 240px`, it leaves very little usable space on smaller viewports.

## Solution

Replace `height: 924` with `height: '100%'` or `min-height: '100%'` and use `overflow-y: auto` so the content scrolls naturally. The `paddingTop: 240px` may also need to scale down on shorter screens.
