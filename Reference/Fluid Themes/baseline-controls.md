---
name: Fluid Section Baseline Controls
overview: A single reference list of baseline features and controls every Fluid builder section should have or consider, so sections stay consistent, connect to theme settings, and give editors predictable controls (similar to Shopify free themes).
todos: []
isProject: false
---

# Fluid Section Baseline: Standard Features and Controls

One checklist to use as the starting point for every section. Sections can omit items that don’t apply, but anything that does apply should follow these standards.

---

## 0. Viewport switcher (always at top)

- **Desktop, tablet, mobile** are always shown at the **top of the control panel** (e.g. Desktop | Tablet | Mobile with a mobile icon for the smallest breakpoint). The user always sees which version of the site they are editing.
- **Cascade:** Desktop is the top-down source of truth; settings apply downward to tablet and mobile unless overridden.
- **Mobile-only “push up”:** At the mobile level only, provide an option (where it makes sense) to “use this value for tablet and desktop” so a mobile-specific choice can be promoted to larger breakpoints instead of only overriding downward.
- **Preview must match selected viewport:** When the user is editing “Desktop,” the preview/editor must show the **desktop** layout even if the browser window is smaller than the desktop breakpoint (or the builder’s side panels have shrunk the preview area). Use a **minimum width** for the preview equal to the theme’s desktop breakpoint; if the available space is smaller than that, **scale down** the preview (e.g. fit the desktop layout inside the available area) so the user is always editing a true desktop rendering, not an accidental tablet/mobile view due to browser size.

---

## 1. Section-level layout and container

- **Width / containment:** Control for section width: full-bleed, contained/windowed, or constrained to a max-width. Optionally separate per breakpoint (desktop, tablet, mobile).
- **Padding (slider 1–100 px):** Two **separate** settings, each with link/unlink:
  - **Top/bottom:** One control; link icon to sync top and bottom, or unlink to set top and bottom independently. Slider (or equivalent) 1–100 px.
  - **Left/right:** One control; link icon to sync left and right, or unlink to set independently. Slider 1–100 px.
- **Section border radius:** **Not** controlled at theme level. Every section has a **manual** radius control (four corners, slider 1–100 px, link/unlink for all four—Illustrator-style). **Default = 0 px** (straight lines). Place this control **very low in the priority of settings** on the right panel (very near the bottom) so it’s available but not prominent. Per breakpoint where needed.
- **Section background:** Sections retain their own section background controls (color, image, video, etc.). Section backgrounds sit visually **on top of** the page background. Full-width sections may visually cover the page background; constrained or styled sections allow it to show through. Theme palette + color picker; optional background image/video from Fluid DAM/media. See §1a for the full background hierarchy (theme → page → section).

---

## 1a. Background hierarchy (theme → page → section)

- **Theme-level background (default):** The theme defines a **default page background** that applies site-wide. This acts as the **base canvas** behind all pages and sections. Set once in Theme Settings and used as the fallback for all pages.
- **Page-level background (optional override):** Each page may **optionally** override the theme’s default page background. Page background settings live in a **dedicated Page Settings panel**, separate from section controls. Overrides are **explicit** (e.g. “Use theme default” vs “Custom background”) to prevent accidental divergence. When a custom page background is enabled, it renders behind all sections on that page.
- **Section backgrounds (unchanged):** Sections retain their own section background controls (color, image, video, etc.). Section backgrounds sit visually **on top of** the page background. Full-width sections may visually cover the page background; constrained or styled sections allow the page background to show through (e.g. on the sides when the section is not full width).

---

## 2. Theme expansion and dynamic options

- **Variable quantities:** Themes can define **any number** of brand colors, font families, spacing steps, etc. The builder must **expand with the theme**—no fixed “13 colors” or “4 fonts” in the UI logic.
- **Builder options = what exists in the theme:**
  - **Colors:** Every control that sets a color shows **all theme-defined colors** (e.g. brand, semantic, neutrals) by name. The list is whatever the theme has configured.
  - **Fonts:** Every font-family control shows **all theme-defined font families**. Display as **font name** with a small visual indicator of role (e.g. “Header” or “Body”), not a style label like “Primary” or “Body” only. Example: “Inter (Header)”, “Inter (Body)”.
- **Color picker everywhere:** For **any** control that sets a color, in addition to (or instead of) theme color chips, provide a **color picker** so the user can choose a custom color when they don’t want to use a theme color. Theme colors remain the default/recommended set.

---

## 2b. Theme-level naming: fonts and colors (parity with builder)

- **Fonts:** When adding a font at theme level, the user assigns a **role** (e.g. checkboxes or select: “Header”, “Body”, or other roles the theme supports). The **same role** is what appears when selecting a font in a text block: e.g. “Inter (Header)”, “Inter (Body)”. So theme config and builder selection use the same names and roles; no separate “style” label that differs from theme.
- **Colors:** When adding a color at theme level, the user can give it a **custom name** (e.g. “Brand blue”, “Hero accent”). If no custom name is set, show the **hex value** (or equivalent) so the color is always identifiable. In the builder, when selecting a color, show the **same** name or hex—exact parity between theme settings and section/block color controls.

---

## 3. Text as blocks

- **All text is block-based.** Sections don’t have a fixed “heading” and “body” field; they have **blocks** that the user can add, remove, and reorder.
- **Default text block types:**
  - **Header block:** Primarily plain text (single line or short heading). Optional richtext if needed.
  - **Body block:** Rich text (WYSIWYG): bold, italic, strikethrough, text color, font/size if supported, alignment, lists, and **links**. Links by default pull from the same typical resources (products, pages, collections, etc.); user can instead enter a **custom URL** as long as it’s the full URL.
- Users add/remove header and body blocks like any other block (e.g. “Add block” → Header, Body, Button, Media, etc.).
- **Per-text-block controls:** Content first, then: font family (by font name + Header/Body indicator), font size in **pt** (see below), font weight, color (theme colors + color picker), alignment.

---

## 4. Font size in points (pt)

- **Font size is pt-based**, not named scales (e.g. not “xs” to “9xl”). Use a numeric scale in **pt** (e.g. 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72…) so it’s clear and consistent. Options can be theme-defined or a sensible default scale. Separate controls (or a scale) for desktop, tablet, and mobile where size varies by breakpoint.

---

## 5. Padding and radius: sliders and link behavior

- **Padding (theme, section, and block level):** Use a **slider from 1–100 px** for all padding values. Two separate settings: (1) **Top/bottom**—link/unlink to control together or individually; (2) **Left/right**—link/unlink to control together or individually (see §1).
- **Section radius:** Section-only; default 0 px; manual control per section, low in settings order (see §1). Four corners, slider 1–100 px, one link/unlink for all four. Not in theme.
- **Media container radius:** Theme has **one default** for all media containers: four corners, slider 1–100 px, link/unlink (Illustrator-style). There are no “options” for media radius from the theme—just this single default. At **block level**, the user can **override** that default with the same UI (four corners, link/unlink). So: theme = one default; block = inherit or override with same functionality.
- **Button/other block radius:** Per-block controls as elsewhere (slider 1–100 px, four corners, link/unlink where applicable).

---

## 6. Media

- **Source:** Media (image/video) from **Fluid admin DAM/media** only; no arbitrary URLs for theme assets.
- **Per asset:** Picker from DAM, optional alt text/caption, optional link.
- **Display / fit (where allowed):** Provide a control for how the media fits its container:
  - **Fit to height** – scale so height fills; width may be cropped or letterboxed.
  - **Fit to width** – scale so width fills; height may be cropped or letterboxed.
  - **Match aspect ratio** – preserve media aspect ratio, fit within container (e.g. contain). A **maximum height and/or width** (e.g. in px) should be pre-enabled or easy to set so the section cannot “break” (e.g. giant images). Defaults should be safe for layout.
- **Where fit control is allowed vs not:** Use fit controls (fit-to-height, fit-to-width, match aspect ratio) **everywhere** a discrete media asset is placed (image block, hero image, card image, logo, etc.) **unless** one of these applies:
  - **Fixed layout that would break:** e.g. a strict grid or bento layout where every cell must align; allow only “match aspect ratio” with max dimensions, or a single “contain” mode, to avoid layout collapse.
  - **Decorative or background media:** Background images may use a simpler set (cover/contain) rather than full fit-to-height/width, since the section often defines the size.
  - **Icons or fixed-ratio slots:** Where the slot is an icon or a fixed ratio (e.g. avatar circle), use “match aspect ratio” with a max size only.
- **Border radius (media containers):** **Theme level:** One default for all media containers—four corners, slider 1–100 px, link/unlink (Illustrator-style). **Block level:** Override that default per media block with the same UI (four corners, link/unlink). No separate “theme options” for media radius—only the single default, then block-level override. Apply to the media element.
- **Placeholder:** When no media is set, show a placeholder or hide the block; use `asset_url` (or Fluid equivalent) for all URLs.

---

## 7. Buttons as blocks; block-level styling

- **All buttons are blocks.** There is no “section setting” for a single button; users add one or more “Button” blocks. Each button block has its own label, URL, style, color, size, and hover behavior.
- **Per-button (block) controls:**
  - **Content:** Label (text), URL.
  - **Appearance:** Style (e.g. filled, outline, ghost), color (theme colors + color picker), size (or explicit height/width in px), font weight.
  - **Block-level styling (editable per button):** Border radius (slider 1–100 px, four corners + link/unlink), width, height (or min-width/min-height in px). So border radius and dimensions are **not** only at theme level—each button block can override them.
- **Hover:** Controlled at **theme level** (see §8); the button block only selects which hover behavior to use (e.g. default vs custom).

---

## 8. Button hover: theme-level control

- **Default hover options (theme-defined, selectable per button):** e.g. background color shift, border color shift, text color shift, subtle elevation/shadow, underline. These are the out-of-the-box choices in the button hover menu.
- **Custom hover at theme level:** The theme (or company) can define **custom hover behaviors** in the same way they add theme colors or fonts. Implementation is **CSS** (or the platform’s equivalent: e.g. CSS-in-JS or a style pipeline that outputs CSS). The company adds a named “hover animation” or “hover style” (e.g. “Pulse”, “Scale up”) that is implemented as a CSS class or set of rules. That option then appears in the **button hover** dropdown in the builder alongside the default options. So: default hovers are built-in; custom hovers are theme-level CSS (or equivalent) and exposed as named options in the button hover control.

---

## 9. Blocks (repeatable content) and block identity

- **Block types:** Clearly named types: Header (plain), Body (rich text), Button, Media, and any section-specific types (e.g. testimonial, feature, card). Buttons and text are always blocks; media can be a block or part of a composite block.
- **Per-block settings:** Same discipline: text blocks = content + font (name + Header/Body), size (pt), weight, color (theme + picker), alignment; media blocks = DAM picker + fit mode + max dimensions + alt/caption + radius (slider 1–100 px); button blocks = label, URL, style, color, size, border radius (slider 1–100 px), width/height, hover choice.
- **Block identity and reordering:** Use Fluid’s block/section identity (e.g. `block.fluid_attributes` or equivalent) so the editor can reorder, duplicate, or remove blocks and have it persist.
- **No hard-coded content:** All content and styling come from schema settings and theme tokens; no fixed copy in the template.

---

## 9b. Block positioning and layout control

- **Where blocks go:** When adding blocks, placement is determined by the **section’s layout model** (e.g. single column, multi-column, grid). The section defines the **container** and **order** (stacking); blocks are added in sequence within that container. There does not need to be free-form x/y positioning for typical sections—that would make sections easy to break and hard to keep responsive.
- **Recommendation:** Control positioning at the **section (or block-group) level**, not per block. For example: the section (or a “row”/“group” block) has settings such as “Layout” (stack, row, grid), “Alignment” (start, center, end), “Gap” (between blocks), and “Direction” (vertical/horizontal). Individual blocks do **not** get “position: absolute” or arbitrary placement by default. This keeps the section predictable and prevents layout from getting out of control.
- **When per-block position is needed:** For sections that require it (e.g. overlapping hero text, bento layout), expose a **limited** set of options (e.g. “Block position: default | overlay left | overlay right”) or a section-specific block type that allows constrained overrides, rather than full free positioning. Document which section types allow which positioning controls so builders stay within guardrails.

---

## 10. Theme connection (no hard-coding)

- **Colors:** Theme semantic/brand colors as the primary options; **plus** a color picker for custom color in every color control. No hard-coded hex in section markup; custom choice is stored as a value and can be output as a variable or inline only where needed.
- **Spacing and radius:** Slider 1–100 px (see §5). Values stored as theme variables or section/block settings. No arbitrary “3xl”-style names in the UI.
- **Typography:** Font families = whatever the theme defines (shown by font name + role; see §2b). Font sizes = pt-based scale (theme or default). Font weights = theme or standard set.
- **Assets:** `asset_url` (or Fluid equivalent) and DAM/media only.

This keeps sections consistent and globally restylable from theme/company settings while allowing pixel-level and custom-color control where needed.

---

## 10a. Theme vs section vs block (what lives where)

- **Theme level:** Defines what exists and defaults. Palette (which colors), font families and roles (which fonts, Header/Body), font size scale (pt), spacing scale (px), **default page background** (site-wide base canvas; see §1a), **default media container radius** (one value, four corners, link/unlink), default section padding, button hover set, breakpoints. **Section radius is not at theme level**—sections use default 0 px and manual control only (see §1). No overrides at section/block for “definition” items (palette, font list, breakpoints, hover set).
- **Page level:** Optional override of theme default page background. Page Settings panel (separate from section controls); explicit “Use theme default” vs “Custom background.” When custom is enabled, it renders behind all sections on that page (§1a).
- **Section level:** Width, section padding (top/bottom, left/right), section background (sits on top of page background; see §1a). **Section border radius** is section-only: default 0 px, manual control near bottom of settings; not from theme.
- **Block level:** All content and per-item choices—text (font, size, weight, color, alignment), button (label, URL, style, color, size, radius, width, height, hover), **media** (fit, max dimensions, **radius**: inherit theme default or override with same four-corners + link/unlink). Override UI applies wherever a theme default exists and a section/block value is allowed.

**Override UI (define separately):** A dedicated UI for overriding theme settings must be defined. High-level requirements:
1. “Use theme default” vs “Custom” per control (or per group).
2. Clear visual state when a value is overridden.
3. Easy reset to theme default.
4. Panel structure: viewport → theme/defaults → section/block, with overrides clearly scoped.
5. Do not offer overrides for theme-only things (palette, font list, breakpoints, hover set).

---

## 11. Responsive (desktop, tablet, mobile)

- **Viewport switcher at top** (see §0): Desktop, tablet, mobile always visible; desktop cascades down; mobile can optionally “push up” a value to tablet/desktop.
- **Every visual control considered per breakpoint:** Padding, font size (pt), visibility, width, and media fit/max dimensions can have desktop, tablet, and mobile values where it makes sense.
- **Breakpoints:** Theme or platform defines desktop/tablet/mobile breakpoints; builder uses them so “desktop” and “tablet” and “mobile” are consistent everywhere.

---

## 12. Optional but recommended

- **Container (inner):** If the section has an inner wrapper, same controls as section: background (theme + picker), padding (top/bottom and left/right, each with link/unlink, slider 1–100 px), border radius (four corners, link/unlink, slider 1–100 px), per breakpoint as needed.
- **Accessibility (baseline requirement):** Every section must meet these basics: (1) **Alt text for images**—every image has a short text description for screen readers and when the image fails to load; (2) **Focus states and semantics for buttons and links**—visible focus indicator (e.g. outline or ring) when tabbing, and correct roles so assistive tech recognizes interactive elements. Document accessibility as a baseline requirement so all sections comply.

---

## 12a. Required: Placeholders and defaults

- **New sections and blocks must never be blank.** They always inherit placeholder text, placeholder media, and other defaults so the Page Editor never shows an empty or broken state. This is required, not optional.
- **Default placeholders:** When creating a section or block, use consistent, simple defaults: **Text blocks**—e.g. “Heading” or “Your heading here” for headers, “Body text here” or similar for body; **Media blocks**—theme or system placeholder image (e.g. neutral gray or theme-defined placeholder) when no asset is selected; **Buttons**—e.g. “Button” or “Learn more” as default label. Define these at theme or platform level so every section and block type has a clear fallback; editors replace placeholders with real content.

---

## 13. Schema and editor behavior

- **Schema order (fixed where possible):** Settings always appear in the **same order** across sections so users know where to find things. Use a **hierarchy** to distinguish:
  - **Always present (when applicable):** Viewport switcher; section width; section padding (top/bottom, left/right); section background; then blocks (header, body, button, media, etc.) with their controls in a consistent order per block type. **Section border radius** appears **very near the bottom** of the section settings (low priority), since default is 0 px and it’s manual per section. (Page background: theme default + optional override in **Page Settings** panel, separate from section controls; see §1a.)
  - **Section-specific/custom:** Any settings unique to a given section (e.g. testimonial quote style, product picker) come after the standard set, in a logical group (e.g. “Section options” or under the block type they affect). Document the standard order so custom sections extend it rather than reordering.
- **Labels and defaults:** Clear labels and safe defaults; slider 1–100 px and pt values have sensible defaults; “Use theme default” where applicable.
- **Presets:** Section presets (e.g. “Hero with one CTA”, “Two-column with image”) that use the same baseline controls and block model.

---

## Summary: “Every section, every time”

| Area | Baseline expectation |
|------|------------------------|
| **Viewport** | Desktop, tablet, mobile at top; desktop cascades down; mobile can push up; preview matches selected viewport (scale if needed). |
| **Backgrounds** | Theme: default page background (site-wide, Theme Settings). Page: optional override in Page Settings panel (“Use theme default” vs “Custom”). Section: section background on top of page background; full-width can cover it, constrained shows through (§1a). |
| **Section** | Width; padding top/bottom and left/right (each with link/unlink, slider 1–100 px); section background (color, image, video); section border radius default 0 px, manual control near bottom of settings (four corners, link/unlink, slider 1–100 px)—not theme-level. |
| **Theme** | Options expand with theme (colors, fonts); color picker on every color control; font by name + role (§2b); color by custom name or hex; parity with builder. |
| **Override UI** | Define UI for overriding theme; use five points in §10a (default vs custom, visual state, reset, panel structure, no override for theme-only). |
| **Text** | All text as blocks (Header, Body); Body WYSIWYG includes links (resources + custom URL); font (name + role), size (pt), weight, color, alignment. |
| **Media** | From Fluid DAM; fit-to-height, fit-to-width, match aspect ratio + max dimensions; use everywhere except where layout would break. Border radius: theme has one default (four corners, link/unlink); block overrides with same UI—no theme “options,” just default + block override. |
| **Buttons** | All buttons are blocks; per-block: label, URL, style, color, size, border radius (slider 1–100 px), width/height; hover from theme. |
| **Padding/radius** | Slider 1–100 px. Padding = two settings (top/bottom, left/right) with link/unlink each. Section radius = section-only, default 0 px, near bottom of settings (four corners, link/unlink). Media radius = theme default (one value, four corners) + block override with same UI. |
| **Schema** | Same order where possible; hierarchy: always-present vs section-specific; see §13. |
| **Block positioning** | Section/group level (layout, alignment, gap); no free-form per-block position by default; limited overrides only where section type allows (§9b). |
| **Required: Placeholders** | New sections/blocks never blank; always inherit placeholder text, media, etc. Defaults: e.g. “Heading”/“Body text here,” theme/system placeholder image, “Button”/“Learn more” (§12a). |

Use this as the starting checklist when adding or refactoring a section; add section-specific controls on top of this baseline so behavior and naming stay consistent across the builder.