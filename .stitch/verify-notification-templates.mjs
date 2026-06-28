import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-notification-templates.mjs <screen-id> <attempt-label>');
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
    '通知模板配置台',
    '通知模板分组',
    '通知模板列表',
    '模板属性与内容编辑',
    '变量字典',
    '多渠道预览',
    '发布校验清单',
    '流程待办',
    '盘点异常',
    '风险预警',
    '维保派工',
    'CIP 转固',
    '待办到达通知',
    '盘点异常通知',
    '风险预警通知',
    '维保派工通知',
    'CIP 转固提醒',
    'NT_MAINTENANCE_DISPATCH',
    '8/8 完整',
    '7/8 缺1项',
    '9/10 缺1项',
    '变量完整度 96%',
    '{{receiver_name}}',
    '{{asset_name}}',
    '{{todo_title}}',
    '{{risk_level}}',
    '{{process_link}}',
    '插入变量',
    '渲染预览',
    '版本对比',
    '重新校验',
  ];
  const forbiddenText = ['undefined', 'NaN', 'Lorem', 'lorem'];
  const formText = [...document.querySelectorAll('input, textarea, select')]
    .map((element) => element.value || element.getAttribute('value') || [...element.options || []].map((option) => option.textContent || '').join('\n') || '')
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
      .filter((element) => {
        const value = element.value || element.getAttribute('value') || '';
        const optionText = [...element.options || []].map((option) => option.textContent || '').join('\n');
        return value.includes(needle) || optionText.includes(needle);
      })
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
    '待办到达通知',
    '盘点异常通知',
    '风险预警通知',
    '维保派工通知',
    'CIP 转固提醒',
    'NT_MAINTENANCE_DISPATCH',
    '8/8 完整',
    '7/8 缺1项',
    '9/10 缺1项',
    '插入变量',
    '渲染预览',
    '版本对比',
    'receiver_name',
    'process_link',
    '站内通知',
    '钉钉 H5 卡片',
    '重新校验',
  ];
  const targetRects = Object.fromEntries(
    targetTexts.map((text) => [text, [...textRects(text), ...formValueRects(text)]]),
  );

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1586 && rect.bottom <= 992 && predicate(rect)
    );

  const rowTexts = ['待办到达通知', '盘点异常通知', '风险预警通知', '维保派工通知', 'CIP 转固提醒'];
  const tableRowVisibility = Object.fromEntries(
    rowTexts.map((text) => [
      text,
      (targetRects[text] || []).some((rect) =>
        rect.x >= 430 && rect.x <= 1135 && rect.y >= 270 && rect.bottom <= 700 && rect.width >= 42 && rect.height <= 28
      ),
    ]),
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
        className: String(element.className),
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
      allTableRowsHorizontal: Object.values(tableRowVisibility).every(Boolean),
      rightEditorActionsVisible:
        visibleWithin('插入变量', (rect) => rect.x >= 1120 && rect.bottom <= 715) &&
        visibleWithin('渲染预览', (rect) => rect.x >= 1120 && rect.bottom <= 715) &&
        visibleWithin('版本对比', (rect) => rect.x >= 1120 && rect.bottom <= 715),
      bottomCardsVisible:
        visibleWithin('receiver_name', (rect) => rect.y >= 710 && rect.bottom <= 962) &&
        visibleWithin('process_link', (rect) => rect.y >= 710 && rect.bottom <= 962) &&
        visibleWithin('站内通知', (rect) => rect.y >= 710 && rect.bottom <= 962) &&
        visibleWithin('钉钉 H5 卡片', (rect) => rect.y >= 710 && rect.bottom <= 962) &&
        visibleWithin('重新校验', (rect) => rect.y >= 710 && rect.bottom <= 982),
    },
    tableRowVisibility,
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
    tableRowVisibility: metrics.tableRowVisibility,
    realScrollerCount: metrics.realScrollerCount,
  },
}, null, 2));

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

await browser.close();

if (!pass) {
  process.exitCode = 1;
}
