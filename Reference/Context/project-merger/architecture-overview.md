# Architecture Overview

## Two Systems, One Product

```
┌─────────────────────────────────────────────────┐
│              Merged Fluid Design OS             │
├─────────────────────┬───────────────────────────┤
│   Jonathan's Layer  │      Chey's Layer         │
│   (UI Patterns)     │      (Engine + Stack)     │
├─────────────────────┼───────────────────────────┤
│ Template library    │ Claude CLI (headless)     │
│ Content editor UI   │ Skill orchestration       │
│ Right sidebar       │ Sub-agent pipeline        │
│ Photo framing       │ Canvas MCP integration    │
│ Element selection   │ Iteration history         │
│ Campaign views      │ Feedback ingestion loop   │
│ Carousel builder    │ Brand intelligence        │
│ Visual polish/style │ Compliance validation     │
│ Export (JPG/WebP)   │ CLI tools                 │
│ Design patterns     │ Framework / tech stack    │
└─────────────────────┴───────────────────────────┘
```

**Key distinction**: Jonathan's layer provides the *design* and *UX patterns*. Chey's layer provides the *engine* and the *tech stack* it's all built in. Jonathan's vanilla JS/iframe architecture is rebuilt natively in Chey's stack.

## Drill-Down Navigation Model

The entire app follows a consistent drill-down grid pattern:

```
┌─────────────────────────────────────┐
│ Campaigns (grid of thumbnails)      │
│  ├── click ──► Assets (grid)        │
│  │              ├── click ──► Frames (grid, if applicable)
│  │              │              ├── click ──► Iterations (grid)
│  │              │              │              └── select ──► Right sidebar editor
│  │              │              │
│  │              │              └── (single-frame assets skip this level)
│  │              │
│  └── breadcrumbs + back button at every level
└─────────────────────────────────────┘
```

Same visual paradigm at each level: thumbnails in a grid, click to drill deeper. Selecting an iteration is the action that opens the right sidebar editor.

## Chey's Architecture ([[cheys-system]])

- **Orchestration layer**: Skills that call Claude CLI headless for asset generation
- **Sub-agent system**: Different agents with different focuses (copy, layout, styling, spec-check)
- **Canvas MCP**: Main viewport integration, stays wired up in the merged product
- **Iteration tracking**: Each Frame has a history of iterations; diffs tracked for learning
- **Learning loop**: AI-generated baseline vs user-modified state feeds back into brand rules, templates, and skills
- **Baseline diff tracking**: Every iteration stores what AI generated AND what the user changed — this is training data

## Jonathan's Architecture ([[jonathans-system]])

- **Tech stack**: Vanilla JS + HTML/CSS, iframe-based template rendering, postMessage IPC, localStorage persistence. **Gets rebuilt in Chey's stack.**
- **Template library**: 8 curated HTML templates (source of truth for social media)
- **Editor**: iframe preview + right sidebar with dynamic content slot fields
- **Content slots**: Per-template field definitions (text, image, divider) with CSS selectors
- **Photo framing**: Fit/Fill mode with focus point drag (objectPosition)
- **Brush/transform**: SVG overlay with move/rotate/scale handles (one element per template)
- **Carousel**: Multi-slide assets with show/hide toggling and per-slide controls
- **Export**: html2canvas for JPG/WebP, raw HTML for code download

## Integration Points

1. **AI generation → drill-down grid**: AI generates assets/campaigns → they appear as thumbnails in the appropriate grid level
2. **Iteration selection → right sidebar**: Clicking an iteration loads its state into Jonathan's content slot editor
3. **Manual edits → baseline tracking**: Edits in the sidebar modify the current iteration in-place; system tracks diff vs AI-generated original
4. **Campaign generation → grid landing**: AI generates full campaign from prompt → user lands in campaign asset grid
5. **Canvas MCP → iteration grid**: The existing fluid-canvas integration becomes the iteration-level view in the drill-down

## Research Required

- **Data persistence**: localStorage vs file-based vs SQLite — see [[research-needed]]
- **Iframe vs direct DOM**: Whether to preserve template sandboxing pattern — see [[research-needed]]

See [[feature-comparison]] for detailed overlap analysis.
