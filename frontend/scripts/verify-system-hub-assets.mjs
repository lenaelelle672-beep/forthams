import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const workspacePagePath = path.join(frontendRoot, 'src/pages/workspace-preview/WorkspacePreviewPage.tsx');
const manifestPath = path.join(
  frontendRoot,
  'public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-hub-usability-subpages-manifest.json',
);
const baseUrl = process.env.WORKBENCH_BASE_URL ?? 'http://127.0.0.1:5173';

const workspacePage = readFileSync(workspacePagePath, 'utf8');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const menus = Array.from(
  workspacePage.matchAll(/createSystemMenuItem\('([^']+)',\s*'([^']+)',\s*'([^']+)'/g),
  ([, id, group, label]) => ({ id, group, label }),
);
const formalMenuIds = new Set(menus.map((menu) => menu.id));
const formalEntries = manifest.subpages.filter((entry) => formalMenuIds.has(entry.menuId));
const entryByMenuId = new Map(formalEntries.map((entry) => [entry.menuId, entry]));
const failures = [];

function publicAssetFile(publicPath) {
  return path.join(frontendRoot, 'public', publicPath.replace(/^\//, ''));
}

if (menus.length !== 39) {
  failures.push(`expected 39 formal System Hub menus, got ${menus.length}`);
}

if (formalEntries.length !== menus.length) {
  failures.push(`expected ${menus.length} formal manifest entries, got ${formalEntries.length}`);
}

for (const menu of menus) {
  const entry = entryByMenuId.get(menu.id);
  if (!entry) {
    failures.push(`${menu.label} (${menu.id}) is missing from manifest`);
    continue;
  }
  for (const [kind, assetPath] of [
    ['IMAGE2', entry.image2?.path],
    ['Stitch', entry.stitch?.path],
  ]) {
    if (!assetPath) {
      failures.push(`${menu.label} ${kind} path is missing in manifest`);
      continue;
    }
    if (!existsSync(publicAssetFile(assetPath))) {
      failures.push(`${menu.label} ${kind} asset file is missing: ${assetPath}`);
    }
  }
}

if (failures.length > 0) {
  console.error('System Hub asset preflight failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const adminUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['SUPER_ADMIN', 'ADMIN'],
  permissions: [],
};

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.addInitScript((user) => {
    window.localStorage.setItem('auth_token', 'system-hub-assets-verifier-token');
    window.sessionStorage.setItem('auth_token', 'system-hub-assets-verifier-token');
    window.localStorage.setItem('user_info', JSON.stringify(user));
    window.sessionStorage.setItem('user_info', JSON.stringify(user));
  }, adminUser);
  await page.route('**/api/**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [], total: 0 }),
    }),
  );

  for (const menu of menus) {
    const entry = entryByMenuId.get(menu.id);
    const groupMenuCount = menus.filter((candidate) => candidate.group === menu.group).length;
    const matrixLabel = `${menu.group}子页面产品图与 Stitch 矩阵`;
    const isFlowDesignerPage = menu.id === 'system-flow-designer';
    const bridgeLabel = '系统运营中枢整体设计承接';

    await page.goto(`${baseUrl}/fixed-assets/workbench?menu=${menu.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForFunction(
      (label) => document.querySelector('.workspace-topbar-title strong')?.textContent?.includes(label),
      menu.label,
      { timeout: 10_000 },
    );
    await page.waitForSelector(`[aria-label="${bridgeLabel}"]`, { state: 'attached', timeout: 10_000 }).catch(() => null);

    const bridgeAudit = await page.evaluate(
      ({ label, groupLabel }) => {
        const bridgeNode = document.querySelector(`[aria-label="${label}"]`);
        const bridgeStyle = bridgeNode ? getComputedStyle(bridgeNode) : null;
        const visible = Boolean(
          bridgeNode &&
            bridgeStyle?.display !== 'none' &&
            bridgeStyle?.visibility !== 'hidden' &&
            bridgeNode.getBoundingClientRect().width > 0 &&
            bridgeNode.getBoundingClientRect().height > 0,
        );
        const text = bridgeNode?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const images = Array.from(bridgeNode?.querySelectorAll('img') ?? []).map((image) => ({
          src: image.getAttribute('src') ?? '',
          alt: image.getAttribute('alt') ?? '',
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        }));
        return {
          hasBridge: Boolean(bridgeNode),
          visible,
          text,
          imageCount: images.length,
          visibleBrokenImages: visible
            ? images.filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
            : [],
          hasNavigationImage2: images.some((image) => image.src.includes('system-hub-subpage-00-navigation-console-v2.png')),
          hasNavigationStitch: images.some((image) => image.src.includes('stitch-system-hub-subpage-00-navigation-console-v1.png')),
          hasGroupText: text.includes(groupLabel),
          hasNavigationBoundary: text.includes('交互边界') && text.includes('导航只切换') && text.includes('查询在各配置页'),
          hasNavigationSearchPolicy: text.includes('搜索策略'),
        };
      },
      {
        label: bridgeLabel,
        groupLabel: menu.group,
      },
    );

    if (!bridgeAudit.hasBridge) {
      failures.push(`${menu.label} did not render the System Hub design bridge`);
    }
    if (bridgeAudit.imageCount < 4) {
      failures.push(`${menu.label} design bridge should render navigation and group IMAGE2/Stitch assets`);
    }
    if (bridgeAudit.visibleBrokenImages.length > 0) {
      failures.push(`${menu.label} has broken visible design bridge images: ${JSON.stringify(bridgeAudit.visibleBrokenImages)}`);
    }
    if (!bridgeAudit.hasNavigationImage2) {
      failures.push(`${menu.label} design bridge did not render navigation-console IMAGE2 asset`);
    }
    if (!bridgeAudit.hasNavigationStitch) {
      failures.push(`${menu.label} design bridge did not render navigation-console Stitch asset`);
    }
    if (!bridgeAudit.hasGroupText) {
      failures.push(`${menu.label} design bridge did not show current group text: ${menu.group}`);
    }
    if (!bridgeAudit.hasNavigationBoundary) {
      failures.push(`${menu.label} design bridge did not communicate navigation-only interaction boundary`);
    }
    if (bridgeAudit.hasNavigationSearchPolicy) {
      failures.push(`${menu.label} design bridge should not expose search strategy in the navigation summary`);
    }

    if (isFlowDesignerPage) {
      const referenceLabel = '流程设计器产品图与 Stitch 计划';
      await page.waitForSelector(`[aria-label="${referenceLabel}"]`, { state: 'attached', timeout: 10_000 }).catch(() => null);

      const referenceAudit = await page.evaluate(
        ({ label, expectedImage2, expectedStitch, activeLabel }) => {
          const referenceNode = document.querySelector(`[aria-label="${label}"]`);
          const referenceStyle = referenceNode ? getComputedStyle(referenceNode) : null;
          const visible = Boolean(
            referenceNode &&
              referenceStyle?.display !== 'none' &&
              referenceStyle?.visibility !== 'hidden' &&
              referenceNode.getBoundingClientRect().width > 0 &&
              referenceNode.getBoundingClientRect().height > 0,
          );
          const images = Array.from(referenceNode?.querySelectorAll('img') ?? []).map((image) => ({
            src: image.getAttribute('src') ?? '',
            alt: image.getAttribute('alt') ?? '',
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
          }));
          return {
            hasReference: Boolean(referenceNode),
            visible,
            imageCount: images.length,
            visibleBrokenImages: visible
              ? images.filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
              : [],
            hasExpectedImage2: images.some((image) => image.src.includes(expectedImage2) && image.alt.includes(activeLabel)),
            hasExpectedStitch: images.some((image) => image.src.includes(expectedStitch) && image.alt.includes(activeLabel)),
          };
        },
        {
          label: referenceLabel,
          activeLabel: menu.label,
          expectedImage2: entry.image2.path.split('/').pop(),
          expectedStitch: entry.stitch.path.split('/').pop(),
        },
      );

      if (!referenceAudit.hasReference) {
        failures.push(`${menu.label} did not render ${referenceLabel}`);
      }
      if (referenceAudit.imageCount < 4) {
        failures.push(`${menu.label} should render group and subpage IMAGE2/Stitch references`);
      }
      if (referenceAudit.visibleBrokenImages.length > 0) {
        failures.push(`${menu.label} has broken visible reference images: ${JSON.stringify(referenceAudit.visibleBrokenImages)}`);
      }
      if (!referenceAudit.hasExpectedImage2) {
        failures.push(`${menu.label} dedicated IMAGE2 asset did not render from manifest: ${entry.image2.path}`);
      }
      if (!referenceAudit.hasExpectedStitch) {
        failures.push(`${menu.label} dedicated Stitch asset did not render from manifest: ${entry.stitch.path}`);
      }
      continue;
    }

    await page.waitForSelector(`[aria-label="${matrixLabel}"]`, { state: 'attached', timeout: 10_000 }).catch(() => null);

    const runtimeAudit = await page.evaluate(
      ({ activeMenuId, activeLabel, expectedImage2, expectedStitch, groupLabel, expectedImageCount }) => {
        const matrixNode = document.querySelector(`[aria-label="${groupLabel}子页面产品图与 Stitch 矩阵"]`);
        const matrixStyle = matrixNode ? getComputedStyle(matrixNode) : null;
        const visible = Boolean(
          matrixNode &&
            matrixStyle?.display !== 'none' &&
            matrixStyle?.visibility !== 'hidden' &&
            matrixNode.getBoundingClientRect().width > 0 &&
            matrixNode.getBoundingClientRect().height > 0,
        );
        const activeCard = matrixNode?.querySelector(`button.is-active`);
        const images = Array.from(matrixNode?.querySelectorAll('img') ?? []).map((image) => ({
          src: image.getAttribute('src') ?? '',
          alt: image.getAttribute('alt') ?? '',
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        }));
        return {
          activeMenuId,
          hasMatrix: Boolean(matrixNode),
          visible,
          matrixText: matrixNode?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          imageCount: images.length,
          visibleBrokenImages: visible
            ? images.filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
            : [],
          hasExpectedImage2: images.some((image) => image.src.includes(expectedImage2) && image.alt.includes(activeLabel)),
          hasExpectedStitch: images.some((image) => image.src.includes(expectedStitch) && image.alt.includes(activeLabel)),
          activeCardText: activeCard?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          activeCardImages: Array.from(activeCard?.querySelectorAll('img') ?? []).map((image) => ({
            src: image.getAttribute('src') ?? '',
            alt: image.getAttribute('alt') ?? '',
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
          })),
          expectedImageCount,
        };
      },
      {
        activeMenuId: menu.id,
        activeLabel: menu.label,
        expectedImage2: entry.image2.path.split('/').pop(),
        expectedStitch: entry.stitch.path.split('/').pop(),
        groupLabel: menu.group,
        expectedImageCount: groupMenuCount * 2,
      },
    );

    if (!runtimeAudit.hasMatrix) {
      failures.push(`${menu.label} did not render ${matrixLabel}`);
    }
    if (runtimeAudit.imageCount !== runtimeAudit.expectedImageCount) {
      failures.push(
        `${menu.label} rendered ${runtimeAudit.imageCount} matrix images, expected ${runtimeAudit.expectedImageCount}`,
      );
    }
    if (runtimeAudit.visibleBrokenImages.length > 0) {
      failures.push(`${menu.label} has broken visible matrix images: ${JSON.stringify(runtimeAudit.visibleBrokenImages)}`);
    }
    if (!runtimeAudit.hasExpectedImage2) {
      failures.push(`${menu.label} active IMAGE2 asset did not render from manifest: ${entry.image2.path}`);
    }
    if (!runtimeAudit.hasExpectedStitch) {
      failures.push(`${menu.label} active Stitch asset did not render from manifest: ${entry.stitch.path}`);
    }
    if (!runtimeAudit.activeCardText.includes(menu.label)) {
      failures.push(`${menu.label} active matrix card does not match current menu: ${runtimeAudit.activeCardText}`);
    }
    if (runtimeAudit.activeCardImages.length !== 2) {
      failures.push(`${menu.label} active matrix card should render IMAGE2 and Stitch images`);
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error('System Hub runtime asset verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('System Hub runtime asset verification passed.');
console.log(`- menus=${menus.length}`);
console.log(`- formal_manifest_entries=${formalEntries.length}`);
console.log('- every menu declares its group IMAGE2/Stitch matrix with manifest-backed assets');
console.log('- visible design asset blocks must load images when they are not intentionally hidden');
