import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-import-export.mjs <screen-id> <attempt-label>');
}

const exportDir = path.join(root, '.stitch', 'exports', screenId);
const htmlPath = path.join(exportDir, 'screen.html');
const screenshotPath = path.join(exportDir, `chrome-1595x986-${attempt}.png`);
const metricsPath = path.join(exportDir, `browser-1595x986-${attempt}-metrics.json`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1595, height: 986 },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.screenshot({ path: screenshotPath, fullPage: false });

const metrics = await page.evaluate(() => {
  const requiredText = [
    '导入导出模板与队列配置台',
    '导入导出模板列表',
    '导入导出策略编排',
    '待建资产导入',
    'CIP 费用归集导入',
    '资产台账导出',
    '审计取证导出',
    '供应商基础资料导入',
    'v2.3.0（草稿）',
    'Excel（.xlsx）',
    '启用（必填 + 格式 + 业务规则）',
    '生成错误报告（分工作表输出）',
    '脱敏 + 水印（公司名 + 时间戳）',
    '导入默认队列（并发 3，失败重试 2 次）',
    '导入队列（3）',
    '导出队列（2）',
    '查看队列详情',
    '查看全部错误（2）',
    '查看校验报告',
  ];
  const forbiddenText = [
    '导入队列(3)',
    '导出队列(2)',
    '导入导出策略编辑',
    'undefined',
    'NaN',
    'Lorem',
    'lorem',
  ];
  const formText = [...document.querySelectorAll('input, textarea, select')]
    .map((element) => element.value || element.getAttribute('value') || [...(element.options || [])].map((option) => option.textContent || '').join('\n') || '')
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
        const optionText = [...(element.options || [])].map((option) => option.textContent || '').join('\n');
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
    '待建资产导入',
    'CIP 费用归集导入',
    '资产台账导出',
    '审计取证导出',
    '供应商基础资料导入',
    '导入导出策略编排',
    'v2.3.0（草稿）',
    'Excel（.xlsx）',
    '启用（必填 + 格式 + 业务规则）',
    '生成错误报告（分工作表输出）',
    '脱敏 + 水印（公司名 + 时间戳）',
    '导入默认队列（并发 3，失败重试 2 次）',
    '保存草稿',
    '提交校验',
    '试运行',
    '导入队列（3）',
    '导出队列（2）',
    '查看队列详情',
    '查看全部错误（2）',
    '查看校验报告',
    '字段映射预览',
    '队列运行情况',
    '校验错误样例',
    '发布校验清单',
  ];
  const targetRects = Object.fromEntries(
    targetTexts.map((text) => [text, [...textRects(text), ...formValueRects(text)]]),
  );

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1595 && rect.bottom <= 986 && predicate(rect)
    );

  const rowTexts = ['待建资产导入', 'CIP 费用归集导入', '资产台账导出', '审计取证导出', '供应商基础资料导入'];
  const tableRowVisibility = Object.fromEntries(
    rowTexts.map((text) => [
      text,
      (targetRects[text] || []).some((rect) =>
        rect.x >= 219 && rect.x <= 970 && rect.y >= 246 && rect.bottom <= 606 && rect.width >= 28 && rect.height <= 32
      ),
    ]),
  );

  const rightTexts = [
    'v2.3.0（草稿）',
    'Excel（.xlsx）',
    '启用（必填 + 格式 + 业务规则）',
    '生成错误报告（分工作表输出）',
    '脱敏 + 水印（公司名 + 时间戳）',
    '导入默认队列（并发 3，失败重试 2 次）',
  ];
  const rightRowVisibility = Object.fromEntries(
    rightTexts.map((text) => [
      text,
      visibleWithin(text, (rect) => rect.x >= 972 && rect.right <= 1595 && rect.y >= 246 && rect.bottom <= 606),
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
      rightPanelComplete:
        visibleWithin('导入导出策略编排', (rect) => rect.x >= 972 && rect.bottom <= 310) &&
        Object.values(rightRowVisibility).every(Boolean) &&
        visibleWithin('保存草稿', (rect) => rect.x >= 972 && rect.y >= 520 && rect.bottom <= 606) &&
        visibleWithin('提交校验', (rect) => rect.x >= 972 && rect.y >= 520 && rect.bottom <= 606) &&
        visibleWithin('试运行', (rect) => rect.x >= 972 && rect.y >= 520 && rect.bottom <= 606),
      bottomCardsVisible:
        visibleWithin('字段映射预览', (rect) => rect.y >= 630 && rect.bottom <= 700) &&
        visibleWithin('队列运行情况', (rect) => rect.y >= 630 && rect.bottom <= 700) &&
        visibleWithin('校验错误样例', (rect) => rect.y >= 630 && rect.bottom <= 700) &&
        visibleWithin('发布校验清单', (rect) => rect.y >= 630 && rect.bottom <= 700),
      bottomLinksVisible:
        visibleWithin('导入队列（3）', (rect) => rect.y >= 640 && rect.bottom <= 946) &&
        visibleWithin('导出队列（2）', (rect) => rect.y >= 640 && rect.bottom <= 946) &&
        visibleWithin('查看队列详情', (rect) => rect.y >= 640 && rect.bottom <= 946) &&
        visibleWithin('查看全部错误（2）', (rect) => rect.y >= 640 && rect.bottom <= 946) &&
        visibleWithin('查看校验报告', (rect) => rect.y >= 640 && rect.bottom <= 946),
    },
    tableRowVisibility,
    rightRowVisibility,
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
    rightRowVisibility: metrics.rightRowVisibility,
    realScrollerCount: metrics.realScrollerCount,
  },
}, null, 2));

const pass =
  metrics.viewport.width === 1595 &&
  metrics.viewport.height === 986 &&
  metrics.documentSize.documentElement.scrollWidth === 1595 &&
  metrics.documentSize.documentElement.scrollHeight === 986 &&
  metrics.documentSize.body.scrollWidth === 1595 &&
  metrics.documentSize.body.scrollHeight === 986 &&
  metrics.missing.length === 0 &&
  metrics.forbiddenPresent.length === 0 &&
  Object.values(metrics.visibility).every(Boolean) &&
  Object.values(metrics.tableRowVisibility).every(Boolean) &&
  Object.values(metrics.rightRowVisibility).every(Boolean) &&
  metrics.realScrollerCount === 0;

await browser.close();

if (!pass) {
  process.exitCode = 1;
}
