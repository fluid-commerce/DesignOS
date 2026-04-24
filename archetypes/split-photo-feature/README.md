# split-photo-feature

**Platform:** Instagram Portrait (1080 × 1350)

## What it is

A vertical split: photo fills the left column (520px wide, full height), editorial text fills the right column (category tag, headline, body, CTA). Clean separation — photo on one side, story on the other.

## Structural pattern

The left column (520px × 1350px) holds a portrait-oriented photo. The right column starts at 560px and holds: category tag (22px, top:108px), headline (80px, top:240px), body copy (30px, top:660px), and a CTA link (bottom:108px). The column separation is achieved by the background layer color showing between the photo edge and the content zone (8px implied gap via positioning).

## Content type fit

- Product feature and editorial posts
- New arrival announcements
- Person feature or profile posts
- "The story behind" content pairing context copy with a visual

## When to use

- When you have a strong portrait-format photo and editorial copy that complement each other
- When the message needs more than one line (this layout comfortably holds 3–5 lines of body)
- When a CTA is part of the post

## When NOT to use

- When the photo is landscape-oriented (crops to a very narrow slice)
- When body copy is too brief (leaves the right panel visually unbalanced)
- When cinematic full-bleed impact is the goal (use `photo-darken-headline`)

## Components

- Left photo column + right text column (category-tag → headline → body → CTA)
