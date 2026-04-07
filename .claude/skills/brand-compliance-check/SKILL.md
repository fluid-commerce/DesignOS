---
name: brand-compliance-check
description: >
  Run brand compliance validation against Fluid brand rules. Use this after
  generating any HTML or .liquid output to validate colors, fonts, spacing,
  opacity, dimensions, and schema structure.
invoke: slash
---

# Brand Compliance Check

Run brand compliance validation against Fluid brand rules. Use this after generating any HTML or .liquid output.

## Usage

### For HTML files
```bash
node tools/brand-compliance.cjs <file>
```
Validates colors, fonts, spacing, opacity, and dimensional specs against the brand rule set. Reports violations grouped by severity.

### For .liquid files
```bash
node tools/schema-validation.cjs <file>
```
Validates Gold Standard schema structure: required settings, content slots, no hard-coded values, proper block types.

### For dimension checks
```bash
node tools/dimension-check.cjs <file> --target <type>
```
Where `<type>` is one of: `social-post`, `one-pager`, `website-section`. Checks width, height, padding, and margin constraints.

## Interpreting Results

Output is structured JSON with fields: `file`, `line`, `rule`, `severity`, `message`.

Severity maps to brand rule weights:
- **error** (weight 81-100): Must fix before delivering output
- **warning** (weight 51-80): Should fix, document if skipped
- **info** (weight 21-50): Consider fixing
- **hint** (weight 1-20): Optional improvement

## Workflow

1. Run the appropriate validation command
2. Parse the JSON output
3. Group violations by severity
4. Fix all **errors** (weight >= 81) before delivering
5. Report remaining warnings/info to the user
