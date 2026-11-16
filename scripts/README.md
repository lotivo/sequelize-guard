# Repository scripts

Use Node 22 (minimum 22.17.1) or 24 and the pinned Yarn 1.22.22. Install development dependencies with `yarn install --frozen-lockfile` before setting production mode.

`yarn build` creates the candidate package. `yarn test:package` packs that build and installs its exact archive with fresh registry dependencies in an isolated temporary consumer; it does not rely on workspace dependency symlinks. Tests exercise native ESM/CommonJS, strict TypeScript NodeNext import/require and Bundler resolution, actual published 6.0.2 migration, package contents and the canonical `examples/` recipes. Registry access and native SQLite support are required. The legacy 6.0.2 fixture has a narrowly scoped Lodash interop bridge; candidate imports remain native.

For an already built archive, run `RELEASE_TARBALL=/absolute/path/candidate.tgz RELEASE_VERSION=6.1.0 node --test scripts/test-package.mjs`. This tests the supplied archive without rebuilding or replacing its release version. Stable/prerelease rehearsals must use the actual corresponding archive/version and preserve its digest.

`yarn docs:generate` runs local TypeDoc from the exact checkout, sets the displayed version from the package manifest and removes stale API artifacts. `DOCS_SOURCE_REVISION` identifies the checked-out release revision for source links. Run `node scripts/check-docs.mjs`, docs lint and docs build afterward. See [documentation automation](../docs/DOCS_AUTOMATION.md).

`node --expose-gc scripts/benchmark-authorization.mjs` measures the built package on a disposable database. Measurements are environment-specific, not latency/capacity guarantees. Real-dialect and standby tests use the isolated URLs/service setup described in the repository workflows; never supply production credentials.
