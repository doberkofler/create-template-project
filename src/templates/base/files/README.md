# {{projectName}}

{{description}}

[![NPM Version](https://img.shields.io/npm/v/{{projectName}}.svg)](https://www.npmjs.com/package/{{projectName}})
[![Node.js CI](https://github.com/doberkofler/{{projectName}}/actions/workflows/node.js.yml/badge.svg)](https://github.com/doberkofler/{{projectName}}/actions/workflows/node.js.yml)

## Development Workflow

This project is built using **Vite 8** for high-performance development and bundling.

### Available Scripts

- `pnpm run dev`: Starts the development server.
- `pnpm run build`: Builds the project for production.
- `pnpm run preview`: Previews the production build.
- `pnpm run test`: Runs the unit test suite (browser-based for web targets using **Vitest** and **Playwright**).
- `pnpm run test:e2e`: Runs E2E tests using **Playwright**.
- `pnpm run lint`: Lints and formats the codebase using **oxlint** and **oxfmt**.
- `pnpm run ci`: Full CI pipeline (lint, build, test).

## Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install
   ```
2. **Start development server**:
   ```bash
   pnpm run dev
   ```
3. **Run tests**:
   ```bash
   pnpm run test
   pnpm run test:e2e
   ```

## Tooling

- **Vite 8**: Modern, ultra-fast development and build tool.
- **Vitest**: Vite-native testing framework with browser support.
- **Playwright**: Reliable E2E and browser automation.
- **oxlint**: Extremely fast JavaScript/TypeScript linter.
- **oxfmt**: High performance JavaScript / TypeScript formatter.
- **Husky & Commitlint**: Ensuring high-quality commit messages.
- **Conventional Changelog**: Automated changelog generation.
