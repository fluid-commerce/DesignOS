# UI/UX Decisions for Merged Product

## Layout Structure

```
┌──────────────────────────────────────────────────────┐
│  Header: Logo/Branding + Breadcrumbs    [minimal]    │
├────────┬─────────────────────────┬───────────────────┤
│  Left  │                        │  Right Sidebar     │
│  Side  │   Main Viewport        │  [from Jonathan]   │
│  bar   │                        │                    │
│        │   Drill-down grids:    │  - Content slots   │
│  AI    │   Campaign > Assets    │  - Photo controls  │
│  Chat  │   > Frames > Iters     │  - Brush/transform │
│        │                        │  - Export actions   │
│ [Chey] │   [unified view]       │                    │
│        │                        │  (appears when an  │
│        │                        │   iteration is     │
│        │                        │   selected)        │
├────────┴─────────────────────────┴───────────────────┤
│  Breadcrumbs: Campaign / Asset Name / Frame 3 / v2   │
└──────────────────────────────────────────────────────┘
```

## Header

- **Minimal**: Logo/branding + breadcrumb navigation only
- No campaign selector, no user controls — keep it clean
- Establishes the "web app" feel (from Chey's system)
- Styled with Jonathan's visual polish

## Navigation

- **Breadcrumbs** at top: `Campaign Name / Asset Name / Frame 3 / Iteration 2` — click any level to jump back
- **Back button** for quick one-level-up navigation
- Both always visible during drill-down

## Main Viewport — Drill-Down Grid

The main viewport shows a grid of thumbnails at whatever level the user is at:

| Level | What's Shown | Click Action |
|-------|-------------|--------------|
| Campaigns | Grid of campaign thumbnails | Drill into → Asset grid |
| Assets | Grid of asset thumbnails within selected campaign | Drill into → Frame grid (or Iteration grid if single-frame) |
| Frames | Grid of frame thumbnails within selected asset | Drill into → Iteration grid |
| Iterations | Grid of iteration thumbnails for selected frame | Select → Opens right sidebar editor |

Same visual paradigm at every level. Single-frame assets skip the Frame level and go straight to Iterations.

## Left Sidebar — AI Chat (from Chey)

- Chat-based interface for interacting with AI
- Can generate entire campaigns from a single prompt
- Can iterate on individual assets/frames
- **Independent from the right sidebar** — they don't directly control each other
- **Shared data**: When AI creates a new iteration, that iteration appears in the grid and can be selected to appear in the right sidebar

## Right Sidebar — Content Editor (from Jonathan)

- **Appears when an iteration is selected** from the iteration grid
- Shows content slot fields for the selected iteration (headline, body, CTA, etc.)
- Photo repositioning controls (Fit/Fill + focus point)
- Brush/transform controls (X, Y, rotation, scale — one element per template)
- Export actions (JPG, WebP, HTML)
- For carousels: slide selector buttons at top of sidebar

## Manual Edits vs AI Iterations

- **Manual edits in the sidebar modify the current iteration in-place** — no new iteration created
- **Only AI generations create new iterations**
- **Baseline tracking**: System remembers the original AI-generated state vs. what the user manually changed. This diff is training data for the learning loop.

## Key UX Flows

### Flow 1: AI Generates Full Campaign
1. User types campaign request in left sidebar AI chat
2. Agent pipeline generates campaign with multiple assets and frames
3. User lands in **campaign asset grid** — sees all generated assets as thumbnails
4. Drill into any asset → frames → iterations → edit in right sidebar

### Flow 2: AI Generates Single Asset
1. User types asset request in AI chat
2. Agent generates asset → appears as iteration in the grid
3. User selects iteration → right sidebar opens for manual tweaks
4. Can request more iterations via AI chat

### Flow 3: Manual from Template
1. User browses template library / picks asset type via GUI
2. Template opens as first iteration
3. User edits content slots in right sidebar
4. Can invoke AI from left sidebar to enhance/iterate at any point

### Flow 4: Mixed / Collaborative
1. AI generates a campaign
2. User manually adds more assets to the campaign
3. User manually tweaks some AI-generated iterations
4. User asks AI to regenerate specific frames
5. Any combination — AI is always available, never required

### Flow 5: Carousel Editing
1. User drills down to a carousel asset → sees frames (slides) in grid
2. Clicks a frame → sees iterations for that frame
3. Selects an iteration → right sidebar shows that slide's controls
4. Slide selector in sidebar to switch between frames without drilling back up

## Resolved Questions

- **Template library + brand intelligence**: Templates are curated and hand-built. Jonathan's 8 templates are source of truth for social media. Brand intelligence applies to AI-generated content, not to template validation.
- **Element drag/selection**: Works via the brush/transform system (one movable element per template). Same behavior whether asset is AI-generated or template-based.
- **Campaign manager location**: Top level of the drill-down grid in the main viewport. Campaigns are the root level.
