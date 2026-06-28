import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-vendor-management.mjs <screen-id> <attempt-label>');
}

const exportDir = path.join(root, '.stitch', 'exports', screenId);
const htmlPath = path.join(exportDir, 'screen.html');
const screenshotPath = path.join(exportDir, `chrome-1586x992-${attempt}.png`);
const metricsPath = path.join(exportDir, `browser-1586x992-${attempt}-metrics.json`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1586, height: 992 },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.screenshot({ path: screenshotPath, fullPage: false });

const metrics = await page.evaluate(() => {
  const requiredText = [
    '供应商分类',
    '供应商档案与交易反查',
    '交易反查台',
    '供应商引用矩阵',
    'CT-CIP-2026-09',
    'PO-2026-0318',
    'WO-SSE-2307',
    'REIM-8842',
    'INV-2026-0318-07',
    'JE-2026-0318-07',
    '合同.pdf',
    'PO.pdf',
    '工单.pdf',
    '报销单.pdf',
    '发票.pdf',
    '入账单.pdf',
    '数据截止：2026-05-15 09:51:22',
    '供应商详情',
    '风险提示',
    '发布门禁',
    '审计策略',
    '待完善',
  ];
  const forbiddenText = ['UNIVIEW', '数据截止: 2026-05-15 09:51:22', 'undefined', 'NaN', 'Lorem', 'lorem'];
  const bodyText = document.body.innerText || '';

  const textRects = (needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const rects = [];
    let node;
    while ((node = walker.nextNode())) {
      const value = node.nodeValue || '';
      let start = value.indexOf(needle);
      while (start !== -1) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + needle.length);
        const rect = range.getBoundingClientRect();
        const parent = node.parentElement;
        const style = parent ? window.getComputedStyle(parent) : null;
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          style &&
          style.visibility !== 'hidden' &&
          style.display !== 'none'
        ) {
          rects.push({
            text: needle,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom,
          });
        }
        start = value.indexOf(needle, start + needle.length);
      }
    }
    return rects;
  };

  const targetTexts = [
    '45',
    '126',
    '供应商分类',
    '供应商档案与交易反查',
    '交易反查台',
    '供应商引用矩阵',
    'INV-2026-0318-07',
    'JE-2026-0318-07',
    '发票.pdf',
    '入账单.pdf',
    '共 6 条',
    '20 条/页',
    '供应商详情',
    '风险提示',
    '发布门禁',
    '审计策略',
    '待完善',
  ];
  const targetRects = Object.fromEntries(targetTexts.map((text) => [text, textRects(text)]));

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1586 && rect.bottom <= 992 && predicate(rect)
    );

  const realScrollers = [...document.querySelectorAll('*')]
    .filter((element) => element !== document.documentElement && element !== document.body)
    .map((element) => {
      const style = window.getComputedStyle(element);
      const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
      const hasOverflowRule = /(auto|scroll)/.test(overflow);
      const hasRealOverflow =
        element.scrollHeight > element.clientHeight + 1 ||
        element.scrollWidth > element.clientWidth + 1;
      if (!hasOverflowRule || !hasRealOverflow) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        className: element.className,
        overflow,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
      };
    })
    .filter(Boolean);

  const clippedTargets = Object.fromEntries(
    ['发布门禁', '审计策略', '待完善', '45', '126', 'INV-2026-0318-07', 'JE-2026-0318-07'].map((text) => [
      text,
      (targetRects[text] || []).filter((rect) => rect.x < 0 || rect.y < 0 || rect.right > 1586 || rect.bottom > 992),
    ]),
  );

  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    documentSize: {
      documentElement: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      },
      body: {
        scrollWidth: document.body.scrollWidth,
        scrollHeight: document.body.scrollHeight,
        clientWidth: document.body.clientWidth,
        clientHeight: document.body.clientHeight,
      },
    },
    missing: requiredText.filter((text) => !bodyText.includes(text)),
    forbiddenPresent: forbiddenText.filter((text) => bodyText.includes(text)),
    targetRects,
    visibility: {
      rightRailVisible:
        visibleWithin('供应商详情', (rect) => rect.x >= 1326) &&
        visibleWithin('风险提示', (rect) => rect.x >= 1326) &&
        visibleWithin('发布门禁', (rect) => rect.x >= 1326) &&
        visibleWithin('待完善', (rect) => rect.x >= 1326),
      matrixInsideSourceX:
        visibleWithin('45', (rect) => rect.right <= 1326) &&
        visibleWithin('126', (rect) => rect.right <= 1326 && rect.x >= 996),
      transactionBottomVisible:
        visibleWithin('INV-2026-0318-07', (rect) => rect.bottom <= 958) &&
        visibleWithin('JE-2026-0318-07', (rect) => rect.bottom <= 958) &&
        visibleWithin('发票.pdf', (rect) => rect.bottom <= 958) &&
        visibleWithin('入账单.pdf', (rect) => rect.bottom <= 958),
    },
    clippedTargets,
    realScrollerCount: realScrollers.length,
    realScrollers,
  };
});

fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify({
  screenshotPath,
  metricsPath,
  summary: {
    viewport: metrics.viewport,
    documentSize: metrics.documentSize,
    missing: metrics.missing,
    forbiddenPresent: metrics.forbiddenPresent,
    visibility: metrics.visibility,
    clippedTargets: metrics.clippedTargets,
    realScrollerCount: metrics.realScrollerCount,
  },
}, null, 2));

await browser.close();

const pass =
  metrics.viewport.width === 1586 &&
  metrics.viewport.height === 992 &&
  metrics.documentSize.documentElement.scrollWidth === 1586 &&
  metrics.documentSize.documentElement.scrollHeight === 992 &&
  metrics.documentSize.body.scrollWidth === 1586 &&
  metrics.documentSize.body.scrollHeight === 992 &&
  metrics.missing.length === 0 &&
  metrics.forbiddenPresent.length === 0 &&
  Object.values(metrics.visibility).every(Boolean) &&
  metrics.realScrollerCount === 0;

if (!pass) {
  process.exitCode = 1;
}
