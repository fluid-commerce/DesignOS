---
created: "2026-03-13T16:50:35.699Z"
title: Rebuild new asset modal to match Jonathan's original
area: ui
files:
  - canvas/src/App.tsx:440-710
  - canvas/src/components/TemplateGallery.tsx
  - canvas/src/components/TemplateCustomizer.tsx
  - Reference/Context/Jonathan's Codebase/templates/index.html
---

## Problem

The current "New Asset" modal (NewAssetTab component in App.tsx) has a different layout and visual style than Jonathan's original implementation. Current version has a vertical single-column left panel with Skill picker, Base Template list, Brief textarea, References section, and Generate Prompt button — with a preview pane on the right.

Jonathan's original (the desired target) uses a 2-column grid of template cards (numbered 01-08 with dimension badges), no Skill picker section, Brief and References below the template grid, and a large centered "GENERATE PROMPT" button at the bottom. The preview pane is on the right with a cleaner minimal style.

Key differences:
- **Template layout**: Jonathan uses a 2-column grid of compact cards vs current vertical list
- **No Skill picker**: Jonathan's version omits the Ad Creative / Social Content / Copywriting selector
- **Template cards**: Numbered badges (01, 02...) with dimension labels (1080², 1340x630, 4 slides)
- **Brief section**: Below templates, not in a separate panel section
- **Generate button**: Large, centered, blue, prominent at bottom
- **Overall feel**: Cleaner, more spacious, darker background

## Solution

Reference Jonathan's implementation in `Reference/Context/Jonathan's Codebase/templates/index.html` — specifically the modal/overlay code for creating new assets. Rebuild the NewAssetTab component to match his layout, grid structure, card styling, and interaction pattern exactly. Keep the React/Zustand data flow but adopt his visual design and UX.
