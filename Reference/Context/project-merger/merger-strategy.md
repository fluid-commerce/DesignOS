# Merger Strategy

## Direction

Merge Jonathan's project INTO Chey's Fluid Design OS. Chey's system is the foundation; Jonathan's UI gets **rebuilt in Chey's stack** preserving his design patterns, UX, and visual polish.

## Guiding Principles

1. **Keep everything Chey has built** — AI skill orchestration, sub-agent architecture, canvas MCP system, [[iteration-system]], feedback ingestion loop. None of this gets replaced.
2. **Rebuild Jonathan's UI in Chey's stack** — His interface is more polished and refined. It becomes the visual/interaction layer, but rebuilt to integrate natively rather than bolted on. His design patterns and UX flows must be faithfully preserved.
3. **Additive, not destructive** — This is a merge, not a rewrite. Both systems have been built in silos, so reconciliation must be careful and deliberate.
4. **AI is always-available, never required** — Users can generate entire campaigns with a single prompt, build everything manually, or any mix. AI is a collaborator that can be introduced at any point.

## What Comes From Each System

### From Chey's System ([[cheys-system]])
- All AI skill orchestration and sub-agent pipeline
- Canvas MCP integration (fluid-canvas tools stay wired up)
- [[iteration-system]] (iteration history, baseline tracking, feedback ingestion)
- Left sidebar AI chat interface
- App-level framing (header, contained web-app feel)
- Brand intelligence, compliance tooling, and all `brand/` docs
- CLI tools and validation pipeline
- Tech stack / framework (Jonathan's vanilla JS gets rebuilt here)

### From Jonathan's System ([[jonathans-system]])
- Overall look and feel / visual polish
- Template library (8 curated templates = source of truth for social media)
- Right sidebar with content slot fields (direct editing)
- Photo repositioning/framing within assets
- Element selection and drag-to-reposition (single brush per template)
- [[campaign-and-carousel]] system (campaigns > assets > frames)
- Export capabilities (JPG, WebP, HTML)
- Design patterns and UX flows (rebuilt, not copied verbatim)

## Critical Constraints

- The merged product must feel like a **web app** (header, navigation, contained layout) — not a standalone web page. Jonathan's system currently reads more like a page. Chey's app framing concept carries over, styled with Jonathan's visual language.
- **Full feature parity** is the merger goal — no phased rollout. Campaigns, carousels, templates, AI generation, iteration tracking, feedback loop, all working end-to-end.
- **Single user** scope — no multi-user or collaboration for the merger.
- **Templates are curated, not AI-generated.** Jonathan's 8 templates are the social media source of truth.

## Tech Decision

Jonathan's codebase is vanilla JS + HTML/CSS with iframe-based rendering and postMessage IPC. **This stack is NOT preserved.** The UI is rebuilt in Chey's stack, but the design patterns, visual polish, UX flows, and interaction models are faithfully reproduced.

## See Also

- [[design-decisions]] — Full decision log from merger planning
- [[research-needed]] — Items requiring technical investigation
- [[ui-ux-decisions]] — Detailed UI reconciliation
- [[risks-and-scope]] — What could go wrong
- [[agent-enhancements]] — What agents need to learn
