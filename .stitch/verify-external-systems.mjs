import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-external-systems.mjs <screen-id> <attempt-label>');
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
    '外部系统接入配置台',
    'MES 设备台账',
    'ERP 固资总账',
    'EHR 人员组织',
    'PO/合同平台',
    '供应商门户',
    '异常队列 Webhook',
    '接入系统清单',
    '系统属性',
    '发布校验 5/6',
    '接入链路预览',
    '同步策略',
    '全量初始化',
    '增量同步',
    '失败重试',
    '审计归档',
    '同步记录与变更日志长期留存',
    '待认证',
    '新建外部系统',
    '共 6 条',
    '10 条/页',
  ];
  const forbiddenText = ['待补认证', 'undefined', 'NaN', 'Lorem', 'lorem'];
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
    '同步记录与变更日志长期留存',
    '审计归档',
    '待认证',
    '异常队列 Webhook',
    '新建外部系统',
    '发布校验 5/6',
  ];
  const targetRects = Object.fromEntries(targetTexts.map((text) => [text, textRects(text)]));

  const visibleWithin = (text, maxBottom = 992) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1586 && rect.bottom <= maxBottom
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
      auditDescVisible: visibleWithin('同步记录与变更日志长期留存', 958),
      pendingAuthVisible: visibleWithin('待认证', 992),
      exceptionWebhookVisible: visibleWithin('异常队列 Webhook', 992),
      newSystemVisible: visibleWithin('新建外部系统', 992),
      publishGateVisible: visibleWithin('发布校验 5/6', 992),
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
    viewport: metrics.viewport,
    documentSize: metrics.documentSize,
    missing: metrics.missing,
    forbiddenPresent: metrics.forbiddenPresent,
    visibility: metrics.visibility,
    realScrollerCount: metrics.realScrollerCount,
    targetRects: metrics.targetRects,
  },
}, null, 2));

await browser.close();
