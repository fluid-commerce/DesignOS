# Supported Paths

**Source:** https://docs.fluid.app/docs/themes/supported-paths

## Overview

This document lists all supported themeable paths and template types in Fluid themes.

## Themeable Types

The following template types are supported:

### Page Types
- `product` - Product detail pages
- `shop_page` - Shop/collection pages
- `home_page` - Homepage
- `cart_page` - Shopping cart page
- `category_page` - Category listing pages
- `collection_page` - Collection pages
- `page` - Generic custom pages
- `join_page` - Join/registration pages

### Component Types
- `navbar` - Navigation bar
- `footer` - Footer component
- `components` - Reusable components
- `sections` - Page sections

### Layout Types
- `layouts` - Base layouts
- `medium` - Medium-specific templates
- `enrollment_pack` - Enrollment pack pages

### Special Types
- `library` - Library pages
- `mysite` - MySite affiliate pages
- `locales` - Localization files
- `config` - Configuration files

## Template Structure

Each themeable type follows a consistent structure:

```
themeable_type/
└── template_name/
    ├── index.liquid  (or index.json)
    └── styles.css
```

## Default Templates

Most types support a `default` template:
```
product/
└── default/
    ├── index.liquid
    └── styles.css
```

## Custom Templates

Create custom templates by adding new folders:
```
product/
├── default/
│   └── index.liquid
└── custom_layout/
    └── index.liquid
```

## Template Selection

- Default templates are used automatically
- Custom templates can be assigned via API
- Use `make_default` endpoint to set default template
