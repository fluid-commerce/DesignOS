# Schema Components

**Source:** https://docs.fluid.app/docs/themes/schema-components

## Overview

Schema components define the structure and settings for theme elements like blocks, presets, and sections.

## Component Types

### Settings
Define configurable options for themes:
```json
{
  "settings": {
    "primary_color": {
      "type": "color",
      "label": "Primary Color",
      "default": "#ff6b6b"
    },
    "font_family": {
      "type": "text",
      "label": "Font Family",
      "default": "Inter, sans-serif"
    }
  }
}
```

### Blocks
Reusable content blocks:
```json
{
  "blocks": {
    "hero": {
      "type": "section",
      "settings": {
        "title": "text",
        "image": "image"
      }
    }
  }
}
```

### Presets
Pre-configured theme variations:
```json
{
  "presets": {
    "dark": {
      "primary_color": "#000000",
      "background_color": "#ffffff"
    },
    "light": {
      "primary_color": "#ffffff",
      "background_color": "#000000"
    }
  }
}
```

## Schema Structure

### Basic Schema
```json
{
  "name": "Component Name",
  "settings": {},
  "blocks": {},
  "presets": {}
}
```

### Setting Types
- `text` - Text input
- `textarea` - Multi-line text
- `number` - Numeric input
- `color` - Color picker
- `image` - Image upload
- `select` - Dropdown selection
- `checkbox` - Boolean toggle

## Using Schemas

### In Templates
Access schema settings:
```liquid
{{ section.settings.primary_color }}
{{ block.settings.title }}
```

### Via API
Create/update schemas:
```bash
POST /api/application_themes/{theme_id}/templates
PUT /api/application_theme_templates/{template_id}
```

## Best Practices

1. **Organize Settings**
   - Group related settings
   - Use descriptive labels
   - Provide sensible defaults

2. **Reusable Blocks**
   - Create generic blocks
   - Make blocks configurable
   - Document block usage

3. **Preset Management**
   - Create meaningful presets
   - Test all presets
   - Keep presets updated

4. **Validation**
   - Validate setting types
   - Enforce constraints
   - Provide helpful error messages
