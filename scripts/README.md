# Scripts

This directory contains utility scripts for the sequelize-guard project.

## generate-api-docs.mjs

Automatically generates API documentation from TypeScript source code.

### Usage

```bash
# Run manually
yarn docs:generate

# Or run directly
node scripts/generate-api-docs.mjs
```

### What it does

1. Runs TypeDoc to extract API information from TypeScript source code
2. Generates markdown documentation in the `api` folder
3. Renames `README.md` to `index.mdx` for Fumadocs compatibility
4. Adds frontmatter to the generated documentation
5. Outputs to `apps/sequelize-guard-docs/content/docs/api/`

### Automated Process

This script is automatically run after each release via GitHub Actions:

1. **Release workflow** (`release.yml`) publishes to npm
2. **Update docs workflow** (`update-docs.yml`) is triggered
3. API documentation is generated
4. A pull request is created with the updated documentation

### Manual Updates

If you need to manually update the API documentation:

```bash
# 1. Make sure dependencies are installed
yarn install

# 2. Generate the documentation
yarn docs:generate

# 3. Review the changes
git diff apps/sequelize-guard-docs/content/docs/api/

# 4. Commit if satisfied
git add apps/sequelize-guard-docs/content/docs/api/
git commit -m "docs: update API documentation"
```

## Customizing the Output

To customize the generated API documentation, edit `scripts/generate-api-docs.mjs`:

- Modify the `generateMDX()` function to change the output format
- Update the TypeDoc configuration in `typedoc.json`
- Adjust the frontmatter or content structure as needed

## Dependencies

- **typedoc**: Extracts API information from TypeScript
- **typedoc-plugin-markdown**: Generates markdown output from TypeDoc

These are installed as dev dependencies in the root `package.json`.
