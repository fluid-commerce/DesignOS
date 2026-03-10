# Stack Research

**Domain:** AI-powered marketing skill system (Claude Code / Cursor agent toolkit)
**Researched:** 2026-03-10
**Confidence:** HIGH (core stack verified against npm/official docs; some version pins MEDIUM)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | 24.x LTS (Krypton) | Runtime for CLI tools, MCP servers, build scripts | Current LTS with maintenance through Apr 2028. Node 22 (Jod) also acceptable as fallback for wider compatibility. | HIGH |
| TypeScript | 5.9.x | Type safety for CLI tools, MCP servers, React canvas app | Stable, supports `import defer`, erasable syntax for direct Node.js execution. TS 6.0 is RC -- too early for production. | HIGH |
| React | 19.2.x | Canvas iteration tool (preview/annotation app) | Stable with security hardening. Activity API and useEffectEvent available in 19.2. | HIGH |
| Vite | 7.3.x | Dev server and build for React canvas app | Current stable. Vite 8 (Rolldown-based) is beta only -- do not use yet. | HIGH |
| Zod | 4.3.x | Schema validation for skill configs, MCP tool inputs, brand rule validation | Standard for TS schema validation. Required by MCP SDK. Zod 4 has improved generics and z.xor() for exclusive unions. | HIGH |
| @modelcontextprotocol/sdk | 1.27.x | MCP server for canvas tool | Official SDK. Stable v1.x with v2 anticipated Q1-Q2 2026. Use v1 -- it will get 6mo of patches after v2 ships. | HIGH |
| Bash/Zsh | System | Distribution (sync.sh), hooks, deterministic operations | Already proven in the ~/.agents/sync.sh pipeline. Shell scripts for scaffolding, validation, dimension checks. | HIGH |

### MCP Server Layer

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| @modelcontextprotocol/sdk | 1.27.x | Build the canvas MCP server | Official SDK. Use stdio transport for local Claude Code/Cursor integration. Streamable HTTP only if you need remote access later. SSE is deprecated -- skip it. | HIGH |
| FastMCP | latest | Alternative MCP framework if official SDK is too low-level | Higher-level abstraction with built-in auth, custom HTTP routes, Standard Schema support. Consider if you need OAuth or edge deployment. For local stdio tools, the official SDK is simpler. | MEDIUM |

**Recommendation:** Start with the official `@modelcontextprotocol/sdk` for the canvas MCP server. It handles stdio transport cleanly and is what Claude Code expects. FastMCP adds complexity you do not need for a local tool.

### Skill System Layer (No dependencies -- pure markdown + shell)

| Component | Technology | Purpose | Notes |
|-----------|-----------|---------|-------|
| Skill files | Markdown + YAML frontmatter | Skill definitions, workflows, templates, references | Zero runtime deps. This is the proven GSD pattern. |
| Distribution | sync.sh (Bash) | Parse frontmatter, generate commands, sync to Claude/Cursor | Already exists at ~/.agents/sync.sh. Extend, do not replace. |
| CLI tooling | Node.js + CJS | Deterministic operations (validation, scaffolding, state) | Follow GSD pattern: single .cjs entry point + lib/ modules. CJS because Claude Code runs it via `node`, not a bundler. |
| Brand validation | Shell scripts (hooks) | Dimension checks, schema compliance, design token validation | Hooks run before/after agent operations. Pure shell for speed. |

### React Canvas App

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| React | 19.2.x | UI framework | Standard. Server Components not needed -- this is a local preview tool. |
| Vite | 7.3.x | Build/dev server | Fast HMR for iterating on canvas tool. |
| react-frame-component | 5.x | Iframe sandboxing for HTML previews | Renders generated HTML in isolated iframe. Prevents style/script leakage from generated marketing assets into the canvas app. srcDoc approach is safer than dangerouslySetInnerHTML. |
| Tailwind CSS | 4.x | Canvas app UI (not the generated assets) | Fast utility styling for the tool itself. Generated assets use Fluid's design tokens, not Tailwind. |
| zustand | 5.x | State management for canvas | Lightweight, no boilerplate. Stores annotation state, comparison sets, iteration history. Overkill to use Redux for a preview tool. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.21.x | Run TypeScript directly during development | Dev-time only. MCP server dev, quick script prototyping. Not for production CLI (use compiled .cjs). |
| chalk | 5.x | Terminal coloring for CLI output | Skill CLI tools, validation output, error reporting |
| commander | 12.x | CLI argument parsing | If the skill CLI grows beyond simple switch/case. GSD uses raw process.argv -- fine for now, but commander if you add 20+ commands. |
| gray-matter | 4.x | YAML frontmatter parsing in Node.js | sync.sh uses Python for this. If you want to move to Node.js-only distribution, use gray-matter. |
| chokidar | 4.x | File watching for canvas tool | Watch generated asset files, auto-reload preview. |

### Existing Systems to Integrate (Do Not Rebuild)

| System | Version/State | Integration Approach |
|--------|--------------|---------------------|
| Slidev | v52.x | Fluid Payments deck uses 32 layouts, Three.js, GSAP. Write a skill that generates Slidev markdown targeting these layouts. Do not rebuild the layout system. |
| Remotion | v4.x | Existing recipe-driven video system. Write a skill that generates Remotion composition configs. Do not rebuild the rendering pipeline. |
| Shopify Liquid | OS 2.0 | Gold Standard workflow produces .liquid sections. Skills generate .liquid files validated against Gold Standard schema rules. |
| GSD | v1.22.4 | Orchestration framework already in use. Fluid skills will follow GSD patterns (command -> workflow -> template -> reference). Canvas MCP server registers as an MCP tool GSD can call. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsx | Run TS without compile step | `npx tsx src/server.ts` for MCP server dev |
| vitest | Test MCP server tools and canvas components | Vite-native, fast. Use for unit + integration tests of MCP tools. |
| Biome | Lint + format | Faster than ESLint + Prettier. Single tool. If team already uses ESLint, keep it -- switching mid-project has low ROI. |
| Node.js --experimental-strip-types | Run .ts files natively | Node 22.6+ supports this. Alternative to tsx for simple scripts. Requires `--erasableSyntaxOnly` flag in tsconfig. |

## Installation

```bash
# Canvas preview tool (React app)
npm create vite@latest canvas-tool -- --template react-ts
cd canvas-tool
npm install react-frame-component zustand
npm install -D tailwindcss @tailwindcss/vite vitest

# MCP server for canvas tool
mkdir canvas-mcp && cd canvas-mcp
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript tsx @types/node

# CLI tooling (skill validation, scaffolding)
# No npm install needed -- follows GSD pattern of single .cjs files
# with zero external dependencies (uses Node.js built-in fs, path, etc.)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Official MCP SDK | FastMCP | If you need OAuth, custom HTTP routes alongside MCP, or edge deployment. For local stdio tools, official SDK is simpler. |
| Vite 7.3 | Vite 8 beta (Rolldown) | When Vite 8 hits stable (likely Q2 2026). Rolldown will be faster for production builds. Not worth beta risk now. |
| React 19 | Svelte 5 / Vue 3 | Only if the team has strong Svelte/Vue preference. React chosen because Remotion requires React, so the team already knows it. |
| zustand | Jotai / Redux Toolkit | Jotai if you need atomic state. Redux Toolkit if canvas state becomes deeply nested with complex actions. Zustand is the sweet spot for a preview tool. |
| CJS for CLI | ESM for CLI | When Node.js LTS fully stabilizes ESM + JSON imports. CJS is friction-free today for CLI tools Claude invokes via `node script.cjs`. |
| Tailwind 4 | Vanilla CSS / CSS Modules | If the canvas app is very small (< 10 components), vanilla CSS is fine. Tailwind pays off at 10+ components. |
| gray-matter (Node) | Python YAML (current sync.sh) | If you want to eliminate the Python dependency in sync.sh. Current Python approach works fine -- only switch if it becomes a pain point. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Next.js / Remix | Server-side rendering is unnecessary for a local preview tool. Adds routing, middleware, and deployment complexity you do not need. The canvas tool is a single-page app. | Vite + React |
| Electron | The canvas tool does not need native OS APIs. A browser tab is sufficient. Electron adds 200MB+ to distribution. | Vite dev server in browser |
| Docker for MCP servers | Local MCP servers run via stdio -- Docker adds latency and complexity for zero benefit. Claude Code spawns the process directly. | Direct Node.js process via stdio |
| SSE transport for MCP | Deprecated in favor of Streamable HTTP. Will be removed in future MCP SDK versions. | stdio for local, Streamable HTTP for remote |
| Webpack | Slower than Vite for dev and build. No advantages for this use case. | Vite |
| Jest | Slower startup, heavier config than Vitest. Vite-native testing is better for a Vite-based project. | Vitest |
| express / hono for MCP | The MCP SDK handles transport internally. Adding a web framework on top creates unnecessary abstraction layers. | @modelcontextprotocol/sdk built-in transport |
| ESLint + Prettier (separately) | Two tools, two configs, potential conflicts. | Biome (single tool) or keep existing ESLint if already configured |
| Storybook for previews | Overkill for previewing generated HTML assets. Storybook is for component libraries, not rendered marketing collateral. | Custom canvas app with iframe sandboxing |

## Stack Patterns by Domain

**Skill files (brand intelligence, copy rules, layout archetypes):**
- Pure markdown with YAML frontmatter
- No runtime dependencies
- Distributed via sync.sh
- Follow Tier 1-2 skill patterns from the GSD architecture guide

**Orchestrator skills (social post generator, website section generator):**
- Tier 3-4 skill pattern: command -> workflow -> template -> reference
- CLI tool (.cjs) for deterministic validation
- Subagent spawning for copy, layout, styling, spec-check concerns
- State in .planning/ directory per GSD conventions

**MCP canvas server:**
- TypeScript + @modelcontextprotocol/sdk
- stdio transport
- Tools: push_asset, get_annotations, list_assets, compare_variations
- Resources: brand tokens, template library index
- Built as single compiled .cjs for distribution (no node_modules needed at runtime if you bundle)

**React canvas app:**
- Vite + React 19 + Tailwind 4
- iframe sandboxing via react-frame-component for generated HTML preview
- zustand for state (annotations, comparison sets, iteration trajectories)
- Connects to MCP server OR runs standalone with file-watching

**Shell hooks (validation, scaffolding):**
- Pure bash scripts
- Dimension validation (1080x1080, 1200x627, 1340x630)
- Liquid schema validation against Gold Standard rules
- Design token compliance checking
- Template scaffolding (new skill, new template, new brand rule)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| React 19.2.x | Vite 7.3.x + @vitejs/plugin-react 4.x | Stable combination. React 19 + Vite 7 is well-tested. |
| React 19.2.x | Remotion 4.x | Remotion 4 supports React 19. Required for video integration. |
| @modelcontextprotocol/sdk 1.27.x | Node.js 18+ | SDK requires Node 18 minimum. Use Node 24 LTS for best performance. |
| TypeScript 5.9.x | Node.js 24.x | Full support. Use `--erasableSyntaxOnly` for direct execution. |
| Zod 4.3.x | @modelcontextprotocol/sdk 1.27.x | MCP SDK uses Zod for tool input schemas. Ensure same major version. |
| Slidev v52.x | Vue 3.x + Node.js 18+ | Existing deck system. Skills generate markdown, Slidev renders. |

## Sources

- [npm: @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.27.x verified, v2 roadmap confirmed
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- Build patterns, transport recommendations
- [MCP Official Docs: Build a Server](https://modelcontextprotocol.io/docs/develop/build-server) -- stdio vs Streamable HTTP guidance
- [FastMCP GitHub](https://github.com/punkpeye/fastmcp) -- Feature comparison with official SDK
- [Vite Releases](https://vite.dev/releases) -- v7.3.1 stable, v8 beta with Rolldown
- [React v19.2](https://react.dev/blog/2025/10/01/react-19-2) -- Latest stable 19.2.4
- [TypeScript 5.9 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/) -- v5.9.3 stable, TS 6.0 RC
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) -- Node 24 LTS active through Apr 2028
- [Zod v4 Release Notes](https://zod.dev/v4) -- v4.3.6 latest
- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills) -- Unified skills system (commands merged into skills)
- [tsx npm](https://www.npmjs.com/package/tsx) -- v4.21.0 latest
- [Remotion](https://www.remotion.dev/) -- v4.x, React 19 compatible
- [Slidev](https://sli.dev/) -- v52.x latest
- [Shopify Liquid Reference](https://shopify.dev/docs/api/liquid) -- OS 2.0 patterns

---
*Stack research for: Fluid Creative OS -- AI-powered marketing skill system*
*Researched: 2026-03-10*
