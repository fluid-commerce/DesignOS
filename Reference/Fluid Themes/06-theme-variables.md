# Template Variables

**Source:** https://docs.fluid.app/docs/themes/theme-variables

## Overview

Template variables provide access to data and settings within your theme templates.

## Global Variables

Available in all templates:

### Company
```liquid
{{ company.name }}
{{ company.domain }}
{{ company.settings }}
```

### Request
```liquid
{{ request.path }}
{{ request.url }}
{{ request.method }}
```

### Localization
```liquid
{{ localization.locale }}
{{ localization.currency }}
{{ localization.timezone }}
```

## Template-Specific Variables

### Product Templates
```liquid
{{ product.name }}
{{ product.price }}
{{ product.description }}
{{ product.images }}
{{ product.variants }}
```

### Cart Templates
```liquid
{{ cart.items }}
{{ cart.total }}
{{ cart.item_count }}
{{ cart.subtotal }}
```

### Shop/Collection Templates
```liquid
{{ collection.name }}
{{ collection.products }}
{{ collection.description }}
```

## Asset Variables

### Asset URL
```liquid
{{ 'logo.png' | asset_url }}
{{ 'styles/main.css' | asset_url }}
{{ 'scripts/app.js' | asset_url }}
```

## Theme Variables

### Custom Variables
Define custom variables in theme configuration:
```json
{
  "variables": {
    "primary_color": "#ff6b6b",
    "secondary_color": "#4ecdc4",
    "font_family": "Inter, sans-serif"
  }
}
```

Access in templates:
```liquid
{{ theme.variables.primary_color }}
{{ theme.variables.font_family }}
```

## Variable Filters

### Common Filters
```liquid
{{ product.price | money }}
{{ product.name | upcase }}
{{ product.description | truncate: 100 }}
{{ 'image.jpg' | asset_url }}
```

## Best Practices

1. **Check for Existence**
   ```liquid
   {% if product %}
     {{ product.name }}
   {% endif %}
   ```

2. **Use Appropriate Filters**
   - Format money with `money` filter
   - Truncate long text
   - Escape HTML when needed

3. **Leverage Global Variables**
   - Use company settings for branding
   - Use localization for multi-language support

4. **Document Custom Variables**
   - Document all custom variables
   - Provide default values
   - Include usage examples
