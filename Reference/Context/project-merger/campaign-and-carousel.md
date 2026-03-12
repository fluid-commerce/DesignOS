# Campaign & Carousel System

## Origin

Built by Jonathan. Campaign feature implemented at Felipe's request during a team meeting.

## Data Hierarchy

```
Campaign
├── Asset 1 (e.g., Instagram post — single frame)
│   └── Frame 1
│       ├── Iteration 1 (AI-generated)
│       ├── Iteration 2 (AI-generated)
│       └── Iteration 3 (AI-generated, user-modified)
├── Asset 2 (e.g., Carousel post — multiple frames)
│   ├── Frame 1 (slide 1)
│   │   ├── Iteration 1
│   │   └── Iteration 2
│   ├── Frame 2 (slide 2)
│   │   └── Iteration 1
│   ├── Frame 3 (slide 3)
│   │   ├── Iteration 1
│   │   └── Iteration 2
│   └── Frame 4 (slide 4)
│       └── Iteration 1
├── Asset 3 (e.g., LinkedIn banner — single frame)
│   └── Frame 1
│       └── Iteration 1
└── ...more assets
```

**Terminology**: Sub-items within an asset are called **Frames** (like individual slides of a carousel, or a single image for non-carousel assets). Each Frame has its own independent iteration history. The name "Frames" may vary by asset type in the future, but that's out of scope for the merger.

## Campaigns

- A campaign is a **container for multiple related assets**
- Assets within a campaign share a thematic connection (same product launch, same event, etc.)
- **AI can generate entire campaigns from a single prompt** — creates multiple assets with frames
- Users can also build campaigns manually, or mix AI + manual
- After AI generates a campaign, user lands directly in the **campaign asset grid** — no wizard or review screen

## Frames

- A Frame is a **single visual unit within an asset**
- For carousel posts: each slide is a Frame
- For single-image posts: the asset has one Frame
- Each Frame has:
  - Its own content slot fields (headline, body, CTA, etc.)
  - Photo repositioning controls
  - Brush/transform controls (if applicable)
  - **Its own independent iteration history**
- Single-frame assets skip the Frame grid level in the drill-down and go straight to iterations

## Drill-Down Navigation

```
Campaign Grid                    ← grid of asset thumbnails
  └── click asset
       ↓
Asset: Frame Grid                ← grid of frame thumbnails (skipped for single-frame assets)
  └── click frame
       ↓
Frame: Iteration Grid            ← grid of iteration thumbnails
  └── select iteration
       ↓
Right Sidebar Editor             ← content slots for selected iteration
```

Breadcrumbs: `Campaign Name / Asset Name / Frame 3 / Iteration 2`
Back button for one-level-up navigation.

**Campaign grid view**: Grid/gallery of asset thumbnails. **FLAG**: Revisit this decision when Jonathan's codebase is fully analyzed by an agent — may need adjustment based on his existing patterns.

## Controls at Each Level

| Level | View | Actions |
|-------|------|---------|
| Campaign | Asset thumbnail grid | Drill into asset, add assets (manual or AI) |
| Asset | Frame thumbnail grid | Drill into frame |
| Frame | Iteration thumbnail grid | Select iteration for editing |
| Iteration (selected) | Right sidebar editor | Edit content slots, reframe photos, move brush, export |

## Carousel Specifics

In Jonathan's implementation:
- Carousel templates define `carousel: N` (number of slides/frames)
- Slides are `<div class="slide" data-slide="N">` toggled via CSS display
- Each slide has its own field definitions separated by `divider` type fields
- nav.js provides prev/next, page indicator, keyboard navigation
- Brush element can have per-slide transforms

In the merged product:
- Each carousel slide = a Frame with its own iteration history
- Slide selector in the right sidebar for quick frame switching without drilling back up
- All carousel editing UX from Jonathan's system is preserved

## AI Generation

- **Full campaign generation**: AI creates campaign with multiple assets and frames in one prompt
- **Single asset generation**: AI creates or iterates on individual assets/frames
- **Campaign-aware agents**: Skills need to understand campaign context — visual consistency, messaging arc, brand coherence across assets
- **Carousel-aware agents**: Skills need to generate multi-frame carousels with slide-to-slide flow (hook → develop → CTA)

## Integration with Chey's System

1. **Iteration system**: Each Frame has independent iterations with baseline diff tracking — see [[iteration-system]]
2. **Feedback loop**: Diffs between AI baselines and user modifications at the Frame/iteration level feed the learning loop
3. **Canvas MCP**: Stays wired up at the iteration grid level
4. **Brand compliance**: Should validate across all assets in a campaign for consistency

## See Also

- [[design-decisions]] — Hierarchy and terminology decisions
- [[iteration-system]] — How iterations work within Frames
- [[agent-enhancements]] — What agents need to support campaigns and carousels
- [[ui-ux-decisions]] — Full drill-down UX specification
