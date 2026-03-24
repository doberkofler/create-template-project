# Contributing to create-template-project

This guide provides instructions for developers and agentic coding assistants working in this repository.

## Instructions for AI Agents

When working in this repository, please:
1.  **Always run tests:** Before submitting any change, run `pnpm run test` and ensure all tests pass.
2.  **Verify coverage:** Maintain high test coverage for all new logic.
3.  **Lint your changes:** Run `pnpm run lint` to ensure your code follows the project's style.
4.  **Follow Conventions:** Use **Tabs** for indentation and **Single Quotes** for strings.
5.  **ESM Imports:** Always use `.js` extensions in relative imports (e.g., `import { x } from './y.js'`).
6.  **Conventional Commits:** Use the `type(scope): subject` format for commits.

## Project Overview

`create-template-project` is an ultra-modular CLI tool for scaffolding new projects. It aims to provide a "perfect" starting point for various project types, ensuring all best-practice tools are pre-configured.

## Tech Stack

- **Runtime:** Node.js (>=22.0.0)
- **Language:** TypeScript (Strict Mode)
- **CLI Framework:** `commander` and `@clack/prompts`
- **Process Execution:** `execa`
- **Validation:** `zod`
- **Bundler:** `vite`
- **Testing:** `vitest` with `v8` coverage
- **Linting:** `oxlint`, `typescript`, `oxfmt`

## Build and Development Commands

- **Build project:** `pnpm run build`
- **Lint and type-check:** `pnpm run lint`
- **Run all tests with coverage:** `pnpm run test`
- **Run CI checks:** `pnpm run ci` (lint + build + test)
- **Run integration tests:** `pnpm run test:integration` (builds and scaffolds all templates)

### Running Specific Tests

To run a specific test file or test case:
- **By file path:** `pnpm exec vitest src/generators/project.test.ts`
- **By test name:** `pnpm exec vitest -t "scaffold"`

## Code Style Guidelines

### 1. Formatting
- **Indentation:** Use **Tabs**.
- **Quotes:** Use **Single Quotes** (`'`) for strings.
- **Semicolons:** Always use semicolons.

### 2. TypeScript and Types
- **Strict Mode:** Adhere to `strict: true` in `tsconfig.json`.
- **Explicit Returns:** Functions should have explicit return types.
- **Type Safety:** Use Zod for runtime validation where appropriate.

### 3. Naming Conventions
- **Variables/Functions:** `camelCase`.
- **Constants:** `UPPER_SNAKE_CASE`.
- **Files:** `kebab-case.ts`.
- **Templates:** Use the pattern `get[Name]Template` for template getter functions.

### 4. Imports
- **Built-in Modules:** Always use the `node:` prefix (e.g., `import path from 'node:path'`).
- **Extensions:** Relative imports **MUST** include the `.js` extension.

## Commit Message Guidelines

We follow the **Conventional Commits** specification. This is **enforced** by `commitlint` and is required for automated changelog generation.

**Format:** `type(scope): subject`

**Common Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation

**Examples:**
- `feat(cli): add support for jsonc files`
- `fix(parser): handle empty input gracefully`
- `docs: update contributing guidelines`

## Release Process

To release a new version:

```sh
pnpm release -- patch   # or minor / major
```

This will automatically:
1. Run the CI suite (`pnpm run ci`).
2. Bump the version in `package.json`.
3. Update the `CHANGELOG.md`.
4. Commit, tag, and push the changes.
5. Create a GitHub release with auto-generated notes.
6. Publish to npm (if configured).

## Project Structure

- `src/index.ts`: CLI entry point.
- `src/cli.ts`: Argument parsing and interactive prompts.
- `src/templates/`: Individual template definitions (e.g., `base.ts`, `node.ts`).
- `src/generators/`: Scaffolding logic and file writing.
- `src/types.ts`: Shared type definitions and Zod schemas.

## Development Workflow

1.  **Analyze:** Understand the task and the existing code.
2.  **Plan:** Break down the implementation steps.
3.  **Implement:** Write clean, type-safe code following the guidelines.
4.  **Verify:** Run `pnpm run lint` and `pnpm run test`.
5.  **Document:** Update `AGENTS.md` or `README.md` if necessary.
