import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tagPattern =
  /^v((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function releaseMetadata(tag, manifestVersion) {
  const match = tagPattern.exec(tag);
  if (
    !match ||
    match[0] !== tag ||
    tag.length > 257 ||
    match[2]?.split('.').some((part) => /^0[0-9]+$/.test(part))
  ) {
    throw new Error(
      'Invalid release tag. Expected vMAJOR.MINOR.PATCH or a prerelease of it.',
    );
  }

  const [, coreVersion, prerelease] = match;
  if (coreVersion !== manifestVersion) {
    throw new Error(
      `Release tag must match the package manifest version ${manifestVersion}.`,
    );
  }
  return {
    version: tag.slice(1),
    distTag: prerelease ? 'next' : 'latest',
    prerelease: Boolean(prerelease),
  };
}

export async function assertUnpublished(version, fetchVersion = fetch) {
  const url = `https://registry.npmjs.org/sequelize-guard/${encodeURIComponent(version)}`;
  const response = await fetchVersion(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) {
    throw new Error(`sequelize-guard@${version} is already published.`);
  }
  if (response.status !== 404) {
    throw new Error(
      `npm registry returned ${response.status} while checking the release version.`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(
    readFileSync(
      new URL('../packages/sequelize-guard/package.json', import.meta.url),
      'utf8',
    ),
  );
  const metadata = releaseMetadata(
    process.env.RELEASE_TAG ?? '',
    manifest.version,
  );
  if (process.argv.includes('--check-npm'))
    await assertUnpublished(metadata.version);

  const output = Object.entries(metadata)
    .map(([key, value]) => `${key}=${value}\n`)
    .join('');
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
