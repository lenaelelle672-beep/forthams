/**
 * System Hub Usability Verifier
 * Checks that all IMAGE2/Stitch assets referenced in the delivery manifest exist.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(resolve(__dirname, '../public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-hub-usability-subpages-manifest.json'), 'utf8')
);

const errors: string[] = [];

for (const entry of manifest.subpages) {
  const image2Path = resolve(__dirname, `../public${entry.image2.path}`);
  const stitchPath = resolve(__dirname, `../public${entry.stitch.path}`);
  const promptPath = resolve(__dirname, '../../', entry.promptFile);

  if (!existsSync(image2Path)) {
    errors.push(`Missing IMAGE2: ${entry.image2.path}`);
  }
  if (!existsSync(stitchPath)) {
    errors.push(`Missing Stitch: ${entry.stitch.path}`);
  }
  if (!existsSync(promptPath)) {
    errors.push(`Missing prompt: ${entry.promptFile}`);
  }
}

if (errors.length > 0) {
  console.error('System Hub usability check FAILED:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
} else {
  console.log('System Hub usability check PASSED');
}
