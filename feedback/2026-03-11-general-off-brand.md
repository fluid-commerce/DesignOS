# Feedback: Generic output instead of social post

- **Date:** 2026-03-11
- **Session:** 20260311-160000
- **Type:** general
- **Rating:** negative
- **Issues:** off-brand, layout
- **Asset requested:** social post (Instagram)

## Description

Output produced generic UI/UX patterns rather than a Fluid-branded social post. Did not match the expected social post format or brand identity.

## Root cause (suspected)

System defaulted to generic UI/UX component generation instead of loading social post specs and brand constraints. May indicate that `brand/social-post-specs.md` and `brand/design-tokens.md` were not loaded or not enforced.

## Suggested improvements

- Ensure social post requests always load `brand/social-post-specs.md`
- Enforce layout archetypes from `brand/layout-archetypes.md` for post sizing/structure
- Apply brand voice and design tokens rather than generic UI patterns
