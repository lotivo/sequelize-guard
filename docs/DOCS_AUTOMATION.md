# API documentation automation

The API reference is generated from the released source. Human guides and examples are edited separately; the release workflow opens a documentation PR for the generated pages.

## Preview API changes locally

Use the pinned Yarn 1.22.22 and Node 22 or 24. Install development dependencies before generating:

```bash
corepack yarn install --frozen-lockfile
corepack yarn docs:generate
```

The generator runs local TypeDoc against the current checkout, converts Markdown to MDX and replaces the entire generated API directory. Removed exports therefore disappear from the reference too.

`DOCS_SOURCE_REVISION` can identify the exact checked-out release revision for source links. It does not fetch or switch source. Local uncommitted changes appear in previews, so a preview is not proof of what a release contained.

**Keep generated API changes out of feature PRs.** CI regenerates them for validation. Only the automated post-release documentation PR commits that output.

## What happens after a release

1. The stable npm release workflow completes successfully.
2. The documentation workflow checks out the validated, exact release tag.
3. A read-only job generates the API reference and uploads it as an artifact.
4. A separate job copies that complete API tree into a PR against `master`, including additions and removals.
5. A maintainer reviews and merges the documentation PR.

The workflow waits for npm publication to become visible and checks that the version is still npm's latest stable release before proposing an update. It does not generate from a later `master` or whichever tag happens to be newest.

| Release type | Documentation behavior |
| --- | --- |
| Stable | Opens a generated-reference PR for manual review and merge. |
| Prerelease | Keeps its reference in the tagged source; stable website docs stay unchanged. |
| Manual recovery | Accepts a stable tag created with this workflow, containing the release metadata script. |

Running the documentation workflow does not authorize or perform npm publication.

## Validate a documentation change

After generating the reference locally, run:

```bash
node scripts/check-docs.mjs
corepack yarn workspace sequelize-guard-docs lint
corepack yarn workspace sequelize-guard-docs build
```

The checks cover local links, navigation, docs routes and required UI metadata. Complete examples displayed on the website are compared with their canonical files. External links still depend on the destination service being available.

The packed-consumer tests execute canonical `examples/` against a fresh installation of the exact package archive, including TypeScript, denial and error cases. When reviewing a release documentation PR, check both the generated diff and its source revision.
