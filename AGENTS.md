# Agent Guidelines: create-template-project

This document provides essential instructions for autonomous agents (like Cursor, GitHub Copilot, or CLI agents) working on the `create-template-project` repository.

## Project Overview
An ultra-modular, type-safe Node.js CLI tool used to scaffold new project templates (CLI, Webpage, Webapp, Fullstack). It emphasizes best practices including strict TypeScript, automated linting, testing, and GitHub integration.

## Build, Lint, and Test Commands

### Core Commands
- **Install dependencies:** `npm install`
- **Build project:** `npm run build` (uses `tsdown` to bundle into `dist/`)
- **Lint code:** `npm run lint` (runs `tsc`, `oxlint`, and `prettier`)
- **Run all tests:** `npm run test` (uses `vitest` with coverage)
- **Run CI suite:** `npm run ci` (lint + build + test)

### Targeted Testing
- **Run a single test file:** `npx vitest src/generators/project.test.ts`
- **Run tests matching a pattern:** `npx vitest -t "scaffold"`
- **Watch mode:** `npx vitest`

## Code Style & Conventions

### Language & Runtime
- **TypeScript:** Strict mode is mandatory. Use explicit types for function boundaries.
- **Node.js:** Targets >= 22.0.0.
- **ESM:** The project uses ES Modules (`"type": "module"` in `package.json`).

### Imports
- **Extensions:** Always use `.js` extensions in relative imports (e.g., `import { main } from './lib.js';`) to comply with ESM requirements in Node.js, even though source files are `.ts`.
- **Built-ins:** Use the `node:` prefix for built-in modules (e.g., `import path from 'node:path';`).

### Formatting
- **Tooling:** Prettier is enforced via `npm run lint`.
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
- `src/cli.ts`: Argument parsing (using `commander` subcommands: `onboard`, `create`, `update`) and interactive user prompts (using `@clack/prompts`).
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
- `prettier`: For consistent formatting.
- `typescript`: Strict mode configuration.
- `AGENTS.md` & `README.md`: With appropriate badges and instructions.
- `CONTRIBUTING.md`: Basic contribution guidelines.

## Git Workflow
- **Conventional Commits:** Adhere to the specification (e.g., `feat:`, `fix:`, `chore:`, `test:`).
- **Hooks:** Husky runs `npm run ci` on pre-commit. Do not bypass hooks.
- **Branches:** Use descriptive branch names like `feat/new-template` or `fix/cli-args`.

## AI Agent Interaction Rules
- **Proactiveness:** When adding a new template, also add a corresponding test case in `src/generators/project.test.ts`.
- **Verification:** Always run `npm run lint` before submitting changes to ensure compliance with the strict rules.
- **Documentation:** Update this `AGENTS.md` if significant architectural changes are made.
- **Templates:** When modifying a template, ensure that the `base.ts` template remains the source of truth for common files.
- **Paths:** Always use `path.join` and `path.resolve` for cross-platform compatibility when handling file generation.
- **Placeholders:** Use dynamic placeholders in template files (like `projectName`) to ensure generated files are customized.
