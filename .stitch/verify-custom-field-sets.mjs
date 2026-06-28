import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-custom-field-sets.mjs <screen-id> <attempt-label>');
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
    '自定义字段集编排台',
    '字段集属性',
    '业务对象/字段集方案',
    '字段组成排序',
    '桌面套用预览',
    'H5套用预览',
    '版本影响矩阵',
    'CIP转固字段集',
    'FIELDSET_CIP_TRANSFER',
    'FIELDSET_SERVER',
    'FIELDSET_LAPTOP_OWNER',
    'FIELDSET_INVENTORY_DIFF',
    'FIELDSET_MAINT_ORDER',
    '转固批次号',
    '项目编号',
    '资产小类',
    '供应商',
    '发票号',
    'ERP回执号',
    '唯一性校验',
    '必填校验',
    '值域校验',
    '格式校验',
    '发布后生成字段集版本快照',
    '发布门禁',
    '8/9',
    '编码唯一',
    '字段存在',
    '排序合法',
    '必填策略',
    '布局绑定',
    'H5套用',
    '导入导出',
    '历史影响',
    '待处理',
    '权限审计',
  ];
  const forbiddenText = ['undefined', 'NaN', 'Lorem', 'lorem', '🧩', '📱', '⚠️'];
  const formText = [...document.querySelectorAll('input, textarea, select')]
    .map((element) => element.value || element.getAttribute('value') || '')
    .filter(Boolean)
    .join('\n');
  const bodyText = `${document.body.innerText || ''}\n${formText}`;

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

  const formValueRects = (needle) =>
    [...document.querySelectorAll('input, textarea, select')]
      .filter((element) => (element.value || element.getAttribute('value') || '').includes(needle))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: needle,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        };
      });

  const targetTexts = [
    '字段集属性',
    '发布门禁',
    '8/9',
    '编码唯一',
    '字段存在',
    '排序合法',
    '必填策略',
    '布局绑定',
    'H5套用',
    '导入导出',
    '历史影响',
    '待处理',
    '权限审计',
    '转固批次号',
    '项目编号',
    '资产小类',
    '供应商',
    '发票号',
    'ERP回执号',
    '唯一性校验',
    '必填校验',
    '值域校验',
    '格式校验',
    'FIELDSET_CIP_TRANSFER',
  ];
  const targetRects = Object.fromEntries(
    targetTexts.map((text) => [text, [...textRects(text), ...formValueRects(text)]]),
  );

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

  return {
    title: document.title,
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
      rightPanelHeaderVisible: visibleWithin('字段集属性', (rect) => rect.x >= 1300),
      publishGateVisible:
        visibleWithin('发布门禁', (rect) => rect.x >= 1300) &&
        visibleWithin('8/9', (rect) => rect.x >= 1300) &&
        visibleWithin('历史影响', (rect) => rect.x >= 1300 && rect.bottom <= 992) &&
        visibleWithin('待处理', (rect) => rect.x >= 1300 && rect.bottom <= 992) &&
        visibleWithin('权限审计', (rect) => rect.x >= 1300 && rect.bottom <= 992),
      sortTableVisible:
        visibleWithin('转固批次号', (rect) => rect.right <= 760 && rect.width >= 45) &&
        visibleWithin('ERP回执号', (rect) => rect.right <= 760 && rect.width >= 45) &&
        visibleWithin('唯一性校验', (rect) => rect.right <= 760 && rect.width >= 45) &&
        visibleWithin('格式校验', (rect) => rect.right <= 760 && rect.width >= 45),
      centerTableVisible: visibleWithin('FIELDSET_CIP_TRANSFER', (rect) => rect.x >= 520 && rect.right <= 1000),
    },
    realScrollerCount: realScrollers.length,
    realScrollers,
  };
});

fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify({
  screenshotPath,
  metricsPath,
  summary: {
    title: metrics.title,
    viewport: metrics.viewport,
    documentSize: metrics.documentSize,
    missing: metrics.missing,
    forbiddenPresent: metrics.forbiddenPresent,
    visibility: metrics.visibility,
    realScrollerCount: metrics.realScrollerCount,
  },
}, null, 2));

await browser.close();
