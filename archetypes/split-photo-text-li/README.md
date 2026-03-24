# split-photo-text-li

## What it is

LinkedIn landscape adaptation of the split-photo-text pattern: photo placeholder occupies the left 47% of the frame and a text panel with headline and body copy fills the right 53%.

## Structural pattern

A hard vertical split divides the 1200x627 canvas. The left zone is a full-height image container (560x627px). The right zone is a flex column centered vertically, with a large bold headline at top and muted body copy below. The landscape ratio makes this pattern particularly effective — each side gets meaningful dimensions: the photo is nearly square (560x627) and the text panel has ample width (640px) for multiple lines of copy.

## Content type fit

- Case studies and client results posts
- Product feature announcements with a supporting visual
- Team spotlight or leadership portrait posts
- Event or behind-the-scenes content with descriptive copy

## When to use

- When you have a compelling photo that provides emotional context
- When the story needs both visual evidence and written explanation
- For human-centric posts (portraits, team, culture)
- When the photo and text are complementary, not redundant

## When NOT to use

- When you have no photo (use minimal-statement-li or hero-stat-li)
- When the photo tells the whole story (use photo-bg-overlay for Instagram)
- When you need to display multiple stats (use data-dashboard-li or hero-stat-li)
- When the quote IS the content (use quote-testimonial-li)

## Components

- Photo container (left half, full-height, object-fit cover)
- Headline block (right panel, large bold type)
- Body copy (right panel, muted supporting text)
