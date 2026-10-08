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

## Dependency Updates and Releases

Dependencies and releases are driven by the **`update-dependencies`** GitHub Actions workflow (`.github/workflows/update-dependencies.yml`), run manually from the Actions tab or the terminal:

```sh
gh workflow run update-dependencies.yml
```

The workflow:

1. Installs dependencies with the lockfile frozen.
2. Updates dependencies to the newest versions that satisfy the configured **minimum release age** (see below).
3. Runs formatting and the full CI suite; it **stops immediately** if anything fails.
4. Commits and pushes the updates (`chore: update dependencies`) when there are changes.
5. Runs `release-it` for a **patch** release and publishes to npm using **trusted publishing** (OIDC) — no tokens.

### Minimum release age

To reduce supply-chain risk, dependencies are not updated until they have been published for a while. This is enforced per package manager:

- **pnpm** — `minimumReleaseAge` in `pnpm-workspace.yaml` (minutes)
- **Yarn** — `npmMinimalAgeGate` in `.yarnrc.yml`
- **npm** — `min-release-age` in `.npmrc` (days)

### npm trusted publishing

Publishing uses npm's OIDC trusted publishing instead of an `NPM_TOKEN`. Configure it once per package on [npmjs.com](https://www.npmjs.com): open the package, then **Settings → Trusted Publisher → GitHub Actions**, and enter the repository owner, repository name, and workflow filename `update-dependencies.yml`. The package's `repository.url` in `package.json` must match the GitHub repository exactly.

### Manual release

Running `pnpm run release` locally only bumps the version, updates `CHANGELOG.md`, creates the git tag, and creates the GitHub release. It does **not** publish to npm; publishing happens exclusively through the workflow.
