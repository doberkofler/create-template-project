# create-template-project

[![NPM Version](https://img.shields.io/npm/v/create-template-project.svg)](https://www.npmjs.com/package/create-template-project)
[![NPM Downloads](https://img.shields.io/npm/dm/create-template-project.svg)](https://www.npmjs.com/package/create-template-project)
[![Node.js CI](https://github.com/doberkofler/create-template-project/actions/workflows/node.js.yml/badge.svg)](https://github.com/doberkofler/create-template-project/actions/workflows/node.js.yml)
[![Coverage Status](https://coveralls.io/repos/github/doberkofler/create-template-project/badge.svg?branch=master)](https://coveralls.io/github/doberkofler/create-template-project?branch=master)

An ultra-modular, type-safe Node.js CLI tool used to scaffold new project templates (Node, Vanilla JS, Vanilla HTML, React) with best-practice configurations pre-installed.

## Features

- **Modern Tech Stack:** All templates come with `commitlint`, `husky`, `vitest`, `oxlint`, `prettier`, and `typescript` (strict mode).
- **Interactive CLI:** Prompts you for project details if CLI arguments are missing.
- **GitHub Integration:** Automatically initializes a Git repository and can create a GitHub repository using the `gh` CLI.
- **Modular Templates:** Easily extensible architecture for adding new project types.
- **CI Ready:** Generates GitHub Actions workflows for automated testing and linting.

## Installation

```bash
npm install -g create-template-project
```

Or run directly using npx:

```bash
npx create-template-project
```

## Usage

### Interactive Mode

Simply run the command without arguments to be prompted for project details:

```bash
create-template-project
```

### CLI Arguments

You can also provide arguments to skip prompts:

```bash
create-template-project --template node --name my-cool-api --github
```

#### Options:

- `-t, --template <type>`: Template type (`node`, `vanilla-html`, `vanilla-js`, `react`)
- `-n, --name <name>`: Project name
- `--github`: Create GitHub project (requires `gh` CLI authenticated)
- `-d, --directory <path>`: Output directory (defaults to `.`)
- `-h, --help`: Show help

## Project Templates

### 🟢 Node.js
A clean Node.js environment featuring `tsdown` for bundling, `commander` for CLI development, and `cli-progress`.

### 🔵 Vanilla HTML
Simple static site setup with TypeScript compilation.

### 🟡 Vanilla JavaScript
Monorepo-style structure with a separate `frontend/` and a `backend/` Express server.

### ⚛️ React
Full-stack React setup with MUI, Express backend, and Playwright for E2E testing.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

## License

MIT © [Dieter Oberkofler](https://github.com/doberkofler)
