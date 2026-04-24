---
name: gemini-social-image
description: >
  Craft prompts for Gemini image generation (gemini-2.5-flash-image) that produce genuinely scroll-stopping social media images for ecommerce-adjacent brands — fitness, nutrition, skincare/beauty, fashion, wellness. Covers the prompt architecture, lighting patterns, camera direction, emotional register techniques, brand-specific playbooks, and what kills a prompt. Use whenever generating social media imagery via the Gemini API for any of these brand categories.
invoke: whenever generating social media images for ecommerce-adjacent brands via Gemini image gen API
---

# Gemini Social Image Skill

You are generating commercial photography for social media — not illustrations, not concept art. The image must earn a scroll stop within the first 0.5 seconds. Every element of the prompt is in service of that.

---

## Core Philosophy

**A great social media image does one of two things:**
1. Makes the viewer feel something (awe, desire, warmth, freedom)
2. Makes the viewer feel *seen* (this is their life, or their life they want)

Neither of those goals is achieved by a competent, centered, well-lit subject on a clean background. That is what everyone generates by default. The only way to differentiate is to engineer a specific emotional register from the first word of the prompt.

**The model responds to narrative, not keywords.** A coherent descriptive sentence outperforms a list of tags every time.

---

## Prompt Architecture

Every prompt should have these five layers, roughly in this order:

```
[STYLE SIGNAL] [SUBJECT + SPECIFICS] [ACTION/STATE] [SETTING] [LIGHT] [CAMERA] [EMOTIONAL BRIEF]
```

### 1. Style Signal (first 2-3 words)
Open with the genre of photography. This anchors the entire output.
- `Cinematic outdoor fitness photography` — signals motion, drama, real environment
- `Luxury beauty editorial photography` — signals elegance, deliberate composition
- `Intimate editorial fashion photography shot on film` — signals authenticity, grain, warmth
- `Extreme macro product photography` — signals texture, detail, close-in drama

### 2. Subject + Specifics
Describe with precision. Generic descriptions produce generic images. Specificity is the proof.
- ❌ `woman in athletic wear`
- ✅ `athletic woman in a burnt orange two-piece athletic set`
- ❌ `skincare bottles`
- ✅ `three glass serum bottles with brushed gold dropper caps in amber, rose, and cream`

### 3. Action / State
What is happening? Still life or motion? The model renders both well.
- For energy: `running with motion blur on her ponytail and legs`
- For intimacy: `fingers wrapped around a small espresso cup, looking down slightly`
- For drama: `performing a powerful dumbbell curl with intense focused expression`

### 4. Setting
Environments do emotional work. Place the subject deliberately.
- Cobblestone European alleyway/street = effortless aspiration (fashion)
- Raw industrial gym, exposed brick = grit and authenticity (fitness)
- White marble / rose quartz slab = luxury and cleanliness (skincare)
- Warm oak wooden surface = ritual and life (nutrition/wellness)
- Coastal path at golden hour = freedom and aspiration (fitness)
- Cafe window, morning light = quiet self-possession (fashion)

### 5. Light — The Highest-Leverage Variable
Light direction and quality consistently produced the biggest quality jump in testing. Never leave light unspecified.

**Single-source dramatic light beats even studio lighting every time.**

| Light Type | Effect | Use For |
|---|---|---|
| Backlit silhouette at golden hour | Halo effect, emotional drama | Fitness aspiration, outdoor lifestyle |
| Single overhead tungsten spot | Rim lighting, power, grit | Fitness strength, gym content |
| Warm morning sidelight | Long shadows on surface, lived-in warmth | Nutrition, morning ritual |
| Warm amber candlelight | Intimate, sensory, skin glows | Wellness, self-care |
| Soft window backlight (cafe/interior) | Halo behind subject, film feel | Fashion, lifestyle |
| Warm backlight through glass | Stained-glass glow effect | Skincare bottles, product |
| Raking late-afternoon window light | Dramatic directional shadows on texture | Flat lays, still life |

### 6. Camera Direction
These phrases reliably control composition and depth of field:
- `85mm portrait lens, shallow depth of field` = intimacy, subject isolation
- `50mm, film-like quality with slight grain` = authenticity, editorial
- `low angle looking up / upward angle` = power, drama (especially for fitness)
- `overhead aerial shot` = ritual framing, flat lay organization
- `100mm macro lens, razor-thin depth of field` = extreme texture and detail
- `35mm wide-angle` = environmental context, street feel

### 7. Emotional Brief (closing line — the most important trick)
End the prompt with the *feeling* the image should create, stated as an editorial intention:
- `The feeling is freedom, not performance.`
- `You can almost feel the warmth.`
- `The mood is quiet and self-possessed.`
- `The energy is raw, powerful, real.`
- `Sensual and precise simultaneously.`

This works because it steers the model toward *register* rather than just subject matter. Without it, the model defaults to a neutral, competent interpretation. With it, the model resolves ambiguity toward a specific emotional quality.

---

## Brand Category Playbooks

### FITNESS
**Best performing patterns:**
- Outdoor backlit silhouette at golden hour > gym content for aspiration/lifestyle
- Low angle + single overhead light source + action in gym = raw power content
- Motion blur (ponytail, legs) is a signal of speed and energy — always include for running shots
- "The feeling is freedom, not performance" = aspiration; "raw, powerful, real" = strength

**Settings that work:** Coastal paths at sunrise/sunset, industrial gyms (exposed brick, concrete), urban streets at dawn

**Avoid:** Centered neutral pose, even studio lighting, static standing with no tension in the body

**Template:**
```
Cinematic [outdoor/gym] fitness photography. [Athlete description] [action with motion details], wearing [specific outfit color + description]. [Setting with atmosphere]. [Specific light source — backlit golden hour / overhead tungsten]. [Camera: low angle upward / 50mm film]. [Emotional brief.]
```

---

### NUTRITION / SUPPLEMENTS
**Best performing patterns:**
- Morning ritual context > isolated product shot every time
- Extreme macro of the product label + tactile material (powder, liquid) = luxury product photography
- The model renders product label text reliably — always name the product so it appears in the image
- The model invents coherent branding details (logo, subtitle) when pushed by a tight macro — let it
- Warm wood surfaces = daily ritual/routine; cold marble = clinical premium; both are valid, choose by brand voice

**Settings that work:** Warm oak table with morning light, white marble with sidelight, open journal + steam as lifestyle props

**Avoid:** Empty product alone without any props or context; harsh overhead light that flattens the scene

**Template:**
```
[Lifestyle product photography / Extreme macro product photography]. [Product name + description] [setting with props that tell a story — journal, mug, morning context]. [Warm morning sidelight / overhead golden morning light creating long soft shadows]. [Camera angle]. [The scene feels like someone's actual morning routine / minimal and striking.]
```

---

### SKINCARE / BEAUTY
**Two distinct modes — choose based on content calendar goal:**

**Mode A: Product-Forward (new product launch, feature post)**
- Three or more bottles, all upright, clearly visible, different sizes or colors
- Clean or quartz surface, soft diffused light with gentle shadows
- Organic props: halved fruit, scattered flower petals, blossoms
- Slightly asymmetric arrangement reads as editorial rather than stock

**Mode B: Editorial / Mood (brand aesthetic, campaign content)**
- Single backlit bottle on rose quartz or stone slab
- Warm backlight creates stained-glass glow through the glass — very distinctive
- Fewer elements, more white space, more tension
- Combine with petals, a single piece of fruit, very shallow DOF

**The most powerful technique:** Warm backlight through colored glass bottles = stained-glass bokeh circles in the background, glowing bottles, unmistakably luxurious.

**Avoid:** Perfectly symmetrical arrangements (reads as Canva template); harsh studio light that kills the glow

**Template (Mode A):**
```
Luxury beauty editorial photography. Three glass serum bottles with [dropper cap material] arranged in an organic asymmetric cluster on a [surface]. [Botanical props]. [Warm backlight / soft diffused light]. 85mm, shallow depth of field. [Color palette description]. All bottles are upright and clearly visible. Photorealistic, editorial luxury beauty, vertical composition. [Emotional brief.]
```

**Template (Mode B):**
```
High-end beauty editorial. A [single / two] glass [bottle type] [state: lying on side / upright catching backlight] on a [surface]. [Warm backlight that creates a glow / stained-glass effect]. Scattered [botanicals]. 100mm macro lens, razor-thin depth of field. [Color palette]. Photorealistic, sensual and editorial. [Emotional brief.]
```

---

### FASHION
**Two modes based on content goal:**

**Mode A: Connection / Community content** — use direct gaze
- Medium to portrait framing (waist up or chest up), subject looks directly at camera
- Specific styling details: exact clothing colors, accessories, hair
- European location (stone archway, cobblestone alley, warm limestone walls)
- 85mm portrait lens, shallow DOF, natural dappled light
- The direct gaze creates parasocial connection that makes followers feel addressed

**Mode B: Aspiration / Mood content** — use averted gaze
- Looking down, out a window, at a small object (coffee cup, phone)
- Interior setting (cafe, gallery, corridor) with strong backlight from window
- 85mm, film grain aesthetic, morning light creating halo
- The averted gaze creates introspective, brand-aesthetic energy

**The most important discovery:** Film grain aesthetic (`shot on film`, `warm film grain aesthetic`) consistently produces images that read as real photography rather than AI generation. Always include for fashion.

**Avoid:** Wide walking shots with the subject small in the frame — creates distance and loses connection; any background that reads as generic "city street" without specific architectural detail

**Template (Mode A):**
```
Intimate editorial fashion photography. Medium shot of [subject description + specific hair/features] wearing [specific outfit with colors and materials], [specific accessory detail]. [She/He] [action: leaning against / standing beside] [specific setting: stone archway / warm limestone wall] [looking directly into camera / direct gaze, calm and confident expression]. Natural [dappled / warm afternoon] light. 85mm portrait lens, gentle background blur. [Emotional brief.]
```

**Template (Mode B):**
```
Intimate editorial fashion photography shot on film. [Subject description] wearing [specific outfit], [action: looking down / gazing out a window] [with a specific prop: espresso cup, book]. [Interior setting with strong window backlight creating a halo behind the subject]. 85mm portrait lens, extremely shallow depth of field, warm film grain aesthetic. [Emotional brief.]
```

---

### WELLNESS / SELF-CARE
**Best performing patterns:**
- **Hands in the scene is the single most powerful technique.** Any hand contact with a product, water, or material transforms "still life" into "ritual."
- Overhead aerial format works best for wellness — it gives the sense of a complete ritual scene
- Warm candlelight > any other light source for wellness. It makes skin glow and creates amber warmth that reads as intimate
- Water with floating botanicals (rose petals, cucumber, herbs) is consistently evocative — people almost feel the temperature

**Sensory language in the prompt works.** "You can almost feel the warmth" as a closing line pushed the model to produce an image with viscerally evocative warmth quality.

**Settings that work:** White ceramic bath bowls, white linen surfaces, linen tablecloths with raking window light, bath trays

**Props that work:** Lit beeswax candle, terracotta/clay vessels with wooden lids, dried eucalyptus/lavender/herbs, fresh rose petals, cucumber slices, rolled white Turkish towels

**Avoid:** Even overhead lighting with no shadows (kills the sensory quality); too many props with no hierarchy; perfectly symmetrical arrangements (feels generic spa aesthetic)

**Template:**
```
Luxury wellness [lifestyle / sensory] photography. [Overhead aerial / close-up] of [hands in contact with product / hands holding / aerial flat lay] [specific bowl / vessel / surface]. [Floating botanicals / props around it]. [Warm amber candlelight / raking late-afternoon window light] [creating specific effect on skin/surface]. [Supporting props on linen surface]. Photorealistic, intimate and sensory, luxury wellness brand, vertical composition. You can almost feel [the warmth / the texture / the calm].
```

---

## Text Rendering in Images

Gemini is notably strong at rendering product text in images — a genuine competitive advantage.

**Rules for reliable text:**
- Name the product in your prompt exactly as you want it labeled (e.g., "a canister labeled PURE GREENS")
- Keep product text under ~25 characters for best rendering
- The model will invent complementary branding elements (logos, subtitles, taglines) that feel coherent — allow this, it makes images feel more real
- For extremely tight macro shots of product labels, the model renders text with sharp clarity

---

## Composition Patterns by Platform

| Platform | Best Composition | Why |
|---|---|---|
| Instagram Feed | Vertical 4:5, clear visual hierarchy, one strong focal point | Maximizes real estate, algorithm rewards saves |
| Instagram Stories/Reels Cover | Vertical 9:16, bold and readable at glance | Stories viewed full-screen, thumbnail must work |
| Pinterest | Vertical 2:3, high information density | Longer dwell time on platform, saves-focused |
| Square (carousels) | 1:1, clean crop, no important elements in corners | Safe across all contexts |

Always specify `vertical composition` unless there's a specific reason not to.

---

## The Quality Stack

Order these in your prompt to maximize output quality:
1. **Style signal first** — anchors the entire output
2. **Subject specificity** — eliminates ambiguous interpretation
3. **Single dramatic light source** — biggest quality lever
4. **Camera direction** — controls intimacy and drama
5. **Emotional brief last** — steers register, fills gaps

Always end with: `Photorealistic, [quality signal: editorial quality / luxury brand aesthetic / magazine quality], [composition: vertical composition].`

---

## Anti-Patterns — Never Do These

| Prompt Pattern | Why It Fails |
|---|---|
| Generic subject with no specifics (`athletic woman in sportswear`) | Produces stock photo, not brand content |
| Even/diffused studio lighting with no direction | Flat, forgettable, no drama |
| Symmetrical centered composition | Reads as template, not photography |
| Isolated product with no environmental context | Sells features, not feeling |
| Abstract/artistic at the expense of product clarity (product not visible/identifiable) | Beautiful but useless for social commerce |
| Wide walking shot with small figure | Distance kills connection |
| No emotional brief | Model defaults to competent-but-neutral interpretation |
| More than ~4 major elements in one scene | Visual noise, no hierarchy, eye has nowhere to go |

---

## The Two Phrases That Consistently Elevate Output

1. **`The feeling is [X], not [Y].`** — Contrasts define register better than pure description. "The feeling is freedom, not performance." "The mood is quiet and self-possessed, not posed."

2. **`You can almost feel [sensory quality].`** — Triggers the model to prioritize sensory evocation. "You can almost feel the warmth." "You can almost feel the weight of the fabric."

Use at least one of these closing lines on every prompt.
