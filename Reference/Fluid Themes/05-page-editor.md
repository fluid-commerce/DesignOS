# Page Editor

**Source:** https://docs.fluid.app/docs/themes/paged-editor

## Overview

The Fluid Page Editor allows you to create and customize pages using schemas, variables, and previews.

## Key Features

### Schema-Based Editing
- Define page structure using schemas
- Visual editing interface
- Real-time preview

### Variables
- Use template variables in pages
- Global and page-specific variables
- Dynamic content rendering

### Preview System
- Preview pages before publishing
- Test with different data
- Version comparison

## Creating Pages

### Via Admin Dashboard
1. Navigate to Sidebar > Sharing > Pages
2. Click "With Code"
3. Create custom HTML & CSS
4. Toggle "Use Theme Styles" to inherit theme CSS

### Via API
Use the Page API to create pages programmatically:
```bash
POST /api/pages
```

## Page Templates

Pages can use:
- Custom HTML
- Theme CSS (optional)
- Template variables
- Liquid syntax

## Preview

### Preview Endpoint
```bash
GET /api/application_theme_templates/{template_id}/preview
```

**Query Parameters:**
- `version` - Preview specific version
- `record_id` - Preview with specific record data

## Best Practices

1. **Use Schemas**
   - Define clear page structure
   - Make fields reusable

2. **Leverage Variables**
   - Use global variables when possible
   - Keep page-specific variables minimal

3. **Test Previews**
   - Always preview before publishing
   - Test with different data sets

4. **Version Control**
   - Save drafts frequently
   - Use descriptive version names
