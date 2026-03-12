# Jonathan's System — Content Creation Tool

## What It Is

A polished content creation tool with a template-driven workflow, direct content editing, and multi-asset campaign management. Similar goals to Fluid Design OS but built independently, focused on the UI/editing experience rather than AI orchestration.

## Tech Stack

- **Framework**: Vanilla JavaScript (no frameworks — pure DOM manipulation)
- **Rendering**: HTML5 + CSS3, iframe-based template rendering with postMessage IPC
- **Storage**: Browser `localStorage` (JSON array keyed as `neumi_creations`)
- **Export**: html2canvas for image capture (JPG/WebP), raw HTML for code download
- **Dependencies**: Minimal — `@fluid-commerce/dam-picker` for DAM integration, jszip for compression
- **Server**: Simple HTTP via `npx serve` on port 4200
- **CSS**: Custom properties, absolute positioning, CSS transforms — no frameworks or preprocessors
- **Fonts**: FLFont, Inter, NeueHaas (custom loaded)

**Note**: This stack is NOT preserved in the merger. The UI is rebuilt in Chey's stack, but the design patterns and interactions are faithfully reproduced.

## Core Components

### Template Library (`index.html`)
- 8 curated HTML templates displayed in a gallery grid
- Live preview via scaled-down iframes
- Template specs (dimensions, field counts) shown per card
- "Create New Asset" links to editor with template ID as query param
- **These are the source of truth for social media templates in the merged product**

### Templates (8 total)

**Single-frame templates (6):**
| ID | Name | Dimensions | Fields |
|----|------|-----------|--------|
| t1-quote | Client Testimonial / Quote | 1080×1080 | name, title, portrait |
| t2-app-highlight | App Feature Highlight | 1080×1080 | varies |
| t3-partner-alert | Partner Alert | 1340×630 | varies |
| t4-fluid-ad | Instagram Ad | 1080×1080 | features list |
| t5-partner-announcement | Partner Announcement | 1340×630 | varies |
| t6-employee-spotlight | Employee Spotlight | 1080×1080 | name, title, photo |

**Carousel templates (2):**
| ID | Name | Dimensions | Slides |
|----|------|-----------|--------|
| t7-carousel | Employee Insights | 1080×1080 | 4 slides |
| t8-quarterly-stats | Quarterly Stats | 1080×1080 | 4 slides |

### Template Configuration Format
Each template defined as a JS config object:
```javascript
TEMPLATES['t1-quote'] = {
  name: 'Client Testimonial / Quote',
  file: 'templates/t1-quote.html',
  w: 1080, h: 1080,
  fields: [
    { type: 'text',  sel: '.name',      label: 'Name',     mode: 'pre', rows: 2 },
    { type: 'text',  sel: '.title',     label: 'Title',    mode: 'pre', rows: 2 },
    { type: 'image', sel: '.photo img', label: 'Portrait', dims: '353 × 439px' }
  ],
  brush: null  // CSS selector for movable element (optional)
}
```

**Field types**: `text` (modes: `pre`, `text`, `br`), `image` (Fit/Fill + focus), `divider` (carousel section separators)

### Editor (`editor.html` + `editor.js`)
- **Iframe-based preview**: Template renders in sandboxed `<iframe>`
- **PostMessage IPC**: Parent sends JSON messages to update template DOM; no direct DOM access
- **Dynamic sidebar**: Built from template's `fields` array
- **Live sync**: Every keystroke sends postMessage update to iframe
- **Scale-aware**: Iframe visually scaled via CSS transform to fit viewport

### Right Sidebar — Content Slot Fields
- **Text fields**: Textareas or single-line inputs, live-synced to iframe
- **Image fields**: Thumbnail preview (72px), upload button, Fit/Fill toggle, focus point drag
- **Slide selector** (carousels): Grid of numbered buttons, shows/hides field groups per slide
- **Brush controls**: X, Y, rotation, scaleW, scaleH number inputs

### Photo Repositioning
- **Fit mode** (`object-fit: contain`): Image scales to fit, letterboxed
- **Fill mode** (`object-fit: cover`): Image crops to fill, user drags focus point
- Focus point stored as percentage (0-100 for X and Y)
- Thumbnail mirrors the same `object-fit` and `object-position` CSS
- PostMessage sends `{ action: 'imgStyle', objectFit, objectPosition }`

### Brush/Transform System
- **One movable element per template** (identified by `brush` selector in config)
- **SVG overlay** in parent window maps to iframe coordinate space
- **Handles**: Corner squares (scale), rotation circle (40px above top edge), dashed bounding box
- **Drag modes**: move (left/top), rotate (atan2 from center), scale (corner handles, rotation-aware)
- **Sidebar sync**: Input fields show real-time values, typing updates element directly
- **State**: Parsed from computed style matrix (`vals[0], vals[1]` → rotation, scaleX, scaleY)

### Campaign & Carousel Structure
- **Campaigns**: Implicit — not stored as a data structure. Users organize related assets by theme/purpose.
- **Carousels**: Multi-slide assets. Slides toggled via CSS `display`. Template defines `carousel: 4` and uses `divider` fields to separate slide sections.
- **Per-slide controls**: Each slide has its own text fields, image fields, and brush if applicable
- **Navigation**: nav.js injects prev/next buttons, page indicator, keyboard arrow support

### Data Model
```javascript
// Creation record (stored in localStorage['neumi_creations'])
{
  id: Date.now(),
  createdAt: Date.now(),
  skill: 'edited',
  base: 'template-id',        // which template
  brief: 'Human-readable name',
  html: 'full HTML string',   // serialized iframe DOM
  thumbnail: 'data:image/jpeg;base64,...'  // 270px thumbnail
}
```

### Navigation / Routing
- `index.html` — Template gallery (port 4200)
- `editor.html?t=template-id` — New asset from template
- `editor.html?c=creation-id` — Edit existing asset
- `templates/*.html` — Standalone template preview with nav.js controls
- Arrow keys, escape key for navigation between templates

## UI Status

Polished, refined visual design. Looks professional and production-ready. However, currently reads more like a standalone web page than a contained web app (missing app-level framing like header/navigation).

## What Carries Forward

- All UI design patterns and visual language (rebuilt in Chey's stack)
- Template library (8 templates = social media source of truth)
- Right sidebar content slot editing UX
- Photo repositioning UX (Fit/Fill + focus point)
- Brush/transform interaction model (one element per template)
- Carousel multi-frame editing UX
- Export capabilities (JPG, WebP, HTML)

## What Does NOT Carry Forward

- Vanilla JS / iframe / postMessage architecture (rebuilt in Chey's stack)
- localStorage persistence (replaced — see [[research-needed]])
- Lane Fluid Sandbox folder (duplicate reference material, ignored)

See [[merger-strategy]] for how this integrates with Chey's system.
