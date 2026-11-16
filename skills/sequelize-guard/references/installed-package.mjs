// Run from the consuming application, even when this skill was copied elsewhere.
import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'package.json'));
let directory = path.dirname(realpathSync(require.resolve('sequelize-guard')));
for (;;) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (manifest?.name === 'sequelize-guard') {
    process.stdout.write(JSON.stringify({
      name: manifest.name,
      version: manifest.version,
      sequelize: manifest.peerDependencies?.sequelize,
      root: directory,
      examples: path.join(directory, 'examples'),
      skill: path.join(directory, 'skills/sequelize-guard/SKILL.md'),
    }, null, 2) + '\n');
    break;
  }
  const parent = path.dirname(directory);
  if (parent === directory) throw new Error('Cannot locate resolved sequelize-guard manifest');
  directory = parent;
}
