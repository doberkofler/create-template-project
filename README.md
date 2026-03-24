# create-template-project

[![NPM Version](https://img.shields.io/npm/v/create-template-project.svg)](https://www.npmjs.com/package/create-template-project)
[![NPM Downloads](https://img.shields.io/npm/dm/create-template-project.svg)](https://www.npmjs.com/package/create-template-project)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/doberkofler/create-template-project/actions/workflows/node.js.yml/badge.svg)](https://github.com/doberkofler/create-template-project/actions/workflows/node.js.yml)
[![Coverage Status](https://coveralls.io/repos/github/doberkofler/create-template-project/badge.svg?branch=main)](https://coveralls.io/github/doberkofler/create-template-project?branch=main)

An ultra-modular, type-safe Node.js CLI tool used to scaffold new project templates (CLI, Web-Vanilla, Web-App, Web-Fullstack) with best-practice configurations pre-installed.

## 🚀 Quick Start

Run directly without installation:

```bash
npx create-template-project interactive
# or
pnpm dlx create-template-project interactive
```

## ✨ Features

- **Modern Tech Stack:** All templates come with `commitlint`, `husky`, `vitest`, `oxlint`, `oxfmt`, and `typescript` (strict mode).
- **Interactive CLI:** Prompts you for project details if CLI arguments are missing, using `@clack/prompts`.
- **🔄 Update Mode:** Detects existing projects and offers a safe update path.
  - **Intelligent Tracking:** Automatically generates a detailed `GENERATED.md` with an "Upgrade Details" table showing exactly what changed, why, and what actions (like conflict resolution) are needed.
  - **Seed File Protection:** Files in `src/`, all `*.md` files, and other core files are skipped to protect your application logic and custom documentation.
  - **Tooling Sync:** Keeps your project's boilerplate (linting, CI, configs, scripts) up-to-date with the latest template versions.
- **No-Build Option:** Supports creating simple projects without a build step (strips Vite).
- **GitHub Integration:** Automatically initializes a Git repository and can create a GitHub repository using the `gh` CLI.
- **CI Ready:** Generates GitHub Actions workflows for automated testing and linting.

## Installation

```bash
pnpm add -g create-template-project
# or
npm install -g create-template-project
```

Or run directly using pnpm dlx or npx:

```bash
pnpm dlx create-template-project
# or
npx create-template-project
```

## Usage

### Interactive Mode

To start the interactive wizard, use the `interactive` command:

```bash
create-template-project interactive
```

Running the tool without any command will display the help message.

### CLI Commands

You can skip the wizard by using the `create` or `update` commands with the appropriate options.

#### Create a new project

```bash
create-template-project create --template cli --name my-cool-tool --path ./my-cool-tool --github
```

#### Update an existing project

```bash
create-template-project update --template cli
```

#### Global Options:

- `--debug`: Enable debug output
- `-h, --help`: Show help
- `-V, --version`: Show version

#### Command Options (create):

- `-t, --template <type>`: Template type (`cli`, `web-vanilla`, `web-app`, `web-fullstack`)
- `-n, --name <name>`: Project name
- `--description <description>`: Project description
- `-k, --keywords <keywords>`: Project keywords (comma separated)
- `-a, --author <author>`: Author name (defaults to 'git config user.name')
- `--github-username <username>`: GitHub username (defaults to 'git config github.user')
- `-p, --package-manager <pm>`: Package manager (`npm`, `pnpm`, `yarn`) (defaults to `pnpm`)
- `--create-github-repository`: Create GitHub project (requires `gh` CLI authenticated)
- `--path <path>`: Output directory (mandatory)
- `--build`: Run the CI script (lint, build, test) after scaffolding
- `--no-progress`: Do not show progress indicators

#### Command Options (update):

- `-t, --template <type>`: Template type (`cli`, `web-vanilla`, `web-app`, `web-fullstack`)
- `--description <description>`: Project description
- `-k, --keywords <keywords>`: Project keywords (comma separated)
- `-a, --author <author>`: Author name (defaults to 'git config user.name')
- `--github-username <username>`: GitHub username (defaults to 'git config github.user')
- `-p, --package-manager <pm>`: Package manager (`npm`, `pnpm`, `yarn`) (defaults to `pnpm`)
- `--create-github-repository`: Create GitHub project (requires `gh` CLI authenticated)
- `-d, --directory <path>`: Output directory (defaults to `.`)
- `--build`: Run the CI script (lint, build, test) after updating
- `--dev`: Run the dev server after updating
- `--open`: Open the browser after updating
- `--no-progress`: Do not show progress indicators

## Project Templates

### 🟢 CLI

A clean Node.js CLI environment featuring `commander` and `cli-progress`. Supports optional Vite bundling.

### 🔵 Web-Vanilla

Standalone web page setup for modern browsers. Can be used with or without a build step.

### 🟡 Web-App

Modern React application featuring MUI components and TanStack Query for state management.

### ⚛️ Web-Fullstack

A full-stack monorepo featuring:

- **Client**: React with MUI (including Icons) and TypeScript.
- **Server**: Express.js backend with tRPC for end-to-end type safety.
- **E2E**: Playwright for end-to-end testing.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

## License

MIT © [Dieter Oberkofler](https://github.com/doberkofler)
