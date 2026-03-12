# FLUID WE-COMMERCE — WEBSITE BUILD PROMPT
### Full Page-by-Page Copy, Structure & Design Direction
*Use this document to build all pages in the Fluid web builder. Do NOT copy any HTML from this document — interpret each section using the builder's native components, blocks, and Liquid templating.*

---

## HOW TO USE THIS DOCUMENT

This document contains:
1. **Exact copy** — use the text as written
2. **Section structure** — the order and purpose of every block on every page
3. **Design direction** — how to visually style each section using the brand's visual language
4. **Interactive notes** — animations, hover states, CTAs, and behaviors

**Visual style reference:** The brand uses a dark, editorial aesthetic. Black backgrounds. Bold Syne/display typography. Monospace (Space Mono or similar) for labels and data. A hand-crafted energy expressed through: rough paint-stroke SVG underlines on key words, large ghost numbers behind content blocks, thin 1px grid lines separating modules, and sharp orange/blue/green accent colors. No soft shadows, no rounded cards, no gradients on text. Think editorial magazine meets technical precision.

**Color system:**
- Background primary: `#050505` / `#0a0a0a`
- Background mid: `#111` / `#161616`
- Text primary: `#f5f0e8` (warm off-white)
- Accent orange: `#FF5500` — action, urgency, emphasis
- Accent blue: `#00AAFF` — navigation, technical, links
- Accent green: `#00E87A` — success, confirmation
- Text secondary: `#888`
- Borders/dividers: `#1a1a1a` / `#222`

**Typography:**
- Display/headline: Syne ExtraBold (800 weight) — all major headings
- UI/body: DM Sans — body copy, descriptions
- Labels/data/metadata: Space Mono — eyebrow text, stat labels, tags, CTAs in context

**Key visual elements to implement throughout:**
- **Paint-stroke underline:** An SVG brush-stroke shape drawn under a single key word in a hero headline. Appears in orange or blue. Animates "drawing in" on page load. One per hero section maximum.
- **Ghost large text:** Very large (100px+), very low opacity (~4–6%), monospace or display text in the background behind a content block. Creates depth. Examples: the word "DS" behind the homepage hero, "01" "02" behind feature cards.
- **Orange bar accent:** A 48px wide × 4px tall orange rectangle that appears above an eyebrow label to signal a new section. Rough/painted appearance.
- **Oval/circle callout:** An imperfect hand-drawn ellipse outline around a key stat or label. Used in social templates around "NEW PARTNER ALERT" and similar. Used on web for key metrics.
- **1px grid separators:** Modules separated by single-pixel lines, no spacing gap — creates a cage/grid visual effect.
- **Monospace eyebrow text:** Small, letter-spaced, all-caps label above section headlines. Color: brand blue.

---

## GLOBAL ELEMENTS

### STICKY NAVIGATION

**Behavior:** Sticky on scroll. On scroll past hero: add subtle bottom border.

**Layout (left to right):**
- Left: "FLUID" wordmark — Syne ExtraBold
- Center: Navigation links
- Right: "Log in" (text link) + "Book a Demo" (primary orange CTA button)

**Navigation links:**
- Platform *(dropdown)*
- Why We-Commerce
- Solutions *(dropdown)*
- Customers
- Blitz Week
- Pricing

**Platform dropdown items:**
Fair Share · Fluid Payments · Mobile App · Desktop App · Live Website Editor · Live Shopping · Sync Tool

**Solutions dropdown items:**
For CEOs / Founders · For VP of Sales / Field Leaders · For CTOs · For COOs / Operations · For Enterprise

**CTA button copy:** `Book a Demo`
*This button is always orange. Never changes color. Always visible.*

**Mobile behavior:** Hamburger icon collapses to full-screen dark overlay menu.

---

### GLOBAL FOOTER

**Top of footer — mini CTA block:**
- Eyebrow (monospace, blue): `Every transaction matters.`
- Headline (Syne Bold): `The only platform built for how direct selling actually works.`
- CTA button (orange): `Book a Demo`

**Footer link columns:**

**Column 1 — Brand:**
- "FLUID" wordmark
- Body text: *"We-Commerce infrastructure for direct selling companies who refuse to treat their reps and customers as statistics."*

**Column 2 — Platform:**
Fair Share · Fluid Payments · Mobile App · Desktop App · Live Editor · Live Shopping · Sync Tool

**Column 3 — Company:**
Why We-Commerce · Customers · About · Blitz Week · Careers

**Column 4 — Resources:**
Developer Docs · Status · Security · Privacy Policy · Terms of Service

**Footer bottom bar:**
- Left: `© 2026 FLUID WE-COMMERCE. ALL RIGHTS RESERVED.`
- Right: `LEHI, UTAH`

---

## PAGE 01 — HOMEPAGE
**URL:** `/`
**Goal:** Establish category ownership, create urgency/FOMO, drive demo bookings.
**Narrative arc:** Category claim → Problem agitation → Solution overview → Proof → Feature spotlights → Objection handling → Closing CTA

---

### SECTION H.01 — HERO
**Type:** Full-viewport height section. Dark background.

**Eyebrow label (monospace, blue, all-caps, letter-spaced):**
`The We-Commerce Platform`

**Headline (Syne ExtraBold, very large — 60–72px desktop):**
`The Only E-Commerce Platform Built Specifically for Direct Selling.`

*Design note: "Direct Selling" should have a paint-stroke underline (orange, hand-drawn SVG, animates drawing-in on load).*

**Body text (DM Sans, 17–18px, secondary text color):**
`Shopify was built for selling candles to strangers. You're building a network where every transaction creates ripple effects through an entire organization. That's a different game. We built the only platform that plays it.`

**CTAs:**
- Primary button (orange): `Book a Demo`
- Secondary button (outlined/ghost): `Watch 2-min Overview ▶`

**Below CTAs — small text (monospace, very dark gray):**
`NO LENGTHY IMPLEMENTATION. NO IT TICKETS.` + orange text: `BLITZ WEEK GETS YOU LIVE IN DAYS.`

**Scroll indicator:** Thin vertical animated line with small "SCROLL" monospace label. Positioned bottom-right.

**Visual direction:**
- Jet black background
- Subtle orange radial glow top-right, very low opacity
- Large ghost text "DS" bottom-left, ~4% opacity, Syne ExtraBold — creates depth layer
- On mobile: headline 38–42px, CTAs stack vertically

---

### SECTION H.02 — SOCIAL PROOF BAR
**Type:** Horizontal logo strip. Slightly lighter dark background than hero.

**Label text (monospace, very dark gray, all-caps):**
`Trusted by direct selling companies in 50+ countries`

**Content:** Row of 6–8 partner/customer logos in white/light-gray treatment. Auto-scrolling marquee on mobile. Static row on desktop.

*Note: Logos should appear slightly desaturated — confidence, not desperation.*

---

### SECTION H.03 — THE PROBLEM
**Type:** Pain agitation section. Dark background.

**Orange bar accent** appears above eyebrow.

**Eyebrow (monospace, blue):**
`Sound familiar?`

**Headline (Syne ExtraBold, ~42px):**
`About half of all direct selling transactions can't even happen on Shopify.`

**Below headline — small dramatic line (monospace, italic, very dark gray):**
`Read that again.`

**6-card grid (3 columns, 2 rows — 1px grid separator style, no gap between cards):**

Card 1:
- Number label: `01`
- Title: `Payments decline at higher rates`
- Body: *"Your industry is flagged as "higher risk." A 3–4% failure rate becomes 6–8% for you. On a million dollars monthly, that's $50,000 in lost transactions. Every month."*

Card 2:
- Number label: `02`
- Title: `Attribution breaks and reps stop sharing`
- Body: *"A rep drives a prospect to your site. They come back through Google three weeks later. Who gets credit? Nobody — or the wrong person. That rep never shares again."*

Card 3:
- Number label: `03`
- Title: `You're managing 15 vendors. Not building a business.`
- Body: *"Payments here, commissions there, mobile app somewhere else. You spend all your time keeping the Frankenstein alive instead of growing."*

Card 4:
- Number label: `04`
- Title: `Beautiful content sits unused`
- Body: *"Your marketing team creates assets nobody shares. Reps don't trust they'll get credit, so they build bootleg versions — or go quiet entirely."*

Card 5:
- Number label: `05`
- Title: `15-click checkouts kill conversions`
- Body: *"Someone's ready to buy. The checkout wants them to create an account. They're at a red light. The moment passes. You'll never know that sale almost happened."*

Card 6:
- Number label: `06`
- Title: `Sync failures corrupt your commissions`
- Body: *"The order went through on the site but didn't reach the commission engine. Now you're manually fixing records while reps lose faith that anything works."*

**Closing statement (centered, large — Syne Bold):**
`Every one of these is a transaction that should have happened.`

**Closing body text (centered, DM Sans):**
`We built We-Commerce around a single, uncompromising principle: Every transaction matters. Not most. Not the easy ones. Every single one.`

**Visual direction:**
- Card number labels are large, ghost/faded — enormous monospace numbers barely visible in card background
- Cards animate fade-up in stagger sequence on scroll
- "Every transaction matters" in the closing statement should be bold/white — emphasized

---

### SECTION H.04 — THE SOLUTION
**Type:** Two-column split. Left: narrative copy. Right: product module grid.

**Left column:**

Orange bar accent above eyebrow.

Eyebrow (monospace, blue): `One Platform. Zero Duct Tape.`

Headline (Syne ExtraBold, ~36px):
`Everything Shopify gives you for e-commerce — plus everything direct selling actually needs.`

Body:
`Enrollments, subscriptions, logged-in shopping, rep attribution, commission sync, mobile apps. All in one connected system. No middleware that breaks at 3am. No single points of failure. No IT cycles every time you want to change a landing page.`

Text link (blue, monospace, with → arrow):
`Explore the Full Platform →`

**Right column — Product module grid:**
2×3 grid of module cards (1px separator style):

| Tag | Product Name | One-liner |
|-----|-------------|-----------|
| Attribution | Fair Share™ | Full-journey tracking. Reps trust it. |
| Payments | Fluid Payments | Cascading retry. Never give up. |
| Mobile | Mobile App | Fully branded. Drag-and-drop built. |
| Website | Live Editor | Launch pages in minutes. Not weeks. |
| Data Sync | Sync Tool | One connection to your back office. |
| Commerce | Live Shopping | Demo. Sell. Attribute. In one stream. |

Below grid — small monospace text, very dark:
`+ DESKTOP APP · AI TOOLS · DROPLET MARKETPLACE`

**Visual direction:**
- Right column module grid uses 1px separator technique — dark cells in a cage/grid
- Module tag text in brand blue
- On hover over each module: faint background color shift, blue border glow appears

---

### SECTION H.05 — PROOF NUMBERS
**Type:** Full-width stats strip. Mid-dark background.

4 stats in a row, each with colored left-border accent (painted-line style):

Stat 1 (orange border):
- Number: `~50%`
- Label: `of direct selling transactions can't be processed by Shopify`

Stat 2 (blue border):
- Number: `6×`
- Label: `payment retry attempts before we give up. Most platforms try once.`

Stat 3 (green border):
- Number: `1 week`
- Label: `average time to go live with Blitz Week. Industry standard is 90 days.`

Stat 4 (orange border):
- Number: `50+`
- Label: `countries. One connected platform. No per-region rebuilds.`

**Visual direction:**
- Numbers in Syne ExtraBold, very large (~52px)
- Label text in DM Sans, small, gray
- Numbers animate counting-up on scroll-into-view
- On mobile: 2×2 grid

---

### SECTION H.06 — FAIR SHARE SPOTLIGHT
**Type:** Two-column. Left: copy. Right: attribution journey diagram.

**Left column:**

Orange bar accent above eyebrow.

Eyebrow (monospace, blue): `Fair Share™ — The Unique IP`

Headline (Syne ExtraBold, ~34px):
`Attribution isn't a technical problem. It's a trust problem.`

Body:
`Your reps don't share because they don't trust they'll get credit. So they go silent. And without reps in motion, your traffic engine dies.`

Body:
`Fair Share doesn't just track the last click. It tracks the entire journey. First touch. Multiple touchpoints. Cross-device. And if they come back through a Google search three weeks later — your rep still gets credit.`

Body:
`When reps trust the system, they share. When they share, you get traffic. Simple as that.`

Text link (blue, →):
`Learn about Fair Share →`

**Right column — Attribution journey diagram:**
Dark card. Label at top (monospace): `Fair Share Attribution Journey`

4-step vertical list (numbered circles):

Step 1 (active — blue circle):
- Title: `Rep shares content`
- Detail: `Personalized Fair Share link with rep identity attached`

Step 2 (inactive — gray circle):
- Title: `Prospect clicks & browses`
- Detail: `Time spent, pages viewed, cross-device behavior — all tracked`

Step 3 (inactive — gray circle):
- Title: `3 weeks later — Google search`
- Detail: `Customer returns through organic search. Other platforms lose the attribution.`

Step 4 (success — green circle, checkmark):
- Title (green): `Rep gets credited. Automatically.`
- Detail: `No spreadsheets. No disputes. No lost trust.`

**Visual direction:**
- Steps animate in sequence on scroll (staggered delays)
- Active/success circles in brand colors; inactive in gray
- Step 4 has a faint green glow effect

---

### SECTION H.07 — PAYMENTS STORY
**Type:** Full-width pull quote, then two-column.

**Pull quote block (full width):**

Blockquote (Syne ExtraBold, large — ~34px):
`"When a transaction fails in e-commerce, you lose a sale. When a transaction fails in direct selling, you might lose a career."`

Attribution (monospace, small, gray):
`— FLUID WE-COMMERCE MANIFESTO`

*Design note: "lose a career" should be set in brand blue — emotional emphasis within the quote.*

---

**Below pull quote — two-column:**

**Left column — cascading payment diagram:**
Dark technical card. Label (monospace): `Cascading Payment Intelligence`

Visual sequence (terminal/code aesthetic — monospace labels, structured rows):

Row 1: `Attempt 1 · Processor A` → `DECLINED` (red)
Row 2: `Attempt 2 · Processor B` → `DECLINED` (red)
Row 3: `Attempt 3 · Processor C — different routing` → `APPROVED ✓` (green)

Below rows, small monospace text:
`Up to 6 merchant accounts. Customer never knows. Sale goes through.`

**Right column:**

Orange bar accent.

Headline: `We don't give up on a transaction. We try up to six times.`

Body:
`Six different merchant accounts, each optimized for different scenarios. When Processor A declines, we try Processor B. Different card network rules? We route accordingly. We've recovered transactions that would have been permanent losses anywhere else.`

Body:
`Apple Pay. Google Pay. Buy Now Pay Later. No forced account creation. Every unnecessary field is a transaction at risk — so we removed them.`

Text link (blue, →): `See how Fluid Payments works →`

**Visual direction:**
- Pull quote section: very large type, left-aligned, italic "lose a career" in blue
- Payments diagram uses terminal/code aesthetic — monospace, structured, very dark background
- "DECLINED" in red; "APPROVED" in green — clear visual signal

---

### SECTION H.08 — CUSTOMER QUOTE (Dan England)
**Type:** Two-column. Left: photo. Right: quote.

**Left column:**
Photo of Dan England. Gradient overlay at bottom of photo. Name and title overlaid at photo bottom.
- Name: `Dan England` (Syne ExtraBold)
- Title: `VP Payments + Risk` (monospace, orange, all-caps)

*Design note: This name/title treatment matches the "welcome card" style in Fluid's social media templates — name bold white, role in orange below.*

**Right column:**

Quote (Syne ExtraBold, ~34px, no quotation mark graphic needed):
`"I get it now. You guys just had the cojones to build all the pieces direct sales needs in one system."`

Attribution (monospace, small, gray):
`— DAN ENGLAND, VP PAYMENTS + RISK`

Text link (blue, →): `Read more customer stories →`

---

### SECTION H.09 — PLATFORM FEATURE TABS
**Type:** Tab interface with switching content panel.

**Eyebrow (monospace, blue):** `Everything Your Business Needs`

**Headline:** `One platform. No integration headaches. No mystery scripts.`

**Tab labels:**
Fair Share™ · Payments · Mobile App · Live Editor · Live Shopping · Sync Tool

**Default active tab: Fair Share™**

Tab content (two-column: copy left, product demo video/screenshot right):

**Headline:** `Your reps deserve to trust the system. Fair Share makes that possible.`

**Body:**
`Every piece of company content — videos, articles, PDFs — becomes a personalized, trackable link for each rep. They add their face and story. Customers see a human they trust. Everything is attributed automatically.`

**Body:**
`Complex scenarios handled: multiple reps sharing to one buyer, orphan sign-ups, previously sponsored customers. You set the rules. The system executes them.`

**Button (outlined/ghost):** `Learn about Fair Share →`

**Right column:** Product demo video embed or screenshot.

*Replicate this two-column content pattern for each tab, adjusting headline and body copy to reflect that product's core value proposition.*

**Visual direction:**
- Active tab: brand blue bottom border
- Tab switching: fast crossfade
- Video placeholder uses a play button with orange circle outline
- On mobile: tabs become horizontally scrollable

---

### SECTION H.10 — BLITZ WEEK CALLOUT
**Type:** Full-width, solid orange background. This is the one section that breaks from black.

**Eyebrow (monospace, white/60% opacity):**
`Switching doesn't have to be scary`

**Headline (Syne ExtraBold, ~48–52px, white):**
`We'll get you live in one week. Not 90 days. One week.`

**Body (DM Sans, 17px, white/80% opacity):**
`Blitz Week is an intensive 4-day launch at our headquarters in Lehi, Utah. You leave with your platform live. Fully configured. Production-ready. For partners on a 3-year agreement — it's 100% free.`

**CTAs:**
- Primary button (white background, orange text): `Learn About Blitz Week`
- Text link (white/70%): `Book a Demo First →`

**Visual direction:**
- Full brand orange (#FF5500) background — bold, confident, unexpected
- Semi-transparent white brush-stroke/ellipse shapes in background for texture (low opacity, rotated)
- On mobile: headline 32px, CTAs stack vertically

---

### SECTION H.11 — SECOND CUSTOMER QUOTES
**Type:** Two-column quote cards.

**Quote card 1 (blue left-border):**
> *"My favorite spicy feedback from this week: 'I get it now; you guys just had the cojones to build all the pieces direct sales needs in one system.'"*
>
> — MIKE TINGEY, CEO · FLUID WE-COMMERCE

**Quote card 2 (orange left-border):**
> *"Teqnavi's leadership return coincides with a major strategic partnership — and Fluid is how we're scaling everything that comes next."*
>
> — HOLLY MCKINNEY, CO-FOUNDER · TEQNAVI

---

### SECTION H.12 — CLOSING CTA
**Type:** Full-width, centered, black background.

**Eyebrow (monospace, blue, centered):** `Ready to stop fighting your technology?`

**Headline (Syne ExtraBold, ~38px, centered, max-width ~700px):**
`The fastest-growing direct selling companies have already figured this out.`

**Body (DM Sans, centered, max-width ~560px):**
`The gap between leaders and laggards is widening every quarter. Your competitors are launching campaigns in hours while you're waiting 90 days for IT.`

**CTAs (centered):**
- Primary button (orange): `Book a Demo`
- Text link (blue, →): `Read the We-Commerce Manifesto →`

---

## PAGE 02 — WHY WE-COMMERCE EXISTS
**URL:** `/why-we-commerce`
**Goal:** Win over the skeptical CEO and founder. This is a manifesto/vision page — not a product page. Heavy narrative. Designed to make people feel something, then believe.
**Narrative arc:** Opening declaration → Challenge to conventional wisdom → The human stakes → The authenticity argument → The flywheel → Closing mission statement

---

### SECTION W.01 — HERO
**Type:** Full-viewport. Black background.

**Visual element:** Scrolling horizontal marquee text that fills a band above the hero copy:
- Text: `EVERY TRANSACTION MATTERS` (repeating)
- Style: Syne ExtraBold, very large (~80px), very dark gray (#111) — barely visible, like a watermark
- Behavior: auto-scrolls horizontally, continuous loop

**Below marquee:**

**Eyebrow (monospace, blue):** `Why We-Commerce Exists`

**Headline (Syne ExtraBold, ~50px, max-width ~850px):**
`Most e-commerce platforms were built for ads and anonymous checkout. We-Commerce was built for people.`

*Design note: "people" gets a paint-stroke underline in brand blue.*

**Body (DM Sans, 17px):**
`They assume customers arrive alone, click alone, and buy alone. We built something different — for sharing products you believe in, recommending them to friends, and celebrating purchases together.`

---

### SECTION W.02 — CHALLENGE THE CONVENTIONAL WISDOM
**Type:** Two-column. Left: editorial copy. Right: comparison table.

**Left column:**

Orange bar accent above.

**Headline (Syne ExtraBold, ~36px):**
`The conventional wisdom is wrong.`

**Body:**
`Everyone tells direct selling companies to use Shopify. Or Stripe. Or Square. "That's what real e-commerce companies use," they say.`

**Body:**
`But here's the thing: you're not a real e-commerce company. You're something different. Something those platforms weren't built for. And pretending otherwise is costing you more than you realize.`

**Closing line (white, DM Sans Medium):**
`Shopify optimized for traffic. We-Commerce optimized for relationships.`

**Right column — Comparison table:**
*Label (monospace, small, gray): "Shopify handles guest checkout well. That's 15–25% of direct selling revenue. We handle the rest."*

| Capability | Shopify | Fluid |
|---|---|---|
| Rep attribution & credit | — | ✓ |
| Multi-level subscriptions | — | ✓ |
| Commission engine sync | — | ✓ |
| Logged-in rep purchasing | Partial | ✓ |
| Cascading payment retry | — | ✓ |
| Single global storefront | Separate stores per country | ✓ |
| Mobile app (no-code) | — | ✓ |

*Visual: checkmarks in green, dashes in dark gray. "Fluid" column header in brand blue.*

Footer note below table (monospace, very small):
`Shopify is great at what it was built for. It just wasn't built for this.`

---

### SECTION W.03 — THE HUMAN STAKES
**Type:** Single-column narrative. Black background. Generous margins. Max-width ~800px, centered.

Orange bar accent above.

**Eyebrow (monospace, blue, centered):** `Why every transaction matters`

**Story block 1:**

*Opening line (Syne SemiBold, ~22px):*
`We think about the mom who placed her first order at 11:47pm while nursing her baby.`

*Body:*
`She's finally ready to try the products her sister won't stop talking about. If that transaction fails — if the page times out, or her card declines, or she can't figure out who to contact — she's not coming back. And her sister, your rep, just lost the person who might have become her best customer.`

*Body:*
`That's not a 2% decline rate. That's a dream that died in checkout.`

---

*[Thin horizontal divider line between story blocks]*

---

**Story block 2:**

*Opening line (Syne SemiBold, ~22px):*
`We think about the rep who's a mom of four.`

*Body:*
`Her husband works long hours. She started this business for flexibility and extra income. Every commission check matters. When a transaction fails — or when she doesn't get credit for a sale she drove — that's not a rounding error.`

*Body:*
`That's groceries. That's her daughter's dance lessons. That's her belief that this business can work for her.`

---

**Closing declaration (Syne ExtraBold, ~24px, centered):**
`Shopify doesn't think about her. Stripe doesn't know she exists.` *(standard white)*
`We built every feature of this platform with her in mind.` *(orange)*

**Visual direction:**
- This section is intentionally text-heavy — let the writing breathe
- Very wide margins, centered text block
- Body copy uses DM Sans 17px, generous line-height (1.7)
- Story blocks separated by thin horizontal lines — like chapters
- Closing declaration is a visual and emotional climax — set it apart with extra vertical space above

---

### SECTION W.04 — THE AUTHENTICITY ADVANTAGE
**Type:** Two-column. Left: copy. Right: callout card + 2×2 pillar grid.

**Left column:**

Orange bar accent above.

**Eyebrow (monospace, blue):** `The Authenticity Advantage`

**Headline (Syne ExtraBold, ~34px):**
`The internet is drowning in AI-generated reviews, bot followers, and synthetic content.`

**Body:**
`Consumers are exhausted. They can't tell what's real anymore. Trust in digital commerce is collapsing. But there's one thing they still trust: recommendations from people they actually know.`

**Body:** `That's not nostalgia. That's the future of commerce.`

**Body (white, Medium weight):**
`Direct sales isn't old-fashioned. It's ahead of its time. While everyone else is trying to figure out how to make AI feel human, you've already got real humans building real relationships.`

**Body:**
`We built Fluid to power that — and to give it modern infrastructure so it can scale.`

**Right column:**

Featured quote card (dark background, orange top-border accent):
- Label (monospace, orange): `THE SHIFT HAPPENING NOW`
- Quote (Syne Bold, ~20px): *"In an age of AI slop, authenticity is the ultimate competitive advantage. And you can't automate authenticity."*

2×2 grid of "pillar" cards (very dark background, thin borders):
- Card 1: `Real people` / *Not AI avatars or bots*
- Card 2: `Real trust` / *Built through relationships*
- Card 3: `Real UGC` / *From people who love the products*
- Card 4: `Real scale` / *Powered by Fluid infrastructure*

*Visual: "Real people / Real trust / Real UGC / Real scale" in Syne ExtraBold, large — these read as declarations, not descriptions.*

---

### SECTION W.05 — THE FLYWHEEL
**Type:** Full-width, centered, dark background.

Orange bar accent above (centered).

**Eyebrow (monospace, blue, centered):** `How it all works together`

**Headline (Syne ExtraBold, ~36px, centered, max-width ~700px):**
`Content fuels sharing. Sharing fuels traffic. Traffic fuels conversions. Conversions create new content.`

**Body (DM Sans, centered, max-width ~600px):**
`The flywheel spins — powered not by ads, but by people. And unlike ad spend, it compounds.`

**4-step grid (4 columns, 1px separator style):**

| | Step | Title | Body |
|--|------|-------|------|
| `01` | Content | Rep shares a video, story, or testimonial via Fair Share link |
| `02` | Sharing | Prospect sees rep's face, story, and creative. Trust builds instantly |
| `03` | Conversion | Checkout is one click. Rep is credited automatically. Everyone wins |
| `04` (green) | New Content ↩ | New customer creates testimonial. Flows back into the hub. Cycle accelerates |

Footer text (monospace, very dark): `THE FLYWHEEL SPINS FASTER EVERY TIME.`

**Visual direction:**
- Step numbers are enormous (~60px), very low opacity — ghost numbers in background
- Step 04 is set in green to signal "loop back" — differentiate from prior steps
- The ↩ arrow on Step 04 animates on scroll (rotates, suggests cyclical motion)
- On mobile: 2×2 grid

---

### SECTION W.06 — CLOSING STATEMENT
**Type:** Full-width, centered, black background.

**Headline (Syne ExtraBold, ~42px, centered, max-width ~800px):**
`Just people, selling to people — with a system that finally reflects how commerce actually works.`

**Body (DM Sans, centered, max-width ~560px):**
`This is why We-Commerce exists. This is why we built Fluid. And this is why every transaction matters.`

**CTAs (centered):**
- Primary button (orange): `See the Platform`
- Secondary button (outlined): `Book a Demo`

---

## PAGE 03 — FAIR SHARE™ PRODUCT PAGE
**URL:** `/platform/fair-share`
**Goal:** Convert VP of Sales and Field Leaders. Make the attribution trust problem undeniable, then show the solution.

---

### SECTION FS.01 — HERO

**Eyebrow (monospace, blue):** `Fair Share™ — Attribution & Content Sharing`

**Headline (Syne ExtraBold, ~52px, max-width ~800px):**
`Your reps aren't sharing because they don't trust they'll get credit.` *(white)*
`Fair Share fixes that.` *(orange)*

**Body:**
`Every piece of company content becomes a personalized, trackable link. Every click, view, and purchase is attributed — automatically — to the rep who made it happen. No spreadsheets. No disputes. No lost trust.`

**CTAs:**
- Primary (orange): `Book a Demo`
- Text link (blue): `See how attribution works →`

---

### SECTION FS.02 — HOW IT WORKS
**Type:** 3-column feature card grid (1px separator style).

Card 1:
- Icon block (blue)
- **Title:** `Every piece of content, instantly shareable`
- **Body:** *"Videos, articles, PDFs, product pages — all become personalized, trackable links. Reps add their face and story on top. The rest stays locked and on-brand."*

Card 2:
- Icon block (orange)
- **Title:** `Full-journey attribution. Not just last-click.`
- **Body:** *"First touch, multiple touchpoints, cross-device, delayed purchases. If they come back through Google three weeks later — your rep still gets credit."*

Card 3:
- Icon block (green)
- **Title:** `Configurable for complex scenarios`
- **Body:** *"Multiple reps sharing to one buyer, orphan sign-ups, previously sponsored customers. You set the rules. The system executes them — automatically."*

---

### SECTION FS.03 — WHAT CHANGES
**Type:** Full-width. Orange bar accent. 2×2 benefit grid.

**Eyebrow (monospace, blue):** `What changes when reps trust the system`

**Headline (Syne ExtraBold, ~32px, max-width ~600px):**
`When reps trust they'll get credit — they share. And when they share, your traffic engine turns on.`

**2×2 benefit grid (each with title + body, separated by thin lines):**

Benefit 1:
- **Title:** `Reps stop building bootleg versions of your marketing`
- **Body:** *"Your top reps have been creating their own tracking spreadsheets and homemade pages. Fair Share replaces all of that with one clean, trusted system."*

Benefit 2:
- **Title:** `Your marketing investment starts working`
- **Body:** *"Beautiful content was sitting unused because reps didn't see the point. Now they share it — because they know their effort will be rewarded."*

Benefit 3:
- **Title:** `You end the world's most pointless civil war`
- **Body:** *"Reps and corporate have been quietly working against each other for years. Fair Share puts them on the same side. When everyone knows the system works — everyone shows up."*

Benefit 4:
- **Title:** `Full visibility into who's driving results`
- **Body:** *"No more guesswork. See exactly what's being shared, what's converting, and which reps are moving the needle — at every stage of the funnel."*

---

## PAGE 04 — FLUID PAYMENTS
**URL:** `/platform/payments`
**Goal:** Make the financial case to CFO/COO. Show hidden cost of bad payments, then present the solution.

---

### SECTION P.01 — HERO

**Eyebrow (monospace, blue):** `Fluid Payments — Payment Infrastructure for Direct Selling`

**Headline (Syne ExtraBold, ~50px, max-width ~800px):**
`Payments are the quiet ending to every story in commerce. When they fail,` *(white)*
`everything that came before them stops mattering.` *(orange)*

**Body:**
`We don't treat failed transactions as acceptable losses. We've built a system that adapts in real time, retries intelligently, and makes sure that when a customer is ready to buy — the system is ready too.`

**CTAs:**
- Primary (orange): `Book a Demo`
- Text link (blue): `See the technical specs →`

---

### SECTION P.02 — THE HIDDEN COST
**Type:** Two-column. Left: copy. Right: cost calculator card.

**Left column:**

Orange bar accent above.

**Headline:** `A 3–4% decline rate sounds manageable. For you, it's 6–8%.`

**Body:**
`Your industry is classified as "higher risk" by payment processors. That means your baseline acceptance rate is already lower than a typical D2C brand.`

**Body:**
`On $1M in monthly volume, you might be losing an extra $30,000–$50,000 to failed transactions. Every single month. That's not a rounding error. That's a business problem hiding in plain sight.`

**Right column — cost card:**
Dark card. Label (monospace): `THE REAL COST OF BAD PAYMENTS`

Data rows:
- Monthly volume: `$1,000,000`
- Industry avg decline rate: `6–8%` (red)
- Standard platform decline rate: `3–4%` (red)
- **Extra monthly losses: `$30–50K`** (large, orange)

Warning block below (dark orange background):
`= $360K–$600K per year in preventable losses`

---

### SECTION P.03 — HOW FLUID PAYMENTS WORKS
**Type:** 2×2 feature card grid.

**Eyebrow (monospace, blue):** `Fluid Payments — How It Works`

**Headline:** `Invisible when it works. Relentless when it doesn't.`

Card 1:
- **Title:** `Cascading payment intelligence`
- **Body:** *"If a transaction fails, we don't stop. We automatically retry across up to 6 approved payment paths — quietly, without the customer ever needing to start over."*

Card 2:
- **Title:** `One-click checkout everywhere`
- **Body:** *"Apple Pay, Google Pay, saved payment methods, Buy Now Pay Later — all built in. No forced account creation. No unnecessary fields. Every extra step is a transaction at risk."*

Card 3:
- **Title:** `Built for higher-risk commerce`
- **Body:** *"Direct selling transactions are often flagged unfairly by traditional processors. Fluid is designed for these realities — infrastructure that understands the category instead of punishing it."*

Card 4:
- **Title:** `Payments that respect attribution`
- **Body:** *"Every successful transaction ties back to Fair Share automatically. The right rep is credited every time — without reconciliation, guesswork, or disputes."*

---

## PAGE 05 — BLITZ WEEK
**URL:** `/blitz-week`
**Goal:** Turn the #1 objection (switching is scary, takes forever) into the most exciting thing about Fluid.

---

### SECTION BW.01 — HERO

**Eyebrow (monospace, blue):** `Blitz Week — Your Fast Track to Launch`

**Headline (Syne ExtraBold, ~56px):**
`Traditional platforms take 90 days.` *(white)*
`We've launched in an afternoon.` *(paint-stroke underline on "afternoon")*

**Body:**
`Blitz Week is an intensive, 4-day launch at our headquarters in Lehi, Utah. You leave with your platform live. Not a prototype — a fully configured, production-ready system. And for partners on a 3-year agreement, it's 100% free.`

**CTAs:**
- Primary (orange): `Schedule Blitz Week`
- Text link (blue): `Read the Blitz Week guide →`

---

### SECTION BW.02 — THE 4-DAY SCHEDULE
**Type:** 4-column timeline grid.

**Eyebrow:** `How It Works — Monday through Thursday`

**Headline:** `Four days. Side-by-side with our best people. Decisions made in real time. Platform live on Thursday.`

4 columns (1px separator style):

**Monday:**
- Label: `MON`
- **Title:** `Platform Setup & Payments`
- **Body:** *"Commission engine connection, payment processor setup, Fair Share configuration, compliance review. Your foundation, built right."*

**Tuesday:**
- Label: `TUE`
- **Title:** `Mobile App & Rep Experience`
- **Body:** *"Branded mobile app configured, drag-and-drop widgets, rep pages, content library populated and shareable."*

**Wednesday:**
- Label: `WED`
- **Title:** `Website & Campaign Launch`
- **Body:** *"Live Editor pages built, campaign content ready, checkout tested and optimized, all integrations verified."*

**Thursday:**
- Label: `THU` *(green)*
- **Title:** `You're Live.` *(green)*
- **Body:** *"Full team walkthrough, go-live checklist complete, 90-day free platform period begins for 3-year partners."*

Footer text (monospace, very small, gray):
`9:30 AM – 3:00 PM DAILY · LUNCH PROVIDED · LEHI, UTAH`

---

### SECTION BW.03 — PRICING & OFFER
**Type:** Two-column. Left: pricing card. Right: copy + CTA.

**Left column — pricing card:**
Label (monospace): `Standard Investment`

- Price: `$75,000`
- Description: *"value — reflecting senior talent, dedicated resources, and accelerated timeline."*

Orange offer block:
- **Title (orange):** `100% Free for Term Partners`
- Body: *"Partners who choose a term agreement receive Blitz Week at no cost."*

Green offer block:
- **Title (green):** `+ 90 Days Free`
- Body: *"3-year partners: 90 days of the full platform at no charge from launch. Generate revenue before your first invoice."*

**Right column:**

Orange bar accent above.

**Headline:** `The switching pain you're imagining doesn't exist here.`

**Body:**
`We've done this before. We know where the complexity lives. We've built the systems to manage it. Our team shows up ready to build on the spot — not to plan, not to prototype. To build.`

**Body (white, Medium weight):**
`When you walk out of Blitz Week, your platform is live and ready for business.`

**CTA (orange):** `Schedule Your Blitz Week`

---

## PAGE 06 — THE PLATFORM (OVERVIEW)
**URL:** `/platform`
**Goal:** Navigation hub for all product pages. Shows integrated wholeness. Audience: CTO, COO, evaluators.

---

### SECTION PL.01 — HERO

**Eyebrow (monospace, blue):** `The We-Commerce Platform`

**Headline (Syne ExtraBold, ~50px):**
`One platform. Every tool.` *(white)*
`Zero duct tape.` *(brand blue)*

**Body:**
`Commerce, payments, commissions, mobile, content, live shopping — all native, all connected, all synced in real time. No middleware. No 3am calls. No IT cycles every time you need to change a page. Just one system that does it all.`

---

### SECTION PL.02 — PRODUCT MODULE GRID
**Type:** Full-width module grid, 4 columns × 2 rows. 1px separator style.

Each module card contains:
- Tag label (monospace, blue) — product category
- Product name (Syne Bold)
- One-sentence value prop (DM Sans, small, gray)
- Text link: `Explore →`

**Modules:**

| Tag | Product | Value Prop |
|-----|---------|-----------|
| Attribution | Fair Share™ | Full-journey attribution. Reps trust it. Reps share. Your traffic grows. |
| Payments | Fluid Payments | Cascading retry across 6 processors. Every transaction gets its best shot. |
| Mobile | Mobile App | Fully branded. Drag-and-drop built. 90+ widgets. Deploy instantly. |
| Desktop | Desktop App | Full-screen workspace for leaders. One place. Always logged in. |
| Website | Live Editor | Launch pages in minutes. No dev tickets. No waiting. |
| Commerce | Live Shopping | Demo. Sell. Attribute. In one stream. Rep gets credit. |
| Data | Sync Tool | One connection to your commission engine. Real-time. Bidirectional. |
| Ecosystem *(green tag)* | Droplet Marketplace *(green)* | One-click app ecosystem. Stop paying for every customization. *(+ "Coming Soon" label in green)* |

**Visual direction:**
- On hover: faint background color shift, blue border glow
- Droplet Marketplace uses green accent throughout — signals future/premium
- On mobile: 2-column grid

---

### SECTION PL.03 — UNIQUE DIFFERENTIATORS
**Type:** Full-width. 2×2 card grid.

Orange bar accent above.

**Eyebrow (monospace, blue):** `Unique to Fluid — These Are Not Better Claims. These Are Different Claims.`

**Headline:** `Things no one else in direct selling tech can say.`

**2×2 grid of differentiator cards (dark background, thin border, blue category label):**

Card 1:
- Label (monospace, blue): `FAIR SHARE ATTRIBUTION`
- Body: *"No one else has a multi-step algorithm with full order journey visibility. The rep who planted the seed gets credit even if the harvest comes three weeks later. This is genuine IP."*

Card 2:
- Label (monospace, blue): `BLITZ WEEK`
- Body: *"'Launch in an afternoon' is provable, not marketing. Challenge anyone to match it. Traditional platforms take 90–120 days. We've done it in hours."*

Card 3:
- Label (monospace, blue): `TOKEN PORTABILITY`
- Body: *"Third-party tokenization means your customer payment data travels with you. You're never held hostage to a vendor again. You're always in control."*

Card 4:
- Label (monospace, blue): `SINGLE GLOBAL STOREFRONT`
- Body: *"Shopify requires separate stores per country. You run the world from one storefront. Launch in a new country by Friday. No rebuild required."*

---

## ADDITIONAL PAGES TO BUILD
*(Follow the same structure and voice principles established above)*

**`/platform/mobile-app`** — Audience: VP Sales, Field Leaders. Lead with "Your reps carry their entire business in their pocket." Core themes: 90+ drag-and-drop widgets, instant deployment (no app store delays), Fair Share built in, AI + CRM tools, Apple Pay one-click checkout.

**`/platform/live-editor`** — Audience: Marketing, Operations. Lead with "If your team can use Microsoft Word, they can edit the website." Core themes: no dev tickets, launch pages in minutes, drag-and-drop + reusable templates, instant versioning/rollback, pre-built high-converting sections.

**`/platform/live-shopping`** — Audience: Marketing, VP Sales. Lead with "The most meaningful moments in direct selling have always happened live." Core themes: demo + sell + attribute in one stream, rep-shared streams with automatic attribution, recordings live on product pages forever, compliance monitoring built in.

**`/platform/sync-tool`** — Audience: CTO, Operations. Lead with "One connection to your commission engine. Everything else flows from there." Core themes: replaces fragile custom scripts, bidirectional sync, real-time visibility dashboard, SOC 2 Type II compliant, bank-level encryption.

**`/platform/desktop-app`** — Audience: Field Leaders, Operations. Lead with "Everything reps need, all in one place, always logged in." Core themes: same drag-and-drop builder as mobile, role/rank/country customization, self-serve reporting, full-screen workspace for high-volume leaders.

**`/customers`** — Case study format. Lead with proof and outcomes. Use Dan England, Holly McKinney (Teqnavi), and other available customer quotes. Show company logos, outcomes, and Blitz Week launch timelines.

---

## VOICE & COPY QA CHECKLIST
*Before publishing any page, verify every piece of copy against these principles:*

1. **Is it specific?** Replace "improved results" with the actual number. Replace "better attribution" with the specific scenario (Google search, 3 weeks later).

2. **Is it human?** If you can replace the subject with "a user" or "a customer" without losing meaning, rewrite it. The stakes are always personal — a mom, a rep, a career.

3. **Is it confident without being arrogant?** We respect what Shopify does. We just weren't built for the same thing. Never mock competitors. Out-position them with specificity.

4. **Does it use the short-sentence, dramatic-pause technique?** One idea per sentence. Let the big claim land before building on it. "Read that again." moments are intentional.

5. **Is "Book a Demo" the primary CTA?** On every page. Every hero section. Non-negotiable.

6. **Are pain points named before solutions?** Never lead with features. Lead with the problem the feature solves.

7. **Does it avoid feature-list language?** No bullets that say "Includes X, Y, and Z features." Instead: specific outcomes, specific scenarios, specific people.

---

## CTA HIERARCHY REFERENCE

| Level | Style | Copy | When to Use |
|-------|-------|------|-------------|
| Primary | Solid orange button | `Book a Demo` | One per hero/above-fold section |
| Secondary | Outlined/ghost button | `Watch 2-min Overview`, `Schedule Blitz Week`, `See the Platform` | Alongside primary for not-yet-ready visitors |
| Tertiary | Text link + → arrow, brand blue, monospace | `Learn about Fair Share →`, `See how it works →` | In-content navigation, feature sections |

---

*End of Fluid Website Build Prompt — v1.0 — 2026*
*All copy should be treated as production-ready. Visual direction notes are guidance for interpreting the brand's existing design language. The Fluid visual style reference image should be consulted alongside this document for specific graphic elements.*
