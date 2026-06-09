import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');
const CHECK_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const ALLOWED_PREFIXES = [
  'app/',
  'pages/mobile/',
];
const LEGACY_APP_IMPORT = /\b(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"]@\/app\//;

function collectSourceFiles(dir: string, result: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      collectSourceFiles(path, result);
      continue;
    }
    if ([...CHECK_EXTENSIONS].some((ext) => path.endsWith(ext))) {
      result.push(path);
    }
  }
  return result;
}

describe('legacy app boundary', () => {
  it('keeps desktop source code from importing @/app legacy modules', () => {
    const violations = collectSourceFiles(SRC_ROOT)
      .map((path) => ({ path, rel: relative(SRC_ROOT, path).split('\\').join('/') }))
      .filter(({ rel }) => !ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix)))
      .filter(({ path }) => LEGACY_APP_IMPORT.test(readFileSync(path, 'utf8')))
      .map(({ rel }) => rel);

    expect(violations).toEqual([]);
  });
});
