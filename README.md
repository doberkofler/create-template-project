# create-template-project

[![NPM Version](https://img.shields.io/npm/v/create-template-project.svg)](https://www.npmjs.com/package/create-template-project)
[![NPM Downloads](https://img.shields.io/npm/dm/create-template-project.svg)](https://www.npmjs.com/package/create-template-project)
[![Node.js CI](https://github.com/doberkofler/create-template-project/actions/workflows/node.js.yml/badge.svg)](https://github.com/doberkofler/create-template-project/actions/workflows/node.js.yml)
[![Coverage Status](https://coveralls.io/repos/github/doberkofler/create-template-project/badge.svg?branch=master)](https://coveralls.io/github/doberkofler/create-template-project?branch=master)

An ultra-modular, type-safe Node.js CLI tool used to scaffold new project templates (CLI, Web-Vanilla, Web-App, Web-Fullstack) with best-practice configurations pre-installed.

## Features

- **Modern Tech Stack:** All templates come with `commitlint`, `husky`, `vitest`, `oxlint`, `prettier`, and `typescript` (strict mode).
- **Interactive CLI:** Prompts you for project details if CLI arguments are missing, using `@clack/prompts`.
- **Update Mode:** Detects existing projects and offers a safe update path using `git merge-file`.
- **No-Build Option:** Supports creating simple projects without a build step (strips `tsdown`).
- **GitHub Integration:** Automatically initializes a Git repository and can create a GitHub repository using the `gh` CLI.
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

To start the interactive wizard, use the `interactive` command:

```bash
create-template-project interactive
```

Running the tool without any command will display the help message.

### CLI Commands

You can skip the wizard by using the `create` or `update` commands with the appropriate options.

#### Create a new project

```bash
create-template-project create --template cli --name my-cool-tool --github
```

#### Update an existing project

```bash
create-template-project update --template cli --name existing-project
```

#### Global Options:

- `-h, --help`: Show help
- `-V, --version`: Show version

#### Command Options (create/update):

- `-t, --template <type>`: Template type (`cli`, `web-vanilla`, `web-app`, `web-fullstack`)
- `-n, --name <name>`: Project name
- `--github`: Create GitHub project (requires `gh` CLI authenticated)
- `-d, --directory <path>`: Output directory (defaults to `.`)
- `--overwrite`: Overwrite existing directory by removing it first (create & update)
- `--no-build`: Create a project without a build step (not allowed for `web-app`)
- `--silent`: Reduce console output (useful for CI and scripts)

## Project Templates

### 🟢 CLI
A clean Node.js CLI environment featuring `commander` and `cli-progress`. Supports optional `tsdown` bundling.

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
