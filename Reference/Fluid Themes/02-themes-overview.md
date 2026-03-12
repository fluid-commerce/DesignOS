# Themes Overview

**Source:** https://docs.fluid.app/docs/themes

## Introduction

Fluid Themes is a comprehensive theming system that allows you to customize the look and feel of your Fluid-powered storefront.

## Key Concepts

### Theme Architecture
- **Themes** - Complete styling and layout packages
- **Templates** - Page-specific layouts (product, shop, etc.)
- **Components** - Reusable UI elements
- **Assets** - Static files (CSS, JS, images)

### Theme Structure
```
theme/
├── layout/
│   └── theme.liquid
├── product/
│   └── default/
│       ├── index.liquid
│       └── styles.css
├── assets/
│   ├── custom.js
│   └── images/
├── components/
└── config/
```

### Layout File
The `layout/theme.liquid` file is the base layout that must include:
- `{{ content_for_header }}` in the `<head>`
- `{{ content_for_layout }}` in the `<body>`

### Asset Management
- Assets are stored in the `assets/` folder
- Reference assets using: `{{ 'filename.ext' | asset_url }}`
- Non-binary assets (CSS/JS) can be edited
- Binary assets (images/fonts) are uploaded only

### Versioning
- Every theme save creates a new version
- Preview earlier versions
- Compare versions
- Revert to previous versions if needed

## Getting Started

1. **Pull an existing theme:**
   ```bash
   fluid theme pull
   ```

2. **Or initialize a new theme:**
   ```bash
   fluid theme init
   ```

3. **Start development:**
   ```bash
   fluid theme dev
   ```

4. **Push changes:**
   ```bash
   fluid theme push
   ```
