import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workspacePage = readText('../pages/workspace-preview/WorkspacePreviewPage.tsx');
const matrix = readText('../../../docs/workbench-platform-entry-matrix.md');
const deliveryManifest = JSON.parse(
  readText('../../public/mock/workspace-preview/stitch-suite/delivery-manifest.json'),
) as DeliveryManifest;

const currentDir = dirname(fileURLToPath(import.meta.url));
const assetBase = '/mock/workspace-preview';

describe('Workbench visual asset contract', () => {
  it('keeps Workbench image helper references backed by real product assets', () => {
    const referencedAssets = new Set<string>([
      ...helperReferences('iconAsset', `${assetBase}/icons-v2`),
      ...helperReferences('illustrationAsset', `${assetBase}/illustrations`),
      ...helperReferences('moduleAsset', `${assetBase}/asset-kit-v4/modules`),
      ...helperReferences('assetKitV4', `${assetBase}/asset-kit-v4`),
      ...helperReferences('detailAsset', `${assetBase}/asset-kit-v5/details`),
      ...helperReferences('stitchAsset', `${assetBase}/stitch-suite`),
      `${assetBase}/scene/login5-stitch-factory-cn-v4.png`,
      `${assetBase}/stitch-suite/login5-stitch-refresh.png`,
      `${assetBase}/asset-kit-v4/module-thumbnail-sheet.png`,
      `${assetBase}/asset-kit-v4/asset-kit-v4-preview.png`,
    ]);

    expect(referencedAssets.size).toBeGreaterThanOrEqual(45);
    for (const assetPath of referencedAssets) {
      expect(existsSync(toPublicFile(assetPath)), assetPath).toBe(true);
    }
  });

  it('keeps IMAGE2 asset packages named and sized for their Workbench purpose', () => {
    for (const assetPath of listAssets('/mock/workspace-preview/asset-kit-v4/modules')) {
      expect(basename(assetPath)).toMatch(/^module-[a-z0-9-]+\.png$/);
      expect(readImageSize(assetPath)).toMatchObject({ type: 'png' });
      expect(readImageSize(assetPath).width).toBeGreaterThanOrEqual(512);
      expect(readImageSize(assetPath).height).toBeGreaterThanOrEqual(512);
    }

    for (const assetPath of listAssets('/mock/workspace-preview/asset-kit-v5/details')) {
      expect(basename(assetPath)).toMatch(/^[a-z0-9-]+-v1\.png$/);
      const size = readImageSize(assetPath);
      expect(size.type).toBe('png');
      expect(size.width).toBeGreaterThanOrEqual(1024);
      expect(size.height).toBeGreaterThanOrEqual(1024);
      expect(Math.abs(size.width - size.height)).toBeLessThanOrEqual(4);
    }

    const loginHero = readImageSize('/mock/workspace-preview/scene/login5-stitch-factory-cn-v4.png');
    expect(loginHero.width).toBeGreaterThanOrEqual(1600);
    expect(loginHero.height).toBeGreaterThanOrEqual(900);

  });

  it('keeps Stitch suite and manifest image references present without claiming fresh MCP generation', () => {
    const manifestImagePaths = collectManifestImagePaths(deliveryManifest);
    expect(manifestImagePaths).toContain('/mock/workspace-preview/stitch-suite/contact-sheet-cn-v2.png');
    expect(manifestImagePaths).toContain('/mock/workspace-preview/asset-kit-v4/module-thumbnail-sheet.png');
    expect(manifestImagePaths).toContain('/mock/workspace-preview/asset-kit-v5/details/work-order-flow-v1.png');

    for (const assetPath of manifestImagePaths) {
      expect(existsSync(toPublicFile(assetPath)), assetPath).toBe(true);
    }

    for (const assetPath of listAssets('/mock/workspace-preview/stitch-suite')) {
      if (extname(assetPath) === '.json') {
        continue;
      }
      const size = readImageSize(assetPath);
      expect(size.width).toBeGreaterThanOrEqual(512);
      expect(size.height).toBeGreaterThanOrEqual(256);
    }

    expect(matrix).toContain('## IMAGE2 / Stitch Asset Governance');
    expect(matrix).toContain('Visual asset contract automation');
    expect(matrix).toContain('Stitch MCP preflight on 2026-06-14 returned `Auth required`');
  });

  it('binds Stitch and IMAGE2 assets to the formal Workbench routes', () => {
    const sections = deliveryManifest.connectedRoutes.workbenchSections;
    const bindings = deliveryManifest.formalWorkbenchAssetMap;

    expect(bindings).toHaveLength(4);
    expect(bindings.map((item) => item.name).sort()).toEqual(Object.keys(sections).sort());

    for (const binding of bindings) {
      expect(binding.route).toBe(sections[binding.name]);
      expect(binding.route).toMatch(/^\/fixed-assets\/workbench/);
      expect(binding.route).not.toContain('/workspace-preview');
      expect(binding.stitchScreen).toMatch(/^(overview|analytics|assets|security)$/);
      expect(binding.businessUse.length).toBeGreaterThan(20);
      expect(binding.sourcePolicy).toContain('formal Workbench route');

      const assets = [
        binding.primaryAsset,
        binding.moduleAsset,
        ...binding.detailAssets,
      ];
      for (const assetPath of assets) {
        expect(assetPath).toMatch(/^\/mock\/workspace-preview\/.+\.(png|jpe?g)$/);
        expect(existsSync(toPublicFile(assetPath)), `${binding.name}: ${assetPath}`).toBe(true);
      }
    }

    expect(deliveryManifest.connectedRoutes.designBoard).toBe('/workspace-preview');
    expect(deliveryManifest.connectedRoutes.designBoardDeepLink).toBe('/workspace-preview?tab=stitch');
    expect(deliveryManifest.stitchIntegration.authEvidence.mcpToolListProjects).toContain('Auth required');
  });
});

type WorkbenchAssetBinding = {
  name: string;
  route: string;
  stitchScreen: string;
  primaryAsset: string;
  moduleAsset: string;
  detailAssets: string[];
  businessUse: string;
  sourcePolicy: string;
};

type DeliveryManifest = {
  connectedRoutes: {
    designBoard: string;
    designBoardDeepLink: string;
    workbenchSections: Record<string, string>;
  };
  formalWorkbenchAssetMap: WorkbenchAssetBinding[];
  stitchIntegration: {
    authEvidence: {
      mcpToolListProjects: string;
    };
  };
};

function readText(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function helperReferences(helperName: string, basePath: string, suffix = '') {
  const pattern = new RegExp(`${helperName}\\('([^']+)'\\)`, 'g');
  const refs: string[] = [];
  for (const match of workspacePage.matchAll(pattern)) {
    refs.push(`${basePath}/${match[1]}${suffix}.png`);
  }
  return refs;
}

function listAssets(publicPath: string) {
  const dir = toPublicFile(publicPath);
  return readdirSync(dir)
    .filter((file) => /\.(png|jpe?g|json)$/i.test(file))
    .map((file) => `${publicPath}/${file}`);
}

function collectManifestImagePaths(value: unknown): string[] {
  if (typeof value === 'string') {
    const assetPath = value.split('?')[0];
    return /^\/mock\/workspace-preview\/.+\.(png|jpe?g)$/i.test(assetPath) ? [assetPath] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectManifestImagePaths);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectManifestImagePaths);
  }

  return [];
}

function toPublicFile(publicPath: string) {
  const relativePath = publicPath.replace(/^\//, '');
  return resolve(currentDir, '../../public', relativePath);
}

function readImageSize(publicPath: string) {
  const buffer = readFileSync(toPublicFile(publicPath));
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return {
      type: 'png',
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isStartOfFrame) {
        return {
          type: 'jpg',
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
        };
      }

      offset += 2 + segmentLength;
    }
  }

  throw new Error(`Unsupported image format: ${publicPath}`);
}
