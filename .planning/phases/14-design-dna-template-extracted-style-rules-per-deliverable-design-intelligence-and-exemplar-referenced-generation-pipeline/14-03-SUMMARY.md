---
phase: 14-design-dna-template-extracted-style-rules-per-deliverable-design-intelligence-and-exemplar-referenced-generation-pipeline
plan: 03
subsystem: ui
tags: [react, design-dna, templates, inline-editing, api]

# Dependency graph
requires:
  - phase: 14-01
    provides: template_design_rules DB table, GET/PUT /api/design-rules endpoints
provides:
  - Social Media DNA tab on Templates page with inline-editable design rules
  - DesignDnaPanel component fetching from /api/design-rules
  - 4 grouped sections: General Social Media, Instagram, LinkedIn, Archetype Design Notes
  - Click-to-edit textareas with PUT persistence and "Saved" flash feedback
affects: [templates-viewport, design-dna-editing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tab bar on Templates page: Templates (iframe) + Social Media DNA (DesignDnaPanel)"
    - "Inline editing: textarea with blue border on focus, save on blur/Ctrl+Enter, green flash confirmation"

key-files:
  created:
    - canvas/src/components/TemplatesScreen.tsx
  modified:
    - canvas/src/components/AppShell.tsx

# Execution
started: 2026-03-17T18:20:00Z
completed: 2026-03-17T18:30:00Z
duration: ~10min

tasks:
  - name: "Create DesignDnaPanel component with inline-editable design rules"
    status: complete
    commit: c783e42
  - name: "Verify Design DNA UI and editing"
    status: complete
    checkpoint: human-verify (approved)

deviations: []

## Self-Check: PASSED
- [x] TemplatesScreen.tsx created with Social Media DNA tab
- [x] Design rules fetched from GET /api/design-rules and grouped by scope
- [x] Inline editing with PUT /api/design-rules/:id persistence
- [x] User verified UI working at http://localhost:5175/app/
---
