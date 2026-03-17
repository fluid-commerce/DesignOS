---
created: 2026-03-13T22:18:55.027Z
title: Verify chatSidebarOpen default change is intentional
area: ui
files:
  - canvas/src/store/campaign.ts:104
---

## Problem

PR #4 changed `chatSidebarOpen` default from `true` to `false` in the campaign store. This means the AI chat sidebar no longer opens automatically on app load. May be intentional (BuildHero screen doesn't need chat) or an oversight that affects other views.

## Solution

Confirm with Jonathan whether this was intentional. If so, consider whether chat should auto-open on specific tabs (e.g. My Creations) but stay closed on Create/BuildHero.
