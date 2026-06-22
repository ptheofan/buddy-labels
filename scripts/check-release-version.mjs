import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, '..');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const [tagArgument] = process.argv.slice(2).filter((argument) => argument !== '--');
const tag = String(tagArgument || process.env.GITHUB_REF_NAME || '').trim();

if (!tag) {
  console.error('Usage: pnpm run check:release-version -- v1.0.0');
  process.exit(1);
}

const tagVersion = tag.replace(/^refs\/tags\//, '').replace(/^v/, '');
const packageVersion = String(packageJson.version || '').trim();

if (tagVersion !== packageVersion) {
  console.error(`Release tag ${tag} does not match package.json version ${packageVersion}.`);
  console.error('Update package.json before publishing the release, or use a matching tag.');
  process.exit(1);
}

console.log(`Release version OK: ${tag} matches package.json ${packageVersion}`);
