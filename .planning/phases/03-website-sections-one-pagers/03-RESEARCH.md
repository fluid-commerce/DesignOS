# Phase 3: Website Sections + One-Pagers - Research

**Researched:** 2026-03-10
**Domain:** Shopify-like .liquid section generation + print-ready HTML one-pager generation
**Confidence:** HIGH

## Summary

Phase 3 extends the proven 4-agent orchestrator pipeline (copy, layout, styling, spec-check) from social posts to two new asset types: Gold Standard .liquid website sections and print-ready one-pager sales collateral. The core challenge is twofold: (1) the .liquid section schema system requires extreme precision -- every text element needs exactly 6 settings with specific option counts (13 font sizes, 13 colors, 5 weights), every button needs exactly 7 settings, and zero hard-coded values are permitted; and (2) the existing 111 sections in the Fluid codebase are NOT Gold Standard compliant (confirmed by inspecting the actual `features_grid` section which has only 5 font sizes and 8 colors), so templates must be built from scratch using the Gold Standard workflow document as the sole source of truth.

The one-pager track is more straightforward -- self-contained HTML/CSS at letter size (8.5x11") with `@page` rules for clean PDF export. The existing `live-editor-one-pager.html` reference provides a proven content/style starting point, and 4 Figma community layouts provide structural variety.

**Primary recommendation:** Split this phase into research-first waves -- empirical investigation of the Fluid backend/frontend pipeline first, Gold Standard doc decomposition second, then hero section proof-of-concept with manual editor validation, then scale to remaining section types and one-pagers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Mode-aware agents: same 4 agent files (copy, layout, styling, spec-check) detect mode (social/section/one-pager) and load different brand docs and rules per mode
- Orchestrator passes mode explicitly to agents (e.g., mode=section, platform=shopify) -- agents do not auto-detect from file type
- Two new slash commands: `/fluid-theme-section` and `/fluid-one-pager`
- `/fluid-theme-page` and `/fluid-theme` are deferred to a future phase
- Session-based working directory pattern (.fluid/working/{sessionId}/ with lineage.json) carries forward from Phase 2
- Gold Standard workflow doc is split (NOT rewritten) into role-mapped files under `docs/fluid-themes-gold-standard/` -- preserve exact original wording, just decompose
- Split by agent role: schema-rules.md (layout agent), button-system.md (styling agent), validation-checklist.md (spec-check agent), theme-tokens.md (styling agent), etc.
- Weight hierarchy: Gold Standard doc = 100, empirical data from Fluid repos = 100, Lane/AJ baseline-controls = ~50, existing website-section-specs.md = reworkable
- Lane's 111 existing .liquid sections are NOT references -- their schemas are broken
- Research agents query Fluid backend (/Users/cheyrasmussen/fluid) and frontend (/Users/cheyrasmussen/fluid-mono) repos empirically
- scaffold.cjs update deferred until after research
- Research produces persistent summary doc (docs/fluid-themes-gold-standard/EMPIRICAL-FINDINGS.md)
- Comprehensive 10+ section types built from scratch as templates
- Build one hero section first as proof-of-concept, validate in editor via `fluid theme push`, then scale
- Templates go in `templates/sections/` (parallel to `templates/social/`)
- One-pager: same 4-agent pipeline with mode=one-pager
- Full range: product feature, partner/integration, company overview, case study, comparison sheet (5+ templates)
- Letter size (8.5x11") with @page CSS rules, "Print to PDF" from browser
- Use existing live-editor-one-pager.html as content/style starting point
- 4 Figma Community one-pagers for LAYOUT reference only (not content or style)

### Claude's Discretion
- Exact decomposition boundaries within the Gold Standard doc
- How to structure the proof-of-concept validation workflow
- Which 10+ specific section types to include
- Technical approach for mode-aware agent switching (flag-based branching vs separate instruction blocks)

### Deferred Ideas (OUT OF SCOPE)
- `/fluid-theme-page` -- orchestrates multiple sections into a single page
- `/fluid-theme` -- full theme planning across multiple pages
- Lane/AJ's baseline-controls may eventually supersede parts of the Gold Standard -- not in this build
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SITE-01 | Website section skill generates valid .liquid files with proper schema structure | Empirical findings on schema rendering pipeline + Gold Standard schema snippets + scaffold.cjs tool |
| SITE-02 | Gold Standard documentation decomposed into focused .md files | Gold Standard workflow doc analysis + agent-role mapping from Phase 2 |
| SITE-03 | Every text element has 6 settings (family, size mobile, size desktop, weight, color, content) | Gold Standard requirements + rules.json validation + confirmed by features_grid gap analysis |
| SITE-04 | Every button has 7 settings (show, text, url, style, color, size, weight) | Gold Standard button system + btn utility class pattern |
| SITE-05 | Section and container settings complete (background, padding, border radius) | Gold Standard 5 section + 7 container settings confirmed in rules.json |
| SITE-06 | No hard-coded colors, spacing, or border radius -- all use CSS variables/utility classes | Utility class system from fluid repo + var(--clr-*), var(--space-*), var(--radius-*) patterns |
| SITE-07 | Generated sections pass Gold Standard validation checklist | schema-validation.cjs + validation checklist from Gold Standard doc |
| PAGE-01 | One-pager skill generates sales collateral as self-contained HTML/CSS | live-editor-one-pager.html as proven pattern + @page CSS rules |
| PAGE-02 | One-pagers use Fluid brand elements (brushstrokes, side labels, FLFont taglines) | Brand elements documented in design-tokens.md + patterns/index.html |
| PAGE-03 | One-pagers are print-ready (letter size, proper margins, @page rules) | @page CSS confirmed in live-editor-one-pager.html reference |
| TMPL-03 | One-pager templates with content slot specs | 4 layout reference images analyzed + live-editor-one-pager.html structure mapped |
| TMPL-04 | Templates include per-element FIXED/FLEXIBLE/OPTIONAL annotations | Jonathan's format established in Phase 2 social templates |
</phase_requirements>

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Node.js built-ins | Current | CLI tools (schema-validation, scaffold, brand-compliance) | Zero-dependency tools established in Phase 1 |
| Liquid templating | Fluid's Ruby impl | .liquid section templates | Fluid's theme engine -- `LiquidTags::SchemaTag` parses JSON schema blocks |
| CSS utility classes | Fluid's system | Styling via `text-*`, `bg-*`, `font-*`, `py-*`, `rounded-*` | Theme variable system, no hard-coded values |
| @page CSS | CSS3 | One-pager print layout | Browser-native print-to-PDF, no external dependencies |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `tools/schema-validation.cjs` | Validate .liquid schema completeness | Every section after generation -- checks 13 font sizes, 13 colors, 5 weights |
| `tools/brand-compliance.cjs` | Validate brand token usage | Every output file -- checks hex colors, font families, spacing |
| `tools/scaffold.cjs` | Generate Gold Standard .liquid skeleton | Starting point for each new section type |
| `tools/dimension-check.cjs` | Check output dimensions | One-pager dimension validation |
| `fluid theme push` | Push to dev theme for editor validation | Hero proof-of-concept and manual validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS @page print | Puppeteer/wkhtmltopdf | Over-engineering -- browser print-to-PDF is sufficient and has zero dependencies |
| Mode-aware agents | Separate agent files per mode | Would triple the agent count (12 instead of 4) -- branching within agents is cleaner |
| Gold Standard template from scratch | Copying existing sections | Lane explicitly said existing sections are broken -- must build from Gold Standard spec |

## Architecture Patterns

### Recommended Project Structure
```
templates/
  sections/           # NEW: .liquid section templates (parallel to social/)
    index.html        # NEW: Template gallery (like templates/social/index.html)
    hero.liquid       # NEW: Proof-of-concept section
    features-grid.liquid
    testimonials.liquid
    ... (10+ types)
  social/             # EXISTING: Social post templates
    index.html
    ...
docs/
  fluid-themes-gold-standard/  # NEW: Decomposed Gold Standard docs
    schema-rules.md            # Layout agent context
    button-system.md           # Styling agent context
    validation-checklist.md    # Spec-check agent context
    theme-tokens.md            # Styling agent context
    template-patterns.md       # Layout agent context
    EMPIRICAL-FINDINGS.md      # Research output from codebase investigation
templates/
  one-pagers/         # NEW: One-pager templates
    index.html        # Template gallery
    product-feature.html
    partner-integration.html
    company-overview.html
    case-study.html
    comparison-sheet.html
.claude/
  skills/
    fluid-theme-section/   # NEW: Orchestrator for sections
      SKILL.md
    fluid-one-pager/       # NEW: Orchestrator for one-pagers
      SKILL.md
  agents/
    copy-agent.md          # MODIFIED: Add mode=section and mode=one-pager branches
    layout-agent.md        # MODIFIED: Add mode=section and mode=one-pager branches
    styling-agent.md       # MODIFIED: Add mode=section and mode=one-pager branches
    spec-check-agent.md    # MODIFIED: Add mode=section and mode=one-pager branches
```

### Pattern 1: Mode-Aware Agent Architecture
**What:** Each of the 4 existing agents gains mode-based branching to handle social, section, and one-pager output types.
**When to use:** Every agent invocation in this phase.
**Example:**
```markdown
# In agent CONTRACT section:
INPUTS:
  - Mode: social | section | one-pager (via delegation message)
  - Platform: instagram | linkedin | shopify (mode-dependent)
  ...

# In agent Step 1: Load Brand Context
## Mode: section
1. `brand/website-section-specs.md` (updated after Gold Standard research)
2. `docs/fluid-themes-gold-standard/schema-rules.md` (NEW)
3. `docs/fluid-themes-gold-standard/theme-tokens.md` (NEW)

## Mode: one-pager
1. `brand/voice-rules.md` (same as social)
2. `brand/design-tokens.md` (same font/color system)
3. `templates/one-pagers/<template-name>.html` (when template specified)
```

### Pattern 2: Gold Standard Schema Generation
**What:** Every text element in a .liquid section schema requires exactly 6 settings with precise option counts.
**When to use:** Every section template.
**Example (from Gold Standard Workflow, verified against rules.json):**
```json
{
  "type": "select",
  "id": "heading_font_size",
  "label": "Heading Font Size (Mobile)",
  "options": [
    { "value": "text-xs", "label": "XS" },
    { "value": "text-sm", "label": "SM" },
    { "value": "text-base", "label": "Base" },
    { "value": "text-lg", "label": "LG" },
    { "value": "text-xl", "label": "XL" },
    { "value": "text-2xl", "label": "2XL" },
    { "value": "text-3xl", "label": "3XL" },
    { "value": "text-4xl", "label": "4XL" },
    { "value": "text-5xl", "label": "5XL" },
    { "value": "text-6xl", "label": "6XL" },
    { "value": "text-7xl", "label": "7XL" },
    { "value": "text-8xl", "label": "8XL" },
    { "value": "text-9xl", "label": "9XL" }
  ],
  "default": "text-3xl"
}
```

### Pattern 3: Button Utility Class System
**What:** Buttons use the `btn btn-{style}-{color} {size} {weight}` class pattern. Never custom styles.
**When to use:** Every button in every section.
**Example (from Gold Standard Workflow):**
```liquid
{% if section.settings.show_button %}
<a href="{{ section.settings.button_url | default: '#' }}"
   class="btn btn-{{ section.settings.button_style | default: 'filled' }}-{{ section.settings.button_color | default: 'primary' }} {{ section.settings.button_size | default: 'btn-md' }} {{ section.settings.button_font_weight | default: 'font-medium' }} {{ settings.button_border_radius | default: 'rounded' }}">
  {{ section.settings.button_text | default: 'Click Here' }}
</a>
{% endif %}
```

### Pattern 4: One-Pager Print Layout
**What:** Letter-size self-contained HTML with @page CSS rules for clean PDF export.
**When to use:** Every one-pager template.
**Example (verified from live-editor-one-pager.html):**
```css
@page { size: letter; margin: 0; }

.page {
  width: 8.5in;
  min-height: 11in;
  margin: 0 auto;
  padding: 0.45in 0.55in 0.35in;
  background: var(--black);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
```

### Pattern 5: `block.fluid_attributes` for Editor Integration
**What:** Every block element MUST include `{{ block.fluid_attributes }}` so the Fluid page editor can select, reorder, and configure blocks.
**When to use:** Every block in every section template.
**How it works (from codebase investigation):**
- `ApplicationThemeTemplate#build_fluid_attributes` generates `data-fluid-*` attributes
- Attributes include: `data-fluid-section-block-id`, `data-fluid-parent-section-type`, `data-fluid-section-id`, `data-fluid-section-block-type`, `data-fluid-block-attribute`
- Only rendered in editor mode (`RequestStore.store[:editor_mode]`)
- The `Renderer.populate_data_attrs` method adds `data-fluid-element` to all HTML tags for element targeting

### Anti-Patterns to Avoid
- **Copying existing Fluid sections as reference:** Lane explicitly said the 111 existing sections are broken. The `features_grid` section was inspected and has only 5 font sizes (should be 13), 8 colors (should be 13), and missing font weights. Build from Gold Standard spec ONLY.
- **Hard-coding any values:** No hex colors, no pixel spacing, no border radius values in templates. All must use utility classes or CSS variables.
- **Incomplete font size lists:** The most common mistake in existing sections. Must always be exactly 13 options (text-xs through text-9xl).
- **Mixing social and website font families:** Social uses NeueHaasDisplay + FLFont. Website uses Syne + DM Sans + Space Mono. Do not cross-pollinate (Weight 85 rule in rules.json).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema generation | Custom schema JSON by hand | `tools/scaffold.cjs` + rules.json snippets | 6 settings per text element, 7 per button, exact option counts -- too error-prone by hand |
| Schema validation | Manual checklist review | `node tools/schema-validation.cjs <file>` | Deterministic checks for exact option counts, catches missing sizes/colors/weights |
| Brand compliance | Eyeball inspection | `node tools/brand-compliance.cjs <file>` | Catches hard-coded hex, wrong font families, spacing violations |
| Print CSS | Complex PDF generation | `@page { size: letter; margin: 0; }` | Browser-native, zero dependencies, proven in live-editor-one-pager.html |
| Block identity | Custom data attributes | `{{ block.fluid_attributes }}` | Fluid backend generates correct data-fluid-* attributes automatically |

**Key insight:** The Gold Standard schema is extremely precise and repetitive. The scaffold tool and validation tool exist precisely to prevent the most common error (incomplete option lists). Always generate schema from scaffold, never from scratch.

## Common Pitfalls

### Pitfall 1: Incomplete Font Size Options
**What goes wrong:** Generating sections with 5-8 font size options instead of exactly 13.
**Why it happens:** It's natural to offer only "relevant" sizes (e.g., text-base through text-3xl for body text), but Gold Standard requires ALL 13 for every text element.
**How to avoid:** Always use the full list from rules.json `schema.font_size_options`. The scaffold tool generates this correctly.
**Warning signs:** `schema-validation.cjs` reports "Font sizes: 5/13 (missing 8)".

### Pitfall 2: Gold Standard vs Baseline Controls Confusion
**What goes wrong:** Using Lane/AJ's baseline-controls.md (Weight ~50) as authoritative instead of GOLD_STANDARD_WORKFLOW.md (Weight 100).
**Why it happens:** baseline-controls.md is comprehensive and well-organized, making it look authoritative. But it represents future thinking, not current Gold Standard.
**How to avoid:** Gold Standard doc = 100, empirical data = 100, baseline-controls = ~50. When they conflict, Gold Standard wins.
**Warning signs:** Implementing pt-based font sizes (baseline-controls) instead of utility class sizes (Gold Standard).

### Pitfall 3: Schema Settings Order Wrong
**What goes wrong:** Settings appear in random order in the editor sidebar, confusing users.
**Why it happens:** Not following the prescribed order: Content -> Interactive -> Layout -> Container.
**How to avoid:** Content fields immediately followed by their styling settings (font family, size, weight, color). Then buttons. Then section background/padding/radius. Then container settings last.
**Warning signs:** Editor sidebar shows font sizes before the content field they style.

### Pitfall 4: Missing `{{ block.fluid_attributes }}`
**What goes wrong:** Blocks render correctly but cannot be selected, reordered, or configured in the page editor.
**Why it happens:** Forgetting to add the attribute to block-level elements.
**How to avoid:** Every `{% for block in section.blocks %}` loop element must include `{{ block.fluid_attributes }}` on its outermost container div.
**Warning signs:** Editor sidebar shows "No blocks" or blocks cannot be clicked.

### Pitfall 5: One-Pager Content Overflow
**What goes wrong:** Content extends beyond the 11-inch page height, causing multi-page PDF output.
**Why it happens:** Not constraining content to fit within the page dimensions.
**How to avoid:** Use `min-height: 11in` (not `height: 11in`) plus `overflow: hidden` on the page container. Design templates with fixed zones that accommodate variable content through truncation or font size adjustment.
**Warning signs:** Print preview shows two pages instead of one.

### Pitfall 6: Referencing Existing Sections as Examples
**What goes wrong:** Building sections that replicate the broken patterns in Fluid's 111 existing sections.
**Why it happens:** Natural instinct to look at "what works" in the codebase. But Lane explicitly said the existing sections "suck."
**How to avoid:** Use ONLY the Gold Standard Workflow document and rules.json as sources of truth. The empirical research of the codebase is for understanding the rendering pipeline, NOT for copying section patterns.
**Warning signs:** Sections with 8 color options instead of 13, or with hard-coded styles.

## Code Examples

### Complete Text Element Schema Block (Gold Standard)
```json
// Source: GOLD_STANDARD_WORKFLOW.md + rules.json
// Every text element needs exactly this structure (6 settings)
{
  "type": "text",
  "id": "heading",
  "label": "Heading",
  "default": "Your Heading Here"
},
{
  "type": "select",
  "id": "heading_font_family",
  "label": "Heading Font Family",
  "options": [
    { "value": "font-primary", "label": "Primary" },
    { "value": "font-body", "label": "Body" },
    { "value": "font-handwritten", "label": "Handwritten" },
    { "value": "font-serif", "label": "Serif" }
  ],
  "default": "font-primary"
},
{
  "type": "select",
  "id": "heading_font_size",
  "label": "Heading Font Size (Mobile)",
  "options": [
    { "value": "text-xs", "label": "XS" },
    { "value": "text-sm", "label": "SM" },
    { "value": "text-base", "label": "Base" },
    { "value": "text-lg", "label": "LG" },
    { "value": "text-xl", "label": "XL" },
    { "value": "text-2xl", "label": "2XL" },
    { "value": "text-3xl", "label": "3XL" },
    { "value": "text-4xl", "label": "4XL" },
    { "value": "text-5xl", "label": "5XL" },
    { "value": "text-6xl", "label": "6XL" },
    { "value": "text-7xl", "label": "7XL" },
    { "value": "text-8xl", "label": "8XL" },
    { "value": "text-9xl", "label": "9XL" }
  ],
  "default": "text-3xl"
},
{
  "type": "select",
  "id": "heading_font_size_desktop",
  "label": "Heading Font Size (Desktop)",
  "options": [
    { "value": "lg:text-xs", "label": "XS" },
    { "value": "lg:text-sm", "label": "SM" },
    { "value": "lg:text-base", "label": "Base" },
    { "value": "lg:text-lg", "label": "LG" },
    { "value": "lg:text-xl", "label": "XL" },
    { "value": "lg:text-2xl", "label": "2XL" },
    { "value": "lg:text-3xl", "label": "3XL" },
    { "value": "lg:text-4xl", "label": "4XL" },
    { "value": "lg:text-5xl", "label": "5XL" },
    { "value": "lg:text-6xl", "label": "6XL" },
    { "value": "lg:text-7xl", "label": "7XL" },
    { "value": "lg:text-8xl", "label": "8XL" },
    { "value": "lg:text-9xl", "label": "9XL" }
  ],
  "default": "lg:text-4xl"
},
{
  "type": "select",
  "id": "heading_font_weight",
  "label": "Heading Font Weight",
  "options": [
    { "value": "font-light", "label": "Light" },
    { "value": "font-normal", "label": "Normal" },
    { "value": "font-medium", "label": "Medium" },
    { "value": "font-semibold", "label": "Semibold" },
    { "value": "font-bold", "label": "Bold" }
  ],
  "default": "font-bold"
},
{
  "type": "select",
  "id": "heading_color",
  "label": "Heading Color",
  "options": [
    { "value": "text-primary", "label": "Primary" },
    { "value": "text-secondary", "label": "Secondary" },
    { "value": "text-tertiary", "label": "Tertiary" },
    { "value": "text-accent", "label": "Accent" },
    { "value": "text-accent-secondary", "label": "Accent Secondary" },
    { "value": "text-white", "label": "White" },
    { "value": "text-black", "label": "Black" },
    { "value": "text-success", "label": "Success" },
    { "value": "text-warning", "label": "Warning" },
    { "value": "text-error", "label": "Error" },
    { "value": "text-info", "label": "Info" },
    { "value": "text-muted", "label": "Muted" },
    { "value": "text-inherit", "label": "Inherit" }
  ],
  "default": "text-primary"
}
```

### Section and Container Settings (Gold Standard)
```json
// Source: GOLD_STANDARD_WORKFLOW.md, verified in rules.json section_settings/container_settings
// Section: 5 required settings
{
  "type": "select",
  "id": "background_color",
  "label": "Section Background",
  "options": [ /* 13 bg-* semantic colors */ ],
  "default": "bg-neutral"
},
{ "type": "image_picker", "id": "background_image", "label": "Background Image" },
{
  "type": "select",
  "id": "section_padding_y_mobile",
  "label": "Padding Y (Mobile)",
  "options": [
    { "value": "py-xs", "label": "XS" },
    { "value": "py-sm", "label": "SM" },
    { "value": "py-md", "label": "MD" },
    { "value": "py-lg", "label": "LG" },
    { "value": "py-xl", "label": "XL" },
    { "value": "py-2xl", "label": "2XL" },
    { "value": "py-3xl", "label": "3XL" }
  ],
  "default": "py-xl"
},
{ /* section_padding_y_desktop: same 7 options with lg: prefix */ },
{
  "type": "select",
  "id": "section_border_radius",
  "label": "Border Radius",
  "options": [
    { "value": "rounded-none", "label": "None" },
    { "value": "rounded-sm", "label": "SM" },
    { "value": "rounded", "label": "Default" },
    { "value": "rounded-md", "label": "MD" },
    { "value": "rounded-lg", "label": "LG" },
    { "value": "rounded-xl", "label": "XL" },
    { "value": "rounded-2xl", "label": "2XL" },
    { "value": "rounded-3xl", "label": "3XL" }
  ],
  "default": "rounded-none"
}
// Container: 7 required settings
// container_background_color (13 + transparent), container_background_image,
// container_border_radius (8), container_padding_y_mobile (7),
// container_padding_y_desktop (7), container_padding_x_mobile (7),
// container_padding_x_desktop (7)
```

### Template Liquid Pattern (Using Utility Classes)
```liquid
<!-- Source: Fluid codebase features_grid pattern, corrected to Gold Standard -->
<section class="hero-section {{ section.settings.background_color | default: 'bg-neutral' }} {{ section.settings.section_padding_y_mobile | default: 'py-xl' }} {{ section.settings.section_padding_y_desktop | default: 'lg:py-3xl' }} {{ section.settings.section_border_radius | default: 'rounded-none' }}">
  <div class="container {{ section.settings.container_background_color | default: 'bg-transparent' }} {{ section.settings.container_border_radius | default: 'rounded-none' }} {{ section.settings.container_padding_y_mobile | default: 'py-0' }} {{ section.settings.container_padding_y_desktop | default: 'lg:py-0' }} {{ section.settings.container_padding_x_mobile | default: 'px-lg' }} {{ section.settings.container_padding_x_desktop | default: 'lg:px-xl' }}">

    {% if section.settings.heading != blank %}
    <h1 class="{{ section.settings.heading_font_family | default: 'font-primary' }} {{ section.settings.heading_font_size | default: 'text-3xl' }} {{ section.settings.heading_font_size_desktop | default: 'lg:text-4xl' }} {{ section.settings.heading_font_weight | default: 'font-bold' }} {{ section.settings.heading_color | default: 'text-primary' }}">
      {{ section.settings.heading | default: 'Your Heading Here' }}
    </h1>
    {% endif %}

    {% for block in section.blocks %}
      {% case block.type %}
        {% when 'text_block' %}
          <div class="block-wrapper" {{ block.fluid_attributes }}>
            <!-- Block content using block.settings -->
          </div>
      {% endcase %}
    {% endfor %}

  </div>
</section>
```

### One-Pager Structure (from live-editor-one-pager.html)
```html
<!-- Source: Reference/Brand reference material/Generated Examples/One-Pagers/live-editor-one-pager.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    @page { size: letter; margin: 0; }
    .page {
      width: 8.5in;
      min-height: 11in;
      margin: 0 auto;
      padding: 0.45in 0.55in 0.35in;
      background: var(--black);
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }
    /* Brushstrokes as absolute-positioned elements with mix-blend-mode: screen */
    .brush { position: absolute; pointer-events: none; z-index: 1; mix-blend-mode: screen; }
    /* Side label rotated 90deg */
    .side-label { position: absolute; top: 50%; right: 12px; transform: translateY(-50%) rotate(90deg); }
  </style>
</head>
<body>
  <div class="page">
    <!-- z-index layering: brushstrokes at 1, content at 2, side-label at 5 -->
    <div class="brush"><!-- brushstroke texture --></div>
    <div class="side-label">FLUID COMMERCE</div>
    <header class="header"><!-- Logo + tagline --></header>
    <section class="hero"><!-- Headline + sub --></section>
    <section class="stat-strip"><!-- 3-column stats --></section>
    <section class="body-grid"><!-- Two-column content --></section>
    <footer class="footer"><!-- CTA + contact --></footer>
  </div>
</body>
</html>
```

## Empirical Findings from Codebase Investigation

### How Schema Gets Rendered (Confidence: HIGH)
**Source:** `/Users/cheyrasmussen/fluid/app/themes/liquid_tags/schema_tag.rb` and `/Users/cheyrasmussen/fluid/app/models/application_theme_template.rb`

1. `LiquidTags::SchemaTag` parses the `{% schema %}...{% endschema %}` block as JSON
2. Schema renders as empty string ("") in the template output -- it's metadata only
3. `ApplicationThemeTemplate` processes schema settings, applying defaults from schema to section settings when values are nil
4. Block settings work the same way -- defaults from block schema settings are applied

### How `block.fluid_attributes` Works (Confidence: HIGH)
**Source:** `/Users/cheyrasmussen/fluid/app/models/application_theme_template.rb` lines 294-324, 512-524

- Only generated in editor mode (`RequestStore.store[:editor_mode]`)
- Generates data attributes: `data-fluid-section-block-id`, `data-fluid-parent-section-type`, `data-fluid-section-id`, `data-fluid-section-block-type`, `data-fluid-block-attribute` (the block's settings as JSON)
- Block IDs are generated as MD5 hashes of "{template_id}-{section_index}-{block_index}"
- Block order can be specified via `section["block_order"]` array

### How Renderer Adds Element Targeting (Confidence: HIGH)
**Source:** `/Users/cheyrasmussen/fluid/app/services/themes/templates/renderer.rb`

- `Renderer.populate_data_attrs` adds `data-fluid-element="{random8chars}"` to every HTML tag (excluding html, body, head, meta, etc.)
- Schema blocks are masked during this process so their JSON isn't corrupted
- This enables the page editor to target any element for inline editing

### Existing Section Quality (Confidence: HIGH)
**Source:** Direct inspection of `/Users/cheyrasmussen/fluid/app/themes/templates/global/sections/features_grid/index.liquid`

The features_grid section demonstrates exactly why existing sections are NOT Gold Standard:
- Font sizes: Only 5 options (text-2xl through text-6xl) instead of 13
- Colors: Only 8 options (inconsistent naming: text-quaternary, text-neutral-light) instead of 13 semantic colors
- Font weights: Includes "Black" (6 options) while Gold Standard specifies exactly 5
- Section settings: Uses single `section_padding` instead of separate mobile/desktop
- Container settings: Uses single `container_padding` instead of separate y_mobile/y_desktop/x_mobile/x_desktop
- No button system at all

## Recommended Section Types (10+)

Based on common web patterns and Fluid's e-commerce use cases:

| # | Section Type | Key Elements | Block Types |
|---|-------------|-------------|-------------|
| 1 | Hero | Heading, subheading, CTA button, background image | text, button |
| 2 | Features Grid | Grid of feature cards with icons | feature_item (icon, title, description) |
| 3 | Testimonials | Customer quotes with attribution | testimonial (quote, author, role, image) |
| 4 | CTA Banner | Headline, body, dual buttons | text, button |
| 5 | Image + Text | Split layout: image one side, text other | text, button, image |
| 6 | Statistics/Metrics | Large numbers with labels | stat_item (value, label, icon) |
| 7 | FAQ/Accordion | Collapsible Q&A pairs | faq_item (question, answer) |
| 8 | Logo Showcase | Partner/client logo grid | logo_item (image, alt, link) |
| 9 | Pricing | Pricing tier cards | pricing_tier (name, price, features, cta) |
| 10 | Content/Blog | Rich text content section | text (richtext body) |
| 11 | Video | Embedded video with overlay text | text, button |
| 12 | Newsletter | Email capture with heading/body | text, form |

## One-Pager Layout Patterns (from Reference Images)

| Layout | Source | Key Zones | Best For |
|--------|--------|-----------|----------|
| Two-column hero + 2x2 grid | Meditation app | Hero with product image, About/Why grid, Features/Get Started grid | Product feature sheets |
| Headline + stats column + bullets | AI sales platform | Full-width headline, large stat callouts right, feature bullets left, benefits list | Data-driven product pages |
| Giant stats + full-bleed image | Startup fact sheet | Centered title, Overview/Vision/Mission left, stacked giant stats right, full-bleed image breaking layout | Company overviews, investor sheets |
| Display headline + photo strip + cards | Floral services | Large decorative headline, 3-photo strip, 3-column feature cards, CTA footer | Service-oriented businesses |
| Live editor (existing) | live-editor-one-pager.html | Header with logos, hero with accented headline, 3-stat strip, two-column body, CTA footer | Product deep-dives, technical features |

## Gold Standard Doc Decomposition Plan

The GOLD_STANDARD_WORKFLOW.md (approx 300 lines) should be split by agent role while preserving exact wording:

| Target File | Agent Consumer | Source Sections | Content |
|-------------|---------------|-----------------|---------|
| `schema-rules.md` | Layout agent | Phase 1 (Planning) + Phase 2 Step 1 (Schema First) | Schema planning checklist, setting order, text element 6-setting rule, option counts |
| `button-system.md` | Styling agent | Phase 2 Step 3 (Button Implementation) + Phase 3 button validation | Button 7-setting rule, btn utility classes, NEVER custom button styles |
| `template-patterns.md` | Layout agent | Phase 2 Step 2 (Template Implementation) | Utility class usage, var(--clr-*) patterns, block.fluid_attributes, image placeholders |
| `validation-checklist.md` | Spec-check agent | Phase 4 (Validation) full checklist | Schema validation, template validation, default values, CSS validation, quality checks |
| `theme-tokens.md` | Styling agent | Phase 2 references + Critical Rules | CSS variable patterns, no-hardcode rules, all 13 color names, all 13 size names |

## State of the Art

| Old Approach (Existing Sections) | Gold Standard Approach | Impact |
|----------------------------------|----------------------|--------|
| 5-8 font size options | 13 font size options (text-xs through text-9xl) | Full editor control over typography |
| 8 inconsistent color names | 13 semantic colors matching rules.json | Consistent theming across sections |
| Single padding value | Separate mobile/desktop padding | Responsive design control |
| No button system | 7-setting btn utility class system | Consistent, themeable buttons |
| Hard-coded styles in CSS | All utility classes from schema settings | Zero hard-coded values |
| Single container padding | 7 container settings (bg, image, radius, padding x/y mobile/desktop) | Full container customization |

**Deprecated/outdated:**
- Existing 111 sections: Explicitly deprecated by Lane. Do not reference.
- baseline-controls.md pt-based font sizes: Future direction, not current Gold Standard. Track for Phase 4+.
- `font-black` weight option: Existing sections include it, Gold Standard specifies exactly 5 weights (light through bold), no black.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in CLI tools (no test framework -- validation is the test) |
| Config file | `tools/rules.json` (compiled brand rules) |
| Quick run command | `node tools/schema-validation.cjs <file.liquid>` |
| Full suite command | `for f in templates/sections/*.liquid; do node tools/schema-validation.cjs "$f"; done` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SITE-01 | Valid .liquid with proper schema | unit | `node tools/schema-validation.cjs templates/sections/hero.liquid` | Template: Wave 0, Tool: Exists |
| SITE-02 | Gold Standard docs decomposed | manual-only | Verify files exist in `docs/fluid-themes-gold-standard/` | Wave 0 |
| SITE-03 | Text elements have 6 settings each | unit | `node tools/schema-validation.cjs <file>` (checks font size 13, color 13, weight 5) | Tool exists |
| SITE-04 | Buttons have 7 settings | unit | `node tools/schema-validation.cjs <file>` (checks button_settings) | Tool exists |
| SITE-05 | Section/container settings complete | unit | `node tools/schema-validation.cjs <file>` (checks section_settings, container_settings) | Tool exists |
| SITE-06 | No hard-coded values | unit | `node tools/brand-compliance.cjs <file> --context website` | Tool exists |
| SITE-07 | Passes Gold Standard validation | unit | `node tools/schema-validation.cjs <file>` + `node tools/brand-compliance.cjs <file>` | Tools exist |
| PAGE-01 | One-pager as self-contained HTML | smoke | `node tools/brand-compliance.cjs <file>` | Tool exists |
| PAGE-02 | Fluid brand elements present | manual-only | Visual inspection of brushstrokes, side labels, FLFont | N/A |
| PAGE-03 | Print-ready letter size | smoke | `node tools/dimension-check.cjs <file> --target letter` | Tool exists (needs letter target) |
| TMPL-03 | One-pager templates with slot specs | manual-only | Check `<!-- SLOT: -->` comments in templates | Wave 0 |
| TMPL-04 | FIXED/FLEXIBLE/OPTIONAL annotations | manual-only | Check annotation comments in templates | Wave 0 |

### Sampling Rate
- **Per task commit:** `node tools/schema-validation.cjs <latest-file>`
- **Per wave merge:** `for f in templates/sections/*.liquid; do node tools/schema-validation.cjs "$f"; done`
- **Phase gate:** Full suite green + manual editor validation of hero section before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `templates/sections/` directory -- does not exist yet, needs creation
- [ ] `templates/one-pagers/` directory -- does not exist yet, needs creation
- [ ] `docs/fluid-themes-gold-standard/` directory -- does not exist yet, needs creation
- [ ] `dimension-check.cjs` may need a `--target letter` option for 8.5x11" validation (verify existing targets)
- [ ] `brand-compliance.cjs --context website` path needs verification that website-specific rules fire correctly
- [ ] `/query-fluid-backend` and `/query-fluid-mono` skills referenced in context but do not exist -- need to be created or research done directly

## Open Questions

1. **How does `{% render 'section-css', section_id: 'features_grid' %}` work?**
   - What we know: Existing sections reference this pattern for CSS inclusion
   - What's unclear: Where the section-css snippet resolves to, what it generates
   - Recommendation: Investigate during empirical research wave; may need to render CSS differently in Gold Standard templates

2. **What utility classes does Fluid's theme system actually support?**
   - What we know: `text-*`, `bg-*`, `font-*`, `py-*`, `px-*`, `rounded-*` classes used in templates
   - What's unclear: Full list of available classes, whether they're Tailwind-based or custom
   - Recommendation: Grep the frontend monorepo for the CSS framework source during empirical research

3. **Does `fluid theme push` work for validation?**
   - What we know: CONTEXT.md says to validate by pushing to dev theme and checking editor
   - What's unclear: Whether the user has a dev theme set up, push credentials, etc.
   - Recommendation: Document as a manual validation step; don't block automated checks on it

4. **How does the `btn` utility class system resolve?**
   - What we know: Pattern is `btn btn-{style}-{color} {size} {weight}` from Gold Standard
   - What's unclear: Where the btn CSS classes are defined in the theme system
   - Recommendation: Verify during empirical research by searching frontend mono for btn class definitions

## Sources

### Primary (HIGH confidence)
- `/Users/cheyrasmussen/Fluid Marketing Master Skills/Reference/Fluid Themes/GOLD_STANDARD_WORKFLOW.md` -- Full Gold Standard schema rules and workflow
- `/Users/cheyrasmussen/Fluid Marketing Master Skills/tools/rules.json` -- Compiled brand rules with exact option counts
- `/Users/cheyrasmussen/fluid/app/themes/liquid_tags/schema_tag.rb` -- How Liquid schema blocks are parsed
- `/Users/cheyrasmussen/fluid/app/models/application_theme_template.rb` -- How block.fluid_attributes are generated
- `/Users/cheyrasmussen/fluid/app/services/themes/templates/renderer.rb` -- How data-fluid-element attributes are added
- `/Users/cheyrasmussen/fluid/app/themes/templates/global/sections/features_grid/index.liquid` -- Example of existing (non-Gold-Standard) section
- `/Users/cheyrasmussen/Fluid Marketing Master Skills/Reference/Brand reference material/Generated Examples/One-Pagers/live-editor-one-pager.html` -- Proven one-pager pattern
- `/Users/cheyrasmussen/Fluid Marketing Master Skills/.claude/skills/fluid-social/SKILL.md` -- Orchestrator pattern to mirror

### Secondary (MEDIUM confidence)
- `/Users/cheyrasmussen/Fluid Marketing Master Skills/Reference/Fluid Themes/baseline-controls.md` -- Lane/AJ's current thinking (Weight ~50)
- `/Users/cheyrasmussen/Fluid Marketing Master Skills/Reference/Fluid Themes/07-schema-components.md` -- Fluid docs on schema structure
- `/Users/cheyrasmussen/Fluid Marketing Master Skills/Reference/Fluid Themes/06-theme-variables.md` -- Template variable access patterns
- Reference one-pager layout images (4 files) -- Layout patterns only, not style

### Tertiary (LOW confidence)
- Exact utility class availability in Fluid's theme CSS framework -- needs empirical verification
- `fluid theme push` workflow details -- needs user confirmation
- `{% render 'section-css' %}` resolution -- needs investigation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools and patterns verified in codebase
- Architecture: HIGH -- extends proven Phase 2 orchestrator pattern, Gold Standard requirements well-documented
- Pitfalls: HIGH -- confirmed by inspecting actual broken sections in the Fluid codebase
- Empirical findings: HIGH -- directly inspected Ruby source code
- One-pager patterns: MEDIUM -- reference HTML exists but layout variety comes from images only

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- Gold Standard spec unlikely to change in 30 days)
