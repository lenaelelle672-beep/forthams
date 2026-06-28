import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-mail-logs.mjs <screen-id> <attempt-label>');
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
    '邮件日志与重试策略台',
    '邮件发送日志',
    '最近发送',
    'BATCH-20260618-0931',
    'BATCH-20260618-0928',
    'BATCH-20260618-0925',
    'BATCH-20260618-0912',
    'BATCH-20260618-0907',
    'BATCH-20260618-0886',
    '失败详情与重试策略',
    '处理进度',
    '执行重试',
    '标记已处理',
    '导出取证包',
    '失败重试队列',
    '审计取证包',
    '生成取证包',
    '下载',
  ];
  const forbiddenText = [
    '最后发送',
    'undefined',
    'NaN',
    'Lorem',
    'lorem',
    '💾',
    '📋',
    '🔄',
    '📥',
    '🔍',
    '📅',
    '⚙',
    '✅',
    '🛠',
    '👤',
    '❓',
  ];
  const bodyText = document.body.innerText || '';
  const bodyEmoji = [...bodyText.matchAll(/\p{Extended_Pictographic}/gu)].map((match) => match[0]);

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
    ...requiredText,
    'SMTP 认证失败批次',
    'ERP 回执失败通知',
    '共 286 条',
    '10 条 / 页',
  ];
  const targetRects = Object.fromEntries(targetTexts.map((text) => [text, textRects(text)]));

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1586 && rect.bottom <= 992 && predicate(rect)
    );

  const tableRows = [
    'BATCH-20260618-0931',
    'BATCH-20260618-0928',
    'BATCH-20260618-0925',
    'BATCH-20260618-0912',
    'BATCH-20260618-0907',
    'BATCH-20260618-0886',
  ];
  const tableRowVisibility = Object.fromEntries(
    tableRows.map((text) => [
      text,
      visibleWithin(text, (rect) =>
        rect.x >= 455 &&
        rect.x <= 1203 &&
        rect.y >= 270 &&
        rect.bottom <= 656 &&
        rect.width >= 56 &&
        rect.height <= 36
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
    bodyEmoji,
    targetRects,
    visibility: {
      titleVisible: visibleWithin('邮件日志与重试策略台', (rect) => rect.x >= 220 && rect.y <= 130),
      sixMainRowsVisible: Object.values(tableRowVisibility).every(Boolean),
      centerHeaderExactVisible: visibleWithin('最近发送', (rect) => rect.x >= 455 && rect.right <= 1203 && rect.y >= 236 && rect.bottom <= 330),
      rightPanelVisible:
        visibleWithin('失败详情与重试策略', (rect) => rect.x >= 1212 && rect.bottom <= 330) &&
        visibleWithin('处理进度', (rect) => rect.x >= 1212 && rect.y >= 430 && rect.bottom <= 660) &&
        visibleWithin('执行重试', (rect) => rect.x >= 1212 && rect.bottom <= 706) &&
        visibleWithin('标记已处理', (rect) => rect.x >= 1212 && rect.bottom <= 706) &&
        visibleWithin('导出取证包', (rect) => rect.x >= 1212 && rect.bottom <= 706),
      bottomCardsVisible:
        visibleWithin('失败重试队列', (rect) => rect.x >= 237 && rect.y >= 690 && rect.bottom <= 941) &&
        visibleWithin('审计取证包', (rect) => rect.x >= 847 && rect.y >= 690 && rect.bottom <= 941) &&
        visibleWithin('生成取证包', (rect) => rect.x >= 847 && rect.y >= 690 && rect.bottom <= 941) &&
        visibleWithin('下载', (rect) => rect.x >= 847 && rect.y >= 690 && rect.bottom <= 941),
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
    bodyEmoji: metrics.bodyEmoji,
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
  metrics.bodyEmoji.length === 0 &&
  Object.values(metrics.visibility).every(Boolean) &&
  metrics.realScrollerCount === 0;

await browser.close();

if (!pass) {
  process.exitCode = 1;
}
