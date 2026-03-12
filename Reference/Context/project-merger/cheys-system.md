# Chey's System — Fluid Design OS

## What It Is

An AI-powered creative operating system that uses Claude CLI (headless) to generate brand-correct marketing assets through an orchestrated pipeline of specialized sub-agents.

## Core Components

### Skill Orchestration
- Library of Claude skills that chain together for asset generation
- Skills call sub-agents with different focuses (copy, layout, styling, spec-check)
- Extensive optimization work done on architecture and agent coordination
- See the main repo's skill definitions for full inventory

### Canvas MCP Integration
- Main viewport where generated assets render
- Connected via fluid-canvas MCP tools (push_asset, read_annotations, read_history, etc.)
- **Stays wired up in the merged product** — becomes the iteration-level view in the drill-down
- Assets appear here after AI generation

### [[iteration-system]]
- Each Frame tracks a full history of iterations
- Only AI generations create new iterations; manual edits modify in-place
- **Baseline diff tracking**: stores AI-generated original vs user-modified state per iteration
- History preserved for the feedback ingestion loop
- Becomes the deepest level of the drill-down: Campaign > Asset > Frame > **Iterations**

### Feedback Ingestion Loop
- Tracks diffs between AI baselines and user modifications
- Identifies patterns: "users consistently change X when the AI generates Y"
- Feeds patterns back into brand rules, templates, and skills
- The system gets smarter over time
- Lives in `feedback/` directory

### Brand Intelligence
- Full brand doc library in `brand/`
- Design tokens, voice rules, layout archetypes
- Weight-based enforcement (1-100 scale)
- Compliance validation tooling in `tools/`

### AI Chat (Left Sidebar)
- Chat-based interface for interacting with the AI
- Can generate entire campaigns from a single prompt
- Can iterate on individual assets/frames
- Independent from the right sidebar — shared data, separate workflows
- AI is always-available collaborator, never required

## UI Status

The UI has NOT been a focus. It's functional but not polished. The app framing concept (header, sidebar, contained layout) is the right structure, but the visual execution needs Jonathan's refinement.

## Tech Stack

Chey's stack is the **target stack for the merged product**. Jonathan's vanilla JS UI gets rebuilt here. This provides the framework, build tools, and runtime that the merged product runs on.

## What Carries Forward (Everything)

All of the above carries forward into the merged product. See [[merger-strategy]].
