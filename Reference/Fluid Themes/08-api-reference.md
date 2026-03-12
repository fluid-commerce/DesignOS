# API Reference

**Source:** https://docs.fluid.app/docs/themes/api-reference

## Overview

Complete API reference for managing themes and templates programmatically.

## Theme Management

### List All Themes
```http
GET /api/application_themes
```

Returns all themes available to the company (both shared root themes and custom company themes).

**Response:**
```json
{
  "themes": [
    {
      "id": 1,
      "name": "Base Theme",
      "description": "Default theme",
      "status": "active"
    }
  ]
}
```

### Create Theme
```http
POST /api/application_themes
```

**Request Body:**
```json
{
  "name": "Custom Theme",
  "description": "My custom theme",
  "clone_from_id": 1,
  "variables": {
    "primary_color": "#ff6b6b"
  }
}
```

### Update Theme
```http
PUT /api/application_themes/{theme_id}
```

**Request Body:**
```json
{
  "name": "Updated Theme Name",
  "variables": {
    "primary_color": "#4ecdc4"
  },
  "custom_stylesheet": "/* custom CSS */"
}
```

### Publish Theme
```http
POST /api/application_themes/{theme_id}/publish
```

Activates the theme and deactivates any currently active theme.

## Template Management

### List Templates
```http
GET /api/application_themes/{theme_id}/templates
```

**Query Parameters:**
- `themeable_type` - Filter by type (product, home_page, etc.)
- `status` - Filter by status (draft, active)

**Response:**
```json
{
  "templates": [
    {
      "id": 1,
      "name": "Default Product",
      "themeable_type": "product",
      "status": "active"
    }
  ]
}
```

### Create Template
```http
POST /api/application_themes/{theme_id}/templates
```

**Request Body:**
```json
{
  "name": "Custom Product Layout",
  "themeable_type": "product",
  "content": "<div>{{ product.name }}</div>",
  "format": "liquid",
  "applicable": "everything"
}
```

### Update Template
```http
PUT /api/application_theme_templates/{template_id}
```

**Request Body:**
```json
{
  "content": "<div>Updated content</div>",
  "head": "<style>/* custom styles */</style>",
  "stylesheet": "/* CSS */"
}
```

### Make Template Default
```http
POST /api/application_theme_templates/{template_id}/make_default
```

Sets the template as the default for its `themeable_type`.

### Preview Template
```http
GET /api/application_theme_templates/{template_id}/preview
```

**Query Parameters:**
- `version` - Preview specific version
- `record_id` - Preview with specific record

Returns rendered HTML for preview.

## Error Responses

### 422 Unprocessable Entity
Validation errors:
```json
{
  "errors": {
    "name": ["can't be blank"]
  }
}
```

### 404 Not Found
Theme or template not found.

### 422 - Cannot Delete Published Theme
Published themes cannot be deleted.

## Themeable Types

Supported template types:
- `product`
- `medium`
- `enrollment_pack`
- `shop_page`
- `navbar`
- `library`
- `page`
- `components`
- `sections`
- `locales`
- `footer`
- `layouts`
- `category_page`
- `collection_page`
- `cart_page`
- `config`
- `home_page`
- `mysite`
- `join_page`

## Authentication

All API requests require authentication. Include your API token in the Authorization header:
```http
Authorization: Bearer YOUR_API_TOKEN
```
