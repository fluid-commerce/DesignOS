# 🌟 Gold Standard Section Development Workflow

## The Problem We're Solving

Without a systematic process, sections get built incrementally with missing Gold Standard requirements. This creates technical debt and inconsistent user experiences.

**This workflow ensures every section is Gold Standard compliant from day one.**

---

## 📋 THE WORKFLOW

### Phase 1: Planning (Before Writing Any Code)

#### Step 1: Analyze Requirements
- [ ] Review reference design (Image, Text, or Code)
- [ ] Identify all text elements (heading, subheading, body, captions, etc.)
- [ ] Identify all interactive elements (buttons, links, CTAs)
- [ ] Identify repeatable content (use blocks)
- [ ] List all customization needs (colors, spacing, layout)

#### Step 2: Schema Planning Checklist
For **EVERY text element**, plan these settings:
- [ ] Content field (text, textarea, richtext)
- [ ] Font family (4 options: primary, body, handwritten, serif)
- [ ] Font size mobile (13 options: text-xs → text-9xl)
- [ ] Font size desktop (13 options: lg:text-xs → lg:text-9xl)
- [ ] Font weight (5 options: light, normal, medium, semibold, bold)
- [ ] Color (13 options: all semantic colors)

For **EVERY button**, plan these settings:
- [ ] Show toggle (checkbox)
- [ ] Text (text)
- [ ] URL (url)
- [ ] Style (filled, outline, ghost)
- [ ] Color (10 options: primary → white)
- [ ] Size (5 options: btn-xs → btn-xl)
- [ ] Font weight (5 options: light → bold)

For **section**, plan these settings:
- [ ] Background color (13 options)
- [ ] Background image (image_picker)
- [ ] Padding Y mobile (7 options: py-xs → py-3xl)
- [ ] Padding Y desktop (7 options: lg:py-xs → lg:py-3xl)
- [ ] Border radius (8 options: rounded-none → rounded-3xl)

For **container**, plan these settings:
- [ ] Background color (13 options + transparent)
- [ ] Background image (image_picker)
- [ ] Border radius (8 options)
- [ ] Padding Y mobile (7 options)
- [ ] Padding Y desktop (7 options)
- [ ] Padding X mobile (7 options)
- [ ] Padding X desktop (7 options)

---

### Phase 2: Scaffolding (Start With Complete Template)

#### Step 1: Copy Gold Standard Template
```bash
cp theme/sections/_GOLD_STANDARD_TEMPLATE/index.liquid theme/sections/YOUR-SECTION/index.liquid
cp theme/sections/_GOLD_STANDARD_TEMPLATE/styles.css theme/sections/YOUR-SECTION/styles.css
```

#### Step 2: Use Schema Snippets
Instead of writing schema from scratch, copy complete blocks from:
- `GOLD_STANDARD_SCHEMA_SNIPPETS.md`

Each snippet includes:
- ✅ All 13 font sizes (mobile + desktop)
- ✅ All 13 colors
- ✅ All font weights including "Light"
- ✅ Proper labels and defaults
- ✅ Correct order and grouping

---

### Phase 3: Implementation

#### Step 1: Schema First (Top-Down)
**Order matters!** Build schema in this exact order:

```
1. Content Settings (with immediate styling)
   ├─ Heading
   │  ├─ heading (text)
   │  ├─ heading_font_family (select - 4 options)
   │  ├─ heading_font_size (select - 13 options)
   │  ├─ heading_font_size_desktop (select - 13 options)
   │  ├─ heading_font_weight (select - 5 options)
   │  └─ heading_color (select - 13 options)
   ├─ Subheading (same 6 settings)
   ├─ Body Text (same 6 settings)
   └─ Caption (same 6 settings)

2. Interactive Elements
   ├─ Button
   │  ├─ show_button (checkbox)
   │  ├─ button_text (text)
   │  ├─ button_url (url)
   │  ├─ button_style (select - 3 options)
   │  ├─ button_color (select - 10 options)
   │  ├─ button_size (select - 5 options)
   │  └─ button_font_weight (select - 5 options)
   └─ Link (similar structure)

3. Layout Settings
   ├─ background_color (select - 13 options)
   ├─ background_image (image_picker)
   ├─ section_padding_y_mobile (select - 7 options)
   ├─ section_padding_y_desktop (select - 7 options)
   └─ section_border_radius (select - 8 options)

4. Container Settings
   ├─ container_background_color (select - 13 + transparent)
   ├─ container_background_image (image_picker)
   ├─ container_border_radius (select - 8 options)
   ├─ container_padding_y_mobile (select - 7 options)
   ├─ container_padding_y_desktop (select - 7 options)
   ├─ container_padding_x_mobile (select - 7 options)
   └─ container_padding_x_desktop (select - 7 options)
```

#### Step 2: Template Implementation
- [ ] Use utility classes from schema settings
- [ ] Never hard-code colors, spacing, or border radius
- [ ] Use `var(--clr-*)`, `var(--radius-*)`, `var(--space-*)` for inline styles
- [ ] Add `{{ block.fluid_attributes }}` to all block elements
- [ ] Add placeholder fallbacks for all images

#### Step 3: Button Implementation
**CRITICAL:** Always use the button utility class system:

```liquid
{% if section.settings.show_button %}
<a href="{{ section.settings.button_url | default: '#' }}" 
   class="btn btn-{{ section.settings.button_style | default: 'filled' }}-{{ section.settings.button_color | default: 'primary' }} {{ section.settings.button_size | default: 'btn-md' }} {{ section.settings.button_font_weight | default: 'font-medium' }} {{ settings.button_border_radius | default: 'rounded' }}">
  {{ section.settings.button_text | default: 'Click Here' }}
</a>
{% endif %}
```

**NEVER:**
```liquid
<!-- ❌ DON'T DO THIS -->
<a class="bg-primary text-secondary" style="padding: 18px; border-radius: 13px;">
```

---

### Phase 4: Validation (Before Marking "Done")

#### Pre-Commit Checklist

Run through this checklist **before** considering the section complete:

**Schema Validation:**
- [ ] All text elements have 6 settings (family, size mobile, size desktop, weight, color, content)
- [ ] All font size selects have exactly 13 options
- [ ] All color selects have exactly 13 options
- [ ] All font weight selects have exactly 5 options (including "Light")
- [ ] All buttons have 7 settings (show, text, url, style, color, size, weight)
- [ ] Button style has 3 options (filled, outline, ghost)
- [ ] Button color has 10 options (primary through white)
- [ ] Button size has 5 options (btn-xs through btn-xl)
- [ ] Layout settings complete (5 settings: bg color, bg image, padding mobile/desktop, border radius)
- [ ] Container settings complete (7 settings: bg color, bg image, border radius, padding x/y mobile/desktop)
- [ ] Settings ordered: Content → Interactive → Layout → Container
- [ ] Content + styling properly grouped (content field immediately followed by styling)

**Template Validation:**
- [ ] All settings used in template exist in schema
- [ ] No hard-coded colors (no `#e6ea00`, use `var(--clr-secondary)`)
- [ ] No hard-coded border radius (no `13px`, use `var(--radius-lg)`)
- [ ] No hard-coded spacing (no `24px`, use `var(--space-lg)`)
- [ ] Buttons use `btn btn-{style}-{color}` class system
- [ ] All blocks include `{{ block.fluid_attributes }}`
- [ ] All images have placeholder fallbacks
- [ ] Background images use `data-bg` attribute
- [ ] Content properly centered where needed (`margin: 0 auto; text-align: center;`)
- [ ] Links that shouldn't wrap use `white-space: nowrap;`

**Default Values:**
- [ ] Section background: `bg-neutral` (not bg-white or bg-primary)
- [ ] Text color: `text-primary` (not text-black unless specific reason)
- [ ] Button size: `btn-md`
- [ ] Button font weight: `font-medium`
- [ ] Section padding: `py-xl` (mobile), `lg:py-3xl` (desktop)
- [ ] Heading: `text-3xl` (mobile), `lg:text-4xl` (desktop), `font-bold`
- [ ] Body: `text-base` (mobile), `lg:text-lg` (desktop), `font-normal`

**CSS Validation:**
- [ ] Smooth hover transitions (0.3s cubic-bezier)
- [ ] Proper focus states for accessibility
- [ ] Mobile-first responsive design
- [ ] Desktop variants use `lg:` prefix
- [ ] No unwanted shadows on images (`box-shadow: none !important;`)

**Quality Checks:**
- [ ] Tested on mobile viewport
- [ ] Tested on desktop viewport
- [ ] All settings in customizer work as expected
- [ ] No console errors
- [ ] No linter errors
- [ ] Images load with proper fallbacks

---

## 🚨 CRITICAL RULES

### NEVER:
1. ❌ Skip any of the 4 phases
2. ❌ Write schema without planning first
3. ❌ Use partial font size lists (only 5 or 8 options)
4. ❌ Omit desktop font sizes
5. ❌ Omit font family selects
6. ❌ Use incomplete color lists (only 3-5 options)
7. ❌ Hard-code colors, spacing, or border radius
8. ❌ Use custom button styles instead of `btn` classes
9. ❌ Skip container settings section
10. ❌ Mark section "done" without validation checklist

### ALWAYS:
1. ✅ Start with Phase 1 (Planning)
2. ✅ Use schema snippets from `GOLD_STANDARD_SCHEMA_SNIPPETS.md`
3. ✅ Include all 13 font sizes for mobile AND desktop
4. ✅ Include all 13 semantic colors
5. ✅ Include all 5 font weights (including Light)
6. ✅ Use complete button system (7 settings)
7. ✅ Include complete layout settings (5 settings)
8. ✅ Include complete container settings (7 settings)
9. ✅ Run validation checklist before marking "done"
10. ✅ Reference Gold Standard examples when unsure

---

## 📚 Reference Files

When building a section, keep these open:

1. **`GOLD_STANDARD_SECTION_CHECKLIST.md`** - Requirements reference
2. **`GOLD_STANDARD_SCHEMA_SNIPPETS.md`** - Copy-paste schema blocks
3. **`THEME_SYSTEM_REFERENCE.md`** - Colors, spacing, radius values
4. **`SECTION_DEVELOPMENT_GUIDE.md`** - Technical implementation details

---

## 🎯 Success Metrics

A section is **Gold Standard compliant** when:

1. ✅ Passes 100% of validation checklist
2. ✅ User has complete control over all typography
3. ✅ User has complete control over all colors
4. ✅ User has complete control over all spacing
5. ✅ User has complete control over all layout
6. ✅ No hard-coded values anywhere
7. ✅ Consistent with all other Gold Standard sections
8. ✅ Professional, polished, accessible

---

## 💡 Example Workflow

**BAD Workflow (What We Did):**
```
1. Look at Reference Design
2. Build section to match Reference Design
3. Add some styling options
4. Ship it
5. (Discover it's not Gold Standard)
6. (Major refactor required)
```

**GOOD Workflow (What We Should Do):**
```
1. Look at Reference Design
2. Plan schema (identify all text elements, buttons, etc.)
3. Copy Gold Standard template
4. Use schema snippets for each element
5. Implement template using utility classes
6. Run validation checklist
7. Fix any issues found
8. Ship Gold Standard section
9. (Never needs refactoring)
```

---

## 🚀 Time Investment

**Initial Setup:** 2 hours to create templates and snippets  
**Per Section (Old Way):** 3 hours build + 2 hours refactor = 5 hours  
**Per Section (New Way):** 4 hours build (Gold Standard from start) = 4 hours  

**Savings:** 1 hour per section + no technical debt + consistent quality

---

## 📝 Next Steps

1. **Create `GOLD_STANDARD_SCHEMA_SNIPPETS.md`** - Reusable schema blocks
2. **Create `theme/sections/_GOLD_STANDARD_TEMPLATE/`** - Starting template
3. **Update Hero Section** - Make it Gold Standard compliant
4. **Use This Workflow** - For all future sections

**Should I create these files now?** 🌟

