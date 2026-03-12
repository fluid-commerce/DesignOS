# Iteration System

## Origin

Built by Chey as part of Fluid Design OS. This is one of the most important architectural pieces to preserve in the merger.

## How It Works

1. **Iterations live at the Frame level** — Each Frame within an Asset has its own independent revision history
2. **Only AI generations create new iterations** — When the AI produces a new version, that's a new iteration
3. **Manual edits modify in-place** — When a user tweaks content in the right sidebar, it modifies the current iteration, not a new one
4. **Baseline tracking** — Every iteration stores both the AI-generated original AND the user-modified state. This diff is critical training data.
5. **History is preserved permanently** — Not undo/redo; it's a full versioned timeline per Frame

## The Drill-Down Context

Iterations are the deepest level of the navigation hierarchy:

```
Campaign (grid) → Asset (grid) → Frames (grid) → Iterations (grid)
                                                        ↓
                                              Select iteration
                                                        ↓
                                              Right sidebar opens
                                              with that iteration's
                                              content slots
```

Chey's existing iteration view (artboard-style in the main viewport) becomes this iteration grid level. The canvas MCP integration stays wired up here.

## Baseline Diff Tracking (Learning Loop)

Each iteration stores two states:

```
Iteration N
├── ai_baseline: { ... }     ← What the AI originally generated
├── user_modified: { ... }   ← What the user changed it to (in-place edits)
├── source: "ai"             ← Who created this iteration
├── timestamp: ...
└── diff: { ... }            ← Computed: what changed between baseline and modified
```

**Purpose**: The diff between `ai_baseline` and `user_modified` tells the learning loop: "Here's what the AI produced vs. what the user actually wanted." Over time, this data feeds back into brand rules, templates, and agent skills so the system generates better first-pass results.

- If a user never touches an iteration, `ai_baseline === user_modified` (no diff)
- If a user tweaks copy, repositions a photo, etc., the diff captures exactly what they changed
- This is the fuel for the feedback ingestion system

## Integration with Jonathan's UI

When a user selects an iteration from the grid:

1. The right sidebar populates with that iteration's content slot fields
2. Text fields show current values (user-modified state if edits were made)
3. Image fields show current photos with Fit/Fill and focus point
4. Brush/transform controls show current position/rotation/scale
5. Any edits here update `user_modified` while `ai_baseline` stays frozen

### Iteration Grid View

```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ v1  │ │ v2  │ │ v3  │ │ v4  │ │ v5  │
│     │ │     │ │     │ │ ★   │ │     │
│     │ │     │ │     │ │     │ │     │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
                         ↑ selected — right sidebar shows this iteration
```

## Technical Considerations

- Iteration data structure must accommodate both AI-generated and manually-started iterations (from templates)
- For template-started assets: iteration 1's `ai_baseline` could be the raw template state, and `user_modified` tracks manual changes
- Campaign-level iteration history: **not applicable** — iterations are strictly per-Frame
- The persistence layer for iteration data is a [[research-needed]] item

## See Also

- [[cheys-system]] — Where this was built
- [[design-decisions]] — Manual edits vs iteration creation decision
- [[ui-ux-decisions]] — How it fits the merged UI
- [[campaign-and-carousel]] — How Frames contain iterations
