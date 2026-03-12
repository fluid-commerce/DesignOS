# Themes CLI Guide

**Source:** https://docs.fluid.app/docs/themes/themes-cli

## Overview

The Fluid Themes CLI provides command-line tools for theme development, allowing developers to work with themes using their preferred IDE and AI agents.

## Authentication Commands

### Login
```bash
fluid login
```
Authenticates through admin.fluid.app

### Logout
```bash
fluid logout
```
Clears authentication credentials

### Whoami
```bash
fluid whoami
```
Displays the currently logged in company

## Company Management

### Switch Companies
```bash
fluid switch
```
Presents a list of available companies

**Direct switch:**
```bash
fluid switch -c <company_subdomain>
# or
fluid switch --company=<company_subdomain>
```

## Theme Management

### Theme Dev
Start local development server:
```bash
fluid theme dev
```
*Note: Currently works with gem installation. Homebrew fix in progress.*

### Theme Init
Initialize a new theme project:
```bash
fluid theme init
```

### Theme Pull
Pull an existing theme from Fluid:
```bash
fluid theme pull
```

**Options:**
- `--nodelete` - Preserve local files that don't exist on the server

### Theme Push
Push local theme changes to Fluid:
```bash
fluid theme push
```

**Options:**
- `--unpublished` - Create a new draft theme instead of pushing to existing
- `--nodelete` - Preserve files on the server that don't exist locally

**Examples:**
```bash
# Push changes to existing theme
fluid theme push

# Create a new draft theme
fluid theme push --unpublished

# Push without deleting server files
fluid theme push --nodelete
```
