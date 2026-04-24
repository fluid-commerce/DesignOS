# product-hero-backlit

**Platform:** Instagram Portrait (1080 × 1350)

## What it is

A product spotlight layout: brand name and bold product name at the top, a large centered product photo (object-fit: contain to show the full item), product description and price below, URL footer at the bottom.

## Structural pattern

Brand label at y=80px (small, wide-tracked). Product name at y=160px (120px display size). Product photo occupies center zone (180px inset, y=380–1020px, 720×640px). Below the photo: description on the left, price on the right, both at bottom:220px. Footer URL is centered at bottom:80px.

## Content type fit

- Product/menu spotlight posts with pricing
- Single item launch posts
- Product promotion campaigns
- Retail or e-commerce announcement posts

## When to use

- When a single product is the hero and the price is part of the message
- When the product photo is a clean packshot on neutral background
- When the brand context (name) should anchor the layout

## When NOT to use

- When multiple products need to be shown (use `product-feature-grid`)
- When the product image is lifestyle (not studio packshot) — the centered contain layout won't fill well
- When price is not relevant to the post

## Components

- Brand label + product name display + centered product photo + description/price row + footer
