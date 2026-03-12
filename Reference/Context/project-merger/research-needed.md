# Research Needed

Items flagged during merger planning that require technical investigation before implementation.

## 1. Data Persistence Strategy

**Context**: Jonathan uses `localStorage` for everything. Chey's system needs structured iteration tracking with AI-baseline diffs for the learning loop. The merged system needs to support campaigns > assets > frames > iterations with baseline tracking per iteration.

**Question**: What persistence layer should the merged system use?

**Options to investigate**:
- localStorage (simple, limited)
- File-based JSON on disk (agents can read/write, portable)
- SQLite or similar lightweight DB (structured queries, scales better)
- Hybrid approach

**Key constraints**:
- AI agents need to read/write asset data
- Iteration history must store both AI-generated baseline and user-modified state (diff tracking)
- Campaign hierarchy needs to be queryable
- Single user for now, but shouldn't paint into a corner
- Feedback ingestion loop needs to consume iteration diffs

## 2. Iframe/PostMessage vs Direct DOM Rendering

**Context**: Jonathan's editor uses iframes + postMessage to render templates and sync edits. When rebuilding in Chey's stack, should this architecture be preserved or replaced?

**Question**: Should templates render in iframes (sandboxed, postMessage IPC) or directly in the DOM?

**Considerations**:
- Iframes provide CSS/JS isolation (templates can't break the app shell)
- PostMessage adds complexity and latency to every edit
- Direct DOM is simpler but risks style/script conflicts between templates and the app
- html2canvas (used for export) may behave differently in each approach
- The transform/brush overlay system currently sits outside the iframe and maps coordinates — this gets simpler with direct DOM

**Recommendation**: Research both approaches with a small prototype before committing.
