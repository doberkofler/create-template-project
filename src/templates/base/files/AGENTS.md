# Agent Guidelines: {{projectName}}

This document provides essential instructions for autonomous agents (like Cursor, GitHub Copilot, or CLI agents) working on the `{{projectName}}` repository.

## Build/Lint/Test

- `pnpm run ci`: Runs lint, build, and all tests.
- `pnpm run dev`: Starts the development server.
- `pnpm run test`: Runs unit tests.
- `pnpm run integration-test`: Runs integration tests.
- `pnpm exec vitest <file>`: Runs a specific test file.
- `pnpm run lint`: Lints and formats the codebase (oxlint + oxfmt).

## Project Overview

A modern project built with {{projectName}}, emphasizing type safety, performance, and best practices.

## Build, Lint, and Test Commands

### Core Commands

- **Install dependencies:** `pnpm install`
- **Build project:** `pnpm run build`
- **Lint code:** `pnpm run lint` (runs `tsc`, `oxlint`, and `oxfmt`)
- **Run all tests:** `pnpm run test` (uses `vitest` with coverage)
- **Run CI suite:** `pnpm run ci` (lint + build + test)
- **Run integration tests:** `pnpm run integration-test`

### Targeted Testing

- **Run a single test file:** `pnpm exec vitest src/index.test.ts`
- **Run tests matching a pattern:** `pnpm exec vitest -t "feature"`
- **Watch mode:** `pnpm exec vitest`

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

- **Modularity:** Keep logic modularized.
- **Type Safety:** Use `zod` for runtime schema validation and `z.infer` for type definitions.
- **Immutability:** Prefer `readonly` and `const` where possible to ensure data integrity.

### Naming Conventions

- **Variables/Functions:** `camelCase`.
- **Constants:** `UPPER_SNAKE_CASE`.
- **Files:** `kebab-case.ts`.

### Error Handling

- **CLI Errors:** Throw descriptive errors.
- **Safety:** Always use `try...finally` or `using` (if applicable) to ensure resources like file handles or connections are closed.
- **Validation:** Validate all user inputs and CLI arguments using Zod schemas before processing.

## Mandatory Completion Protocol (Definition of Done)

No task involving code changes is considered complete until the agent provides the following "Evidence of Done" in its final response:

1. **CI Verification:** The agent MUST run `pnpm run ci` and include the full terminal output (showing `Found 0 warnings and 0 errors` and `Tests passed`).
2. **Test Coverage:** The agent MUST ensure that all new code is covered by tests and all existing tests pass.

**Failure to provide these logs means the task is INCOMPLETE.** The user is encouraged to reject any response that lacks this section.

## Git Workflow

- **Conventional Commits:** Adhere to the specification (e.g., `feat:`, `fix:`, `chore:`, `test:`).
- **Hooks:** Husky runs `pnpm run ci` on pre-commit. Do not bypass hooks.
- **Branches:** Use descriptive branch names like `feat/feature-name` or `fix/issue-description`.

