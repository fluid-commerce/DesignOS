# Deferred Items — Phase 16 Smart Context Pipeline

## Pre-existing test failures (out of scope for 16-02)

Found during: Plan 16-02 Task 2 full suite run
Status: Pre-existing failures (confirmed by git stash check — same failures without 16-02 changes)

1. **AppShell renders templates page when activeNavTab is templates** — Unable to find element with title "Quote". Likely a templates data seeding issue in tests.

2. **buildCopyPrompt instructs agent to use list_brand_sections** — `buildCopyPrompt` uses `list_voice_guide`/`read_voice_guide` not `list_brand_sections`. Tests are testing the wrong function name.

3. **buildCopyPrompt instructs agent to use read_brand_section** — Same as above.

4. **buildCopyPrompt references voice-guide category** — `buildCopyPrompt` references `list_voice_guide` but test looks for `voice-guide` as a category string.

5. **buildStylingPrompt instructs agent to use list_brand_sections** — `buildStylingPrompt` uses `list_brand_patterns` not `list_brand_sections`.

6. **buildStylingPrompt references design-tokens and pattern categories** — `buildStylingPrompt` says "list_brand_patterns" but test looks for "design-tokens" category string.

These tests in `brand-context.test.ts` appear to be written against an older prompt API that used `list_brand_sections`/`read_brand_section` as the primary discovery tools. The actual prompts use more specific tool names (`list_brand_patterns`, `list_voice_guide`, etc). The tests need updating to match current prompts.
