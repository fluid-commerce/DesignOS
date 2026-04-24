# product-feature-grid

**Platform:** Instagram Portrait (1080 × 1350)

## What it is

A 2×2 product showcase grid with collection headline and subtitle at the top, and four product cells each containing a photo, name, and price.

## Structural pattern

Collection title (52px, bold) and subtitle sit in the upper zone (top:80px–240px). Below, a 2×2 grid fills the remaining canvas with 24px gaps. Each cell contains a photo taking the bulk of the cell height, with a name/price row below. The product grid spans left:68px to right:68px.

## Content type fit

- New collection drops with multiple items
- Product range overviews
- Gift guide posts
- Seasonal product edits

## When to use

- When showing exactly 4 products from the same collection
- When all product photos share consistent background and lighting
- When price is part of the story

## When NOT to use

- When products are visually inconsistent (different backgrounds, sizes)
- For single product highlights (use `product-hero-backlit`)
- When product descriptions are needed beyond name + price

## Components

- Collection header + 2×2 product grid (photo + name/price per cell)
