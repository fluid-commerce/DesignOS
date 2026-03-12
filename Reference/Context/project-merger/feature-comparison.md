# Feature Comparison Matrix

## Side-by-Side

| Feature | Chey's System | Jonathan's System | Merged: Source |
|---------|:---:|:---:|:---:|
| AI skill orchestration | Yes | No | Chey |
| Sub-agent pipeline (copy/layout/style/spec) | Yes | No | Chey |
| Claude CLI headless integration | Yes | No | Chey |
| Canvas MCP integration | Yes | No | Chey (stays wired up) |
| [[iteration-system]] + baseline tracking | Yes | No | Chey |
| Feedback ingestion loop | Yes | No | Chey |
| Brand intelligence & compliance | Yes | No | Chey |
| Left sidebar AI chat | Yes | No | Chey |
| App-level framing (header/nav) | Yes (basic) | No | Chey (concept) + Jonathan (style) |
| Tech stack / framework | Yes | Vanilla JS | Chey (Jonathan rebuilt here) |
| Template library (8 curated) | No | Yes | Jonathan (source of truth) |
| Right sidebar content editing | No | Yes | Jonathan (pattern) |
| Photo repositioning/framing | No | Yes | Jonathan (pattern) |
| Brush/transform (1 element) | No | Yes (early) | Jonathan (pattern, keep as-is) |
| GUI asset type picker | No | Yes | Jonathan (pattern) |
| [[campaign-and-carousel]] | No | Yes | Jonathan (pattern) |
| Carousel multi-frame editing | No | Yes | Jonathan (pattern) |
| Visual polish / look & feel | Basic | Polished | Jonathan |
| Export (JPG/WebP/HTML) | No | Yes | Jonathan |
| Drill-down navigation | No | No | New (unified) |
| Breadcrumbs + back button | No | No | New |
| Baseline diff tracking | Partial | No | New (enhanced) |

## Resolved Integration Decisions

1. **Canvas vs Editor view** → Replaced by drill-down grid model. Iterations grid is where the canvas lives; right sidebar is where the editor lives. No "unified viewport" needed — they're different levels of the drill-down.
2. **Asset creation flow** → Both entry points preserved. AI chat for generation, template library/GUI for manual. AI is always-available, never required.
3. **Content editing** → AI generates iterations, sidebar edits in-place. Independent workflows, shared data layer.
4. **Tech stack** → Jonathan's vanilla JS rebuilt in Chey's stack. Design patterns preserved, architecture replaced.

## Gaps to Fill

- Agents don't know about campaigns or carousels yet → [[agent-enhancements]]
- Data persistence needs research (localStorage → ?) → [[research-needed]]
- Iframe/postMessage decision for template rendering → [[research-needed]]
- Baseline diff tracking structure needs design → [[iteration-system]]

## Complementary Nature

These systems are almost perfectly complementary with minimal true overlap. Chey provides the AI engine, iteration intelligence, and tech stack. Jonathan provides the UI design, editing UX, and content management patterns. The main work is rebuilding Jonathan's UI natively and wiring it to Chey's engine.
