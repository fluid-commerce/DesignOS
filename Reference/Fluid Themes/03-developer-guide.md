# Developer Guide

**Source:** https://docs.fluid.app/docs/themes/developer-guide

## Overview

This guide covers advanced theme development concepts and best practices.

## Template Development

### Liquid Templates
Fluid uses Liquid templating language for themes. Key features:
- Variables and filters
- Tags and logic
- Includes and renders

### Template Types
Different page types support different templates:
- Product pages
- Shop pages
- Home pages
- Cart pages
- Custom pages

### Component System
Create reusable components in the `components/` folder:
```liquid
{% render 'component_name', variable: value %}
```

## Variables

### Global Variables
Available in all templates:
- `company` - Company information
- `request` - Request details
- `localization` - Localization settings

### Template-Specific Variables
Only available in certain template contexts:
- Product templates have `product` variable
- Cart templates have `cart` variable

## Asset Management

### Asset Organization
- Keep assets organized in subfolders
- Use descriptive filenames
- Optimize images before uploading

### Asset URLs
Always use the `asset_url` filter:
```liquid
{{ 'logo.png' | asset_url }}
{{ 'styles/main.css' | asset_url }}
```

## Best Practices

1. **Version Control**
   - Use Git for theme files
   - Commit frequently
   - Tag releases

2. **Performance**
   - Minimize asset sizes
   - Use efficient Liquid code
   - Cache where appropriate

3. **Maintainability**
   - Comment complex logic
   - Use consistent naming
   - Follow theme structure conventions

4. **Testing**
   - Test on multiple devices
   - Preview before publishing
   - Test all template types
