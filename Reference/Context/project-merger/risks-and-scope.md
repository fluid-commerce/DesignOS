# Risks & Scope

## Why This Is Complex

Two systems built in silos by different people with different priorities. Chey focused on AI orchestration and backend intelligence. Jonathan focused on UI polish and direct manipulation. The systems are highly complementary but were never designed to connect.

## Scope Decision: Full Feature Parity

The merger targets **full feature parity** — campaigns, carousels, templates, AI generation, iteration tracking, feedback loop, all working end-to-end. No phased rollout.

**In scope**:
- Complete drill-down navigation (Campaign > Asset > Frame > Iteration)
- AI chat (left sidebar) with full campaign generation
- Content editor (right sidebar) with all of Jonathan's controls
- Template library (8 curated templates, source of truth)
- Photo repositioning, brush/transform
- Carousel multi-frame editing
- Iteration history with baseline diff tracking
- Canvas MCP integration
- Export (JPG, WebP, HTML)
- Brand intelligence and compliance
- Feedback ingestion loop

**Out of scope**:
- Multi-user / collaboration
- New export formats
- AI-generated templates
- Expanding brush/transform to multiple elements
- Per-asset-type Frame naming (use "Frames" universally)
- Lane Fluid Sandbox (duplicate reference material)

## Key Risks

### 1. UI Rebuild Fidelity
**Risk**: Rebuilding Jonathan's vanilla JS UI in Chey's stack could lose the visual polish and interaction feel that makes his system good.
**Mitigation**: Use Jonathan's codebase as pixel-perfect reference. Build component by component with visual comparison. His code is the design spec.

### 2. Data Model Design
**Risk**: The merged data model (Campaign > Asset > Frame > Iteration with baseline tracking) is more complex than either system has today. Getting this wrong creates brittle architecture.
**Mitigation**: Design the data model on paper first. Research persistence options (see [[research-needed]]). Prototype before committing.

### 3. Agent Output Format
**Risk**: Current agent output is complete HTML. Jonathan's UI needs structured, slot-based output for the right sidebar. This is a significant change to how agents produce results.
**Mitigation**: Add a structured metadata layer to agent output rather than changing core generation. Content slot mapping can be a post-processing step.

### 4. Iframe vs Direct DOM Decision
**Risk**: The wrong rendering architecture choice could require significant rework later. Iframes provide isolation but add complexity; direct DOM is simpler but risks conflicts.
**Mitigation**: Research both approaches with a small prototype before committing. See [[research-needed]].

### 5. Scope Management
**Risk**: Full feature parity is ambitious. Without extremely tight planning, this becomes a multi-month project.
**Mitigation**: Plan in extreme detail before any code is written. The agent team needs the full context from this folder loaded before beginning. Break into well-defined implementation chunks even though the target is full parity.

### 6. Canvas MCP Integration
**Risk**: The existing fluid-canvas MCP tools need to work within the new drill-down grid model at the iteration level. The current canvas paradigm (artboard-style) becomes one level of a nested grid.
**Mitigation**: Map the exact integration points. The canvas MCP stays wired up — the iteration grid IS the canvas view. Ensure the MCP tools can operate within this context.

## Research Items

Two items need technical investigation before implementation begins:

1. **Data persistence** — localStorage vs file-based vs SQLite
2. **Iframe vs direct DOM** — template rendering architecture

See [[research-needed]] for full details on both.

## Critical Success Factor

> "We need to have a very detailed conversation with the AI agents and really plan it out so that it's scoped extraordinarily well and we can just make this thing happen without a lot of headache." — Chey

The planning phase is non-negotiable. This merger must be planned in extreme detail before any code is written. The agent team needs this full context ([[INDEX]]) loaded before beginning.

## See Also

- [[merger-strategy]] — High-level decisions
- [[design-decisions]] — All binding decisions from merger planning
- [[research-needed]] — Items needing investigation
- [[agent-enhancements]] — What the agent pipeline needs
- [[feature-comparison]] — Where the systems overlap
