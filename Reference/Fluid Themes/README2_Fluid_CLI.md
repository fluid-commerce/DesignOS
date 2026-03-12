# Fluid CLI Setup & Usage Guide

## Installation Status ✅

**Fluid CLI is installed via Homebrew:**
- Homebrew 5.0.11
- Fluid CLI 0.1.7
- Location: `/opt/homebrew/bin/fluid`

**If `fluid` command not found**, ensure Homebrew is in your PATH:
```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Add to `~/.zshrc` to make it permanent:
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

## Authentication

**Login to your Fluid account:**
```bash
fluid login
```
This opens your browser to authenticate at admin.fluid.app.

**Check current company:**
```bash
fluid whoami
```

**Switch companies:**
```bash
fluid switch
# or directly
fluid switch -c <company_subdomain>
```

**Logout:**
```bash
fluid logout
```

## Theme Commands

### Pull Existing Theme
Download an existing theme from Fluid:
```bash
fluid theme pull
```
Options:
- `--nodelete` - Preserve local files not on server

### Initialize New Theme
Create a new theme project:
```bash
fluid theme init
```

### Development Server
Start local development server:
```bash
fluid theme dev
```
*Note: Currently works with gem installation. Homebrew fix in progress.*

### Push Changes
Upload local theme changes to Fluid:
```bash
fluid theme push
```
Options:
- `--unpublished` - Create new draft theme instead of updating existing
- `--nodelete` - Preserve server files not in local directory

Examples:
```bash
# Push to existing theme
fluid theme push

# Create new draft theme
fluid theme push --unpublished

# Push without deleting server files
fluid theme push --nodelete
```

## Quick Start Workflow

1. **Authenticate:**
   ```bash
   fluid login
   ```

2. **Pull existing theme or initialize new:**
   ```bash
   fluid theme pull
   # or
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

## Troubleshooting

- **Command not found:** Ensure Homebrew is in PATH (see Installation Status above)
- **"cannot load such file -- pstore" error:** This was fixed by installing the pstore gem. If it reoccurs after updates, run:
  ```bash
  GEM_HOME="/opt/homebrew/Cellar/fluid_cli/0.1.7" /opt/homebrew/opt/ruby/bin/gem install pstore
  ```
- **Authentication issues:** Run `fluid logout` then `fluid login` again
- **Company switch:** Use `fluid switch` to change active company

## Resources

- Documentation: [Fluid Themes CLI Guide](https://docs.fluid.app)
- Support: kevin@fluid.app
