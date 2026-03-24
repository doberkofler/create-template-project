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

**Note:** NPM publishing is **disabled** by default for new projects. To enable it:
1. Set `"private": false` in `package.json`.
2. Set `"publish": true` in `.release-it.json`.
3. Ensure you have the necessary `NPM_TOKEN` configured.

