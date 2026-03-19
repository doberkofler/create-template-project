# {{projectName}}

{{description}}

[![NPM Version](https://img.shields.io/npm/v/{{projectName}}.svg)](https://www.npmjs.com/package/{{projectName}})
[![Node.js CI](https://github.com/doberkofler/{{projectName}}/actions/workflows/node.js.yml/badge.svg)](https://github.com/doberkofler/{{projectName}}/actions/workflows/node.js.yml)

## Development Workflow

This project is built using **Vite 8** for high-performance development and bundling.

### Available Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the project for production.
- `npm run preview`: Previews the production build.
- `npm run test`: Runs the unit test suite (browser-based for web targets using **Vitest** and **Playwright**).
- `npm run test:e2e`: Runs E2E tests using **Playwright**.
- `npm run lint`: Lints and formats the codebase using **oxlint** and **prettier**.
- `npm run ci`: Full CI pipeline (lint, build, test).

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start development server**:
   ```bash
   npm run dev
   ```
3. **Run tests**:
   ```bash
   npm run test
   npm run test:e2e
   ```

## Tooling

- **Vite 8**: Modern, ultra-fast development and build tool.
- **Vitest**: Vite-native testing framework with browser support.
- **Playwright**: Reliable E2E and browser automation.
- **oxlint**: Extremely fast JavaScript/TypeScript linter.
- **Prettier**: Opinionated code formatter.
- **Husky & Commitlint**: Ensuring high-quality commit messages.
- **Conventional Changelog**: Automated changelog generation.
