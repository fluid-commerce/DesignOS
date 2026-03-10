# Project Vision & Design Decisions

Captured from Chey's brain dump and conversation on 2026-03-10. This is the founding context for the Fluid Creative OS project.

---

## The Problem

The Fluid marketing team (Chey, Felipe, AJ, Lane, Jonathan) is producing marketing assets with AI agents, but hitting friction:

- **Context overload**: Single Cursor agents get bogged down when loaded with all documentation at once (Gold Standard workflow + schema rules + theme system + brand guidelines). Too much context, inconsistent results.
- **No systematic iteration loop**: Generate something, give feedback, regenerate — but nothing captures the trajectory from first prompt to final output. Learnings evaporate between sessions.
- **Inconsistent brand compliance**: Without strict specs and validation, outputs vary in quality. Some look great, some miss the mark. No automated way to check against brand rules.
- **Fragmented tools**: Marketing skills, design skills, video tools, deck tools all exist separately. No unified system that knows "this is Fluid, here's how we do things."

## The Vision

A single proprietary skill system — "Fluid Creative OS" — that lets any agent (Claude Code or Cursor) produce brand-correct marketing assets that are close-to-final from the first prompt. The system gets better over time through structured iteration and feedback ingestion.

## Architecture (Four Layers)

### 1. Brand Intelligence Layer
Modular `.md` files containing specs, design tokens, copy voice rules, and examples. Wiki-linked so agents only grab what they need for the specific work they're doing.

**Key insight from Chey**: "I think if we're a little smarter about dividing that up into a bunch of MD files and then having each specialist subagent just pull in bits that it needs for the specific work it's doing, I think it'll work a lot better."

The brand direction is iterative — not fixed. The system needs to be nimble and adapt as the brand evolves. Elements come from multiple sources:
- wecommerce.com (current site)
- The deck system (Fluid Payments Marketing Deck)
- The fluid-website-build-prompt.md (newer editorial direction)
- Social post iterations (ongoing refinement)

### 2. Asset Skills Layer
One orchestrating skill per asset type. Each spawns specialized subagents with fresh context windows focused on one concern:

- **Copy agent** — only deals with copy, loads brand voice + messaging docs
- **Layout agent** — deals with structure and spatial arrangement
- **Styling/Design agent** — handles visual implementation against design tokens
- **Spec-check agent** — validates output against brand rules, returns issues
- **Fix agents** — receive spec-check results and make corrections

This GSD-inspired pattern (plan → review plan → revise → execute → verify) should produce great results from first prompt.

### 3. Canvas / Iteration Tool
A React app + MCP server for iterative design refinement:

- Generate an asset (e.g., social post)
- View it in a canvas
- Give feedback, generate new variation(s) next to the original
- Choose the best one, iterate on that one
- Canvas documents the entire trajectory: initial prompt result → each iteration → designer annotations → final "ready to ship"
- All of that context (progression, feedback, preferences) gets ingested into the system so future first prompts get closer to final

**Chey's words**: "I think it's OK if this tool is pretty simple overall — it's for internal use for now. It just needs to facilitate this kind of iterative documentation and later ingestion."

### 4. Distribution Layer
Git repo, installable, updatable. But this comes later — first priority is getting the system working well internally.

## Asset Types (Priority Order)

1. **Website sections** (.liquid files) — Gold Standard compliant, for the Fluid marketing site
2. **Social posts** (HTML/CSS) — Instagram 1080x1080, LinkedIn 1200x627 (and 1340x630)
3. **One-pagers** (HTML/CSS) — sales collateral, feature sheets
4. **Slide decks** (Slidev) — marketing presentations (existing system in Fluid Payments deck)
5. **Videos** (Remotion) — short-form vertical video (existing system started)

## Key Design Decisions

### Skills vs. Hooks
Deterministic operations should be hooks/shell scripts. Generative/judgment-based work stays in skills.

Likely hooks:
- Template scaffolding (copy Gold Standard template)
- Schema validation (check option counts, required fields)
- Brand compliance checks (color values, font usage)
- Asset dimension validation

Likely skills (generative):
- Copy writing with brand voice
- Layout decisions
- Visual design choices
- Iteration feedback interpretation

### Ingest, Don't Import
Don't use existing marketing skills as-is. Ingest their knowledge into Fluid-specific skills. "Our skill system has what that has, but it's kind of specifically geared toward what we are specifically doing at Fluid."

### Meta-Skills for System Development
Skills specifically for developing the system itself:
- Generate variations and give feedback on all of them
- Document learnings from iteration sessions
- Ingest documentation into the overall system
- "Continuous training of the skill system where they just get better and better kind of easily in a streamlined way over time"

### Template Library as 5-Star References
Templates should be considered as ideal references, not strict constraints. "I'd like to strike a balance where the agent doesn't always HAVE to follow a template to the letter but a templates library should always be considered as 5-star references of what makes a good, branded asset."

### Visual Documentation (Brand Pattern Library)
Build a single repository of brand building blocks — an HTML page showing every pattern rendered at different sizes with explanations:
- "Here's THE pattern of how text is supposed to be circled or underlined at different font sizes"
- "Here's a valid example of tilted FLFont Bold with a circle around it, and here's an explanation of where and why that's used"

Jonathan's template library format (live preview + spec table + creation instructions) should be the standard for ALL examples and templates across the system.

### Research Items
- **Claude Skills 2.0** — investigate latest Claude skill capabilities and patterns
- **Superpowers skill system** — investigate and potentially incorporate learnings
- Both should inform how we build the system

## Existing Work to Build On

### From Lane Fluid Sandbox
- **111 existing .liquid sections** — not all Gold Standard, but show folder structure patterns
- **Gold Standard workflow** — solid content, needs decomposition into smaller focused .md files
- **Social post design guide** — first iteration of documented brand preferences for social
- **Generated social posts** — 28+ HTML files showing iteration (01, 01a, 01b variants)
- **Live Editor one-pager** — first one-pager attempt, strong reference
- **Brand assets** — 7 brushstrokes, 2 circle sketches, 3 We-Commerce logos, 1 frame mark
- **fluid-website-build-prompt.md** — detailed page-by-page copy and design direction

### From Jonathan's Preview Work
- **Template library** — 3 HTML templates with live preview + spec documentation format
- **Template PNGs** — rendered reference images of templates
- Demonstrates the visual + technical spec format that should be standard everywhere

### From Existing Skills Systems
- **46 marketing skills** — context cascade pattern, framework-over-templates approach
- **UI/UX Pro Max** — 67 styles, 96 palettes, searchable design intelligence
- **GSD** — subagent orchestration, state management, verification patterns
- **Fluid Payments Deck** — 32 Slidev layouts, Three.js, GSAP, design tokens, film grain
- **Remotion** — recipe-driven video, auto-transcription, face detection, word-level captions

### Brand Colors (Current Palette)
| Color | Hex | Usage |
|-------|-----|-------|
| Blue | `#42b1ff` | Primary accent, trust, technical |
| Green | `#44b574` | Success, solution, proof |
| Orange | `#FF8B58` | Urgency, pain, warning |
| Purple | `#c985e5` | Premium, financial, analytical |
| Black | `#000000` | Background (social), `#191919` (web) |
| White | `#ffffff` | Primary text |
| Cream | `#f5f3ef` | Neutral light (web) |

### Typography
- **NeueHaasDisplay** — Black (900), Bold (700), Medium (500), Light (300) — primary display and body
- **FLFont** (flfontbold) — handwritten accent font, used for eyebrows, taglines, tilted labels

## Team Context
- **Chey** — leading the system architecture and skill design
- **Felipe** — design and asset iteration
- **AJ** — contributing to design sessions
- **Lane** — .liquid/theme development (Gold Standard workflow)
- **Jonathan** — Figma-to-HTML templates, brand asset organization

---

*Captured: 2026-03-10 during project initialization*
