import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const workspacePagePath = path.join(frontendRoot, 'src/pages/workspace-preview/WorkspacePreviewPage.tsx');
const baseUrl = process.env.WORKBENCH_BASE_URL ?? 'http://127.0.0.1:5173';

const workspacePage = readFileSync(workspacePagePath, 'utf8');
const menus = Array.from(
  workspacePage.matchAll(/createSystemMenuItem\('([^']+)',\s*'([^']+)',\s*'([^']+)'/g),
  ([, id, group, label]) => ({ id, group, label }),
);

if (menus.length !== 39) {
  throw new Error(`Expected 39 formal System Hub menus, got ${menus.length}`);
}

const adminUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['SUPER_ADMIN', 'ADMIN'],
  permissions: [],
};

const viewports = [
  { name: 'desktop', width: 1440, height: 960 },
  { name: 'narrow', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript((user) => {
      window.localStorage.setItem('auth_token', 'system-hub-layout-verifier-token');
      window.sessionStorage.setItem('auth_token', 'system-hub-layout-verifier-token');
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
      await page.goto(`${baseUrl}/fixed-assets/workbench?menu=${menu.id}`, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      });
      await page.waitForTimeout(100);

      const audit = await page.evaluate(() => {
        const rootSelectors = [
          '.workspace-system-page',
          '.workspace-flow-product-page',
          '.workspace-system-module-board',
          '[aria-label$="专用功能面板"]',
        ];
        const pageRoot = rootSelectors.map((selector) => document.querySelector(selector)).find(Boolean);
        const systemPage = document.querySelector('.workspace-system-page');
        const systemDesignBridge = document.querySelector('.workspace-system-design-bridge');
        const systemMain = document.querySelector('.workspace-system-main');
        const systemDetail = document.querySelector('.workspace-system-detail');
        const dedicatedPanel = document.querySelector(
          '.workspace-system-module-board, [aria-label$="专用功能面板"], .workspace-flow-product-page',
        );
        const toRect = (element) => {
          if (!element) return null;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            bottom: Math.round(rect.bottom),
            display: style.display,
            visibility: style.visibility,
            visible:
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 0 &&
              rect.height > 0,
          };
        };
        const side = document.querySelector('.workspace-side');
        const hasScrollableAncestor = (element) => {
          let node = element.parentElement;
          while (node && node !== document.body) {
            const style = getComputedStyle(node);
            const clipsOverflow = /(auto|scroll|hidden)/.test(style.overflowX);
            if (clipsOverflow && node.scrollWidth > node.clientWidth + 4) {
              return true;
            }
            node = node.parentElement;
          }
          return false;
        };
        const uncontainedOverflow = Array.from(document.querySelectorAll('body *'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width < 40 || rect.height < 12) return false;
            if (element.closest('.workspace-flow-canvas-large')) return false;
            if (hasScrollableAncestor(element)) return false;
            return rect.right > window.innerWidth + 10 || rect.left < -10;
          })
          .slice(0, 8)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              className: String(element.className || '').slice(0, 90),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              text: (element.textContent || '').trim().slice(0, 60),
            };
          });
        const topbar = document.querySelector('.workspace-topbar');
        const topbarVisibleChildren = Array.from(topbar?.children ?? [])
          .filter((element) => getComputedStyle(element).display !== 'none')
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              className: String(element.className || '').slice(0, 90),
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
            };
          })
          .filter((rect) => rect.width > 0 && rect.height > 0);
        const topbarChildOverlaps = [];
        for (let firstIndex = 0; firstIndex < topbarVisibleChildren.length; firstIndex += 1) {
          for (let secondIndex = firstIndex + 1; secondIndex < topbarVisibleChildren.length; secondIndex += 1) {
            const first = topbarVisibleChildren[firstIndex];
            const second = topbarVisibleChildren[secondIndex];
            const overlaps =
              first.left < second.right &&
              first.right > second.left &&
              first.top < second.bottom &&
              first.bottom > second.top;
            if (overlaps) {
              topbarChildOverlaps.push({ first, second });
            }
          }
        }

        return {
          url: location.href,
          isLogin: location.pathname.includes('/login'),
          hasPageRoot: Boolean(pageRoot),
          textLength: pageRoot?.textContent?.trim().length ?? 0,
          systemPageClassName: String(systemPage?.className ?? ''),
          systemPageRect: toRect(systemPage),
          systemDesignBridgeRect: toRect(systemDesignBridge),
          systemMainRect: toRect(systemMain),
          systemDetailRect: toRect(systemDetail),
          dedicatedPanelRect: toRect(dedicatedPanel),
          sideTextboxes: side?.querySelectorAll('input, textarea, [role="textbox"]').length ?? 0,
          sideSearchLabels: side?.querySelectorAll('[aria-label*="搜索"], [placeholder*="搜索"]').length ?? 0,
          topbarChildOverlaps,
          uncontainedOverflow,
        };
      });

      if (audit.isLogin) {
        failures.push(`${viewport.name} ${menu.label} redirected to login: ${audit.url}`);
      }
      if (!audit.hasPageRoot || audit.textLength < 20) {
        failures.push(`${viewport.name} ${menu.label} did not render a usable System Hub page root`);
      }
      if (audit.sideTextboxes > 0 || audit.sideSearchLabels > 0) {
        failures.push(`${viewport.name} ${menu.label} left navigation contains search-like controls`);
      }
      if (audit.uncontainedOverflow.length > 0) {
        failures.push(
          `${viewport.name} ${menu.label} has uncontained horizontal overflow: ${JSON.stringify(audit.uncontainedOverflow)}`,
        );
      }
      if (audit.topbarChildOverlaps.length > 0) {
        failures.push(
          `${viewport.name} ${menu.label} topbar children overlap: ${JSON.stringify(audit.topbarChildOverlaps)}`,
        );
      }
      if (menu.group !== '流程平台') {
        if (!audit.systemPageClassName.includes('is-dedicated-configurator')) {
          failures.push(`${viewport.name} ${menu.label} dedicated configurator page is missing full-width class`);
        }
        if (viewport.name === 'desktop') {
          const pageWidth = audit.systemPageRect?.width ?? 0;
          const panelWidth = audit.dedicatedPanelRect?.width ?? 0;
          const mainWidth = audit.systemMainRect?.width ?? 0;
          if (audit.systemDesignBridgeRect?.visible) {
            failures.push(
              `${viewport.name} ${menu.label} exposes the design bridge on a formal System Hub page`,
            );
          }
          if (audit.systemDetailRect?.visible) {
            failures.push(
              `${viewport.name} ${menu.label} exposes the design/audit rail on a formal System Hub page`,
            );
          }
          if (pageWidth > 0 && panelWidth < pageWidth * 0.9) {
            failures.push(
              `${viewport.name} ${menu.label} dedicated panel is too narrow: panel=${panelWidth}, page=${pageWidth}`,
            );
          }
          if (pageWidth > 0 && mainWidth < pageWidth * 0.9) {
            failures.push(
              `${viewport.name} ${menu.label} system main is too narrow: main=${mainWidth}, page=${pageWidth}`,
            );
          }
        }
      }
    }

    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error('System Hub layout verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('System Hub layout verification passed.');
console.log(`- menus=${menus.length}`);
console.log(`- viewports=${viewports.map((viewport) => `${viewport.name}:${viewport.width}x${viewport.height}`).join(', ')}`);
console.log('- left navigation search controls=0');
console.log('- topbar child overlaps=0');
console.log('- uncontained horizontal overflow=0');
console.log('- dedicated configurator workspace width verified');
console.log('- formal System Hub pages hide design bridge and design/audit rail');
