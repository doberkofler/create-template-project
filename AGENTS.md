# Agent Guidelines: create-template-project

This document provides essential instructions for autonomous agents (like Cursor, GitHub Copilot, or CLI agents) working on the `create-template-project` repository.

## Project Overview

An ultra-modular, type-safe Node.js CLI tool used to scaffold new project templates (CLI, Web-Vanilla, Web-App, Web-Fullstack). It emphasizes best practices including strict TypeScript, automated linting, testing, and GitHub integration.

## Build, Lint, and Test Commands

### Core Commands

- **Install dependencies:** `pnpm install`
- **Build project:** `pnpm run build` (uses `vite` and copies templates)
- **Lint code:** `pnpm run lint` (runs `tsc`, `oxlint`, and `oxfmt`)
- **Run all tests:** `pnpm run test` (uses `vitest` with coverage)
- **Run CI suite:** `pnpm run ci` (lint + build + test)
- **Run integration tests:** `pnpm run test:integration` (builds and scaffolds all templates)
- **Check dependencies:** `pnpm run dependencies-check` (verifies template dependencies)

### Targeted Testing

- **Run a single test file:** `pnpm exec vitest src/generators/project.test.ts`
- **Run tests matching a pattern:** `pnpm exec vitest -t "scaffold"`
- **Watch mode:** `pnpm exec vitest`

### CLI Execution (Development)

- **Run interactive wizard:** `pnpm run run-interactive`

## Code Style & Conventions

### Language & Runtime

- **TypeScript:** Strict mode is mandatory. Use explicit types for function boundaries.
- **Node.js:** Targets >= 22.0.0.
- **ESM:** The project uses ES Modules (`"type": "module"` in `package.json`).

### Imports

- **Extensions:** Always use `.js` extensions in relative imports (e.g., `import { main } from './lib.js';`) to comply with ESM requirements in Node.js, even though source files are `.ts`.
- **Built-ins:** Use the `node:` prefix for built-in modules (e.g., `import path from 'node:path';`).

### Formatting

- **Tooling:** oxfmt is enforced via `pnpm run lint`.
- **Indentation:** Tabs are used for indentation.
- **Quotes:** Single quotes for strings, except when double quotes prevent escaping.

### Architecture & Types

- **Modularity:** Keep logic ultra-modularized. Templates must be defined in separate files in `src/templates/`.
- **Dependency Management:** Manage dependencies centrally in `src/config/dependencies.json` and reference them by name in template definitions.
- **Type Safety:** Use `zod` for runtime schema validation and `z.infer` for type definitions.
- **Interfaces:** Define clear interfaces for template configurations in `src/types.ts`.
- **Immutability:** Prefer `readonly` and `const` where possible to ensure data integrity during scaffolding.

### Naming Conventions

- **Variables/Functions:** `camelCase`.
- **Constants:** `UPPER_SNAKE_CASE`.
- **Files:** `kebab-case.ts`.
- **Templates:** Template getter functions should follow the pattern `get[Name]Template`.

### Error Handling

- **CLI Errors:** Throw descriptive errors. The main entry point in `src/index.ts` handles final logging.
- **Safety:** Always use `try...finally` or `using` (if applicable) to ensure resources like file handles or connections are closed.
- **Validation:** Validate all user inputs and CLI arguments using Zod schemas before processing.

### Project Structure

- `src/index.ts`: Entry point. Orchestrates the CLI flow.
- `src/cli.ts`: Argument parsing (using `commander` subcommands: `interactive`, `create`, `update`, `info`) and interactive user prompts (using `@clack/prompts`).
- `src/templates/`: Individual template definitions (e.g., `base/index.ts`, `cli/index.ts`). Each exports a `TemplateDefinition` getter.
- `src/generators/`: Functions that write files and perform side effects like `git init` or `gh repo create`.
- `src/types.ts`: Shared type definitions and Zod schemas.

### Component Requirements for Templates

Every generated project MUST include:

- `commitlint`: For standardized commit messages.
- `debug`: For structured logging.
- `vitest` with coverage: For modern, fast testing.
- `conventional-changelog`: For automated release notes.
- `husky`: For git hooks (pre-commit linting).
- `oxlint` & `oxlint-tsgolint`: For ultra-fast linting.
- `oxfmt`: For consistent formatting.
- `typescript`: Strict mode configuration.
- `AGENTS.md` & `README.md`: With appropriate badges and instructions.
- `CONTRIBUTING.md`: Basic contribution guidelines.

## Git Workflow

- **Conventional Commits:** Adhere to the specification (e.g., `feat:`, `fix:`, `chore:`, `test:`).
- **Hooks:** Husky runs `pnpm run ci` on pre-commit. Do not bypass hooks.
- **Branches:** Use descriptive branch names like `feat/new-template` or `fix/cli-args`.

## AI Agent Interaction Rules

- **Proactiveness:** When adding a new template, also add a corresponding test case in `src/generators/project.test.ts`.
- **Verification:** Always run `pnpm run ci` (which includes linting, building, and testing) after completing any code change to ensure the project remains stable and compliant with all standards.
- **Documentation:** Update this `AGENTS.md` if significant architectural changes are made.
- **AI/Agent Interaction:** Always use the `--no-progress` flag when running the CLI in agent/automated environments to ensure clean output without interactive progress indicators.
- **Templates:** When modifying a template, ensure that the `base.ts` template remains the source of truth for common files. Note that `*.md` files are treated as seed files and are never modified during an `update`.
- **Paths:** Always use `path.join` and `path.resolve` for cross-platform compatibility when handling file generation.
- **Placeholders:** Use dynamic placeholders in template files (like `projectName`) to ensure generated files are customized.
