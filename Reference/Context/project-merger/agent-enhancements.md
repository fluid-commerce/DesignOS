# Agent Enhancements Needed

## Context

Chey's AI skill orchestration system generates individual assets through a pipeline of sub-agents (copy, layout, styling, spec-check). The merger introduces campaign/carousel support, template integration, and a structured content slot system that agents must support.

## Enhancement Areas

### 1. Full Campaign Generation
**Current**: Agents generate one asset at a time in isolation.
**Needed**: A single prompt like "Create a campaign for X" should generate multiple cohesive assets with frames, and the user should land directly in the campaign asset grid.
- Copy agent needs campaign-level narrative planning (messaging arc across assets)
- Layout agent needs to maintain visual consistency across assets
- Styling agent needs to apply a cohesive palette/treatment across the set
- Spec-check agent needs campaign-level validation (brand consistency across assets)

### 2. Carousel / Multi-Frame Generation
**Current**: Agents generate single-image assets.
**Needed**: Agents should generate carousel posts with multiple frames (slides).
- Copy agent needs to split content across frames (hook → develop → CTA flow)
- Layout agent needs frame-to-frame visual continuity
- Each frame must work standalone AND as part of the sequence
- Spec-check needs carousel-specific rules (frame count, swipe coherence)

### 3. Template-Aware Generation
**Current**: Agents generate from scratch based on brand rules and archetypes.
**Needed**: Agents should be able to work within the constraints of a selected template.
- When user starts from a template, AI should respect that template's structure
- Content generation should fill the template's specific slots
- Layout modifications should stay within the template's grid/frame
- Jonathan's 8 templates are source of truth — agents must understand their field configs

### 4. Content Slot Mapping
**Current**: Agents produce a complete HTML/asset output.
**Needed**: Agent output should map to discrete content slots that the right sidebar can display and edit.
- Output needs structured metadata: which text is the headline, body, CTA, etc.
- Photo regions need to be identified for repositioning controls
- Moveable elements need to be tagged for the brush/transform system
- This structured output also enables baseline diff tracking (field-by-field comparison)

### 5. Iteration-Aware Context
**Current**: Each agent invocation is relatively stateless.
**Needed**: Agents should understand iteration context — what changed, what the user is trying to improve, what the history looks like.
- Feed previous iteration state into new generation requests
- Leverage baseline diff data: "users tend to change X in this type of asset"
- Smarter suggestions based on edit patterns over time (the learning loop)

## Priority Order

1. **Content slot mapping** — Required for Jonathan's right sidebar to work with AI output
2. **Template-aware generation** — Required for the template-first flow
3. **Full campaign generation** — Required for the "generate entire campaign from one prompt" flow
4. **Carousel/multi-frame generation** — Required for carousel support
5. **Iteration-aware context** — Enhancement for quality; can be incremental

## AI Collaboration Model

The AI is an **always-available collaborator, never required**:
- Users can generate a full campaign with one AI prompt
- Users can build everything manually from templates
- Users can mix — AI generates, user adds more manually, AI iterates on specific pieces
- AI can be introduced at any point in any workflow
- The system should support all of these paths equally well

## See Also

- [[cheys-system]] — Current agent architecture
- [[campaign-and-carousel]] — What agents need to support
- [[feature-comparison]] — Full gap analysis
- [[design-decisions]] — Binding decisions that constrain agent behavior
