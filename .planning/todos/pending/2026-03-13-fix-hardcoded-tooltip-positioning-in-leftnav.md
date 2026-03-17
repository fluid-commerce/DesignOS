---
created: 2026-03-13T22:18:55.027Z
title: Fix hardcoded tooltip positioning in LeftNav
area: ui
files:
  - canvas/src/components/LeftNav.tsx:153
---

## Problem

LeftNav tooltip uses `left: 52 + 8` (hardcoded 60px from left edge), assuming the nav column is always 52px wide. If nav width changes (e.g. responsive layout, design update), tooltips will misalign.

## Solution

Use `getBoundingClientRect()` from the hovered button to dynamically calculate the tooltip's left position, or derive the offset from a shared constant/CSS variable for nav width.
