# Documentation Automation

This document describes the automated documentation generation process for sequelize-guard.

## Overview

API documentation is automatically generated from TypeScript source code and updated after each npm release.

## Process Flow

```
1. Push tag (e.g., v6.0.1)
   ↓
2. Release workflow runs (.github/workflows/release.yml)
   - Runs tests
   - Builds package
   - Publishes to npm
   ↓
3. Update docs workflow triggers (.github/workflows/update-docs.yml)
   - Generates API docs from source
   - Creates PR with updated documentation
   ↓
4. Review and merge PR
   - Documentation site automatically updates
```

## Files Involved

### Scripts

- **`scripts/generate-api-docs.mjs`** - Main script that generates API documentation
- **`typedoc.json`** - TypeDoc configuration

### Workflows

- **`.github/workflows/release.yml`** - Handles npm publishing
- **`.github/workflows/update-docs.yml`** - Handles documentation updates

### Output

- **`apps/sequelize-guard-docs/content/docs/api.mdx`** - Generated API documentation

## Manual Usage

### Generate API Documentation

```bash
# Install dependencies (if not already installed)
yarn install

# Generate API documentation
yarn docs:generate
```

This will:

1. Run TypeDoc to extract API information from `packages/sequelize-guard/src/`
2. Convert the output to MDX format
3. Write to `apps/sequelize-guard-docs/content/docs/api.mdx`

### Test Locally

```bash
# Generate docs
yarn docs:generate

# Check the changes
git diff apps/sequelize-guard-docs/content/docs/api.mdx

# If satisfied, commit
git add apps/sequelize-guard-docs/content/docs/api.mdx
git commit -m "docs: update API documentation"
```

## Customization

### Modify Output Format

Edit `scripts/generate-api-docs.mjs`:

```javascript
function generateMDX(apiJson) {
  // Customize the MDX output here
  // Modify frontmatter, content structure, etc.
}
```

### Change TypeDoc Configuration

Edit `typedoc.json`:

```json
{
  "entryPoints": ["./packages/sequelize-guard/src/index.ts"],
  "excludePrivate": true
  // Add more options as needed
}
```

## Workflow Configuration

### Update Docs Workflow

The workflow is triggered automatically after a successful release, but can also be run manually:

1. Go to **Actions** tab on GitHub
2. Select **"Update API Documentation"** workflow
3. Click **"Run workflow"**

### Customize Workflow

Edit `.github/workflows/update-docs.yml`:

- Change the target branch (default: `master`)
- Modify PR labels or assignees
- Adjust commit messages

## Dependencies

The following packages are required (already in `package.json`):

```json
{
  "devDependencies": {
    "typedoc": "^0.27.5",
    "typedoc-plugin-markdown": "^4.4.1"
  }
}
```

## Troubleshooting

### Workflow Not Triggering

**Problem:** Update docs workflow doesn't run after release

**Solution:**

- Check that release workflow completed successfully
- Verify workflow permissions in repository settings
- Manually trigger the workflow from Actions tab

### Generated Documentation is Empty

**Problem:** API documentation file is empty or incomplete

**Solution:**

- Check TypeDoc configuration in `typedoc.json`
- Verify entry points are correct
- Run `yarn docs:generate` locally to debug

### PR Not Created

**Problem:** Workflow runs but no PR is created

**Solution:**

- Check if there are actual changes in the API documentation
- Verify GitHub token has correct permissions
- Check workflow logs for errors

## Best Practices

1. **Review PRs Carefully** - Always review auto-generated PRs before merging
2. **Keep Script Updated** - Update `generate-api-docs.mjs` as API evolves
3. **Test Locally First** - Run `yarn docs:generate` locally before pushing changes
4. **Version Documentation** - Consider adding version tags to generated docs

## Future Improvements

Potential enhancements to consider:

- [ ] Add more detailed API examples in generated docs
- [ ] Include parameter descriptions from JSDoc comments
- [ ] Generate separate pages for each major class
- [ ] Add interactive API playground
- [ ] Version-specific documentation archives

## Support

For issues related to documentation automation:

1. Check this document first
2. Review workflow logs in GitHub Actions
3. Open an issue with the `documentation` label
4. Tag @pankajvaghela for assistance

---

**Last Updated:** December 2025  
**Maintainer:** Pankaj Vaghela
