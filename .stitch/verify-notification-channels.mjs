import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-notification-channels.mjs <screen-id> <attempt-label>');
}

const exportDir = path.join(root, '.stitch', 'exports', screenId);
const htmlPath = path.join(exportDir, 'screen.html');
const screenshotPath = path.join(exportDir, `chrome-1585x992-${attempt}.png`);
const metricsPath = path.join(exportDir, `browser-1585x992-${attempt}-metrics.json`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1585, height: 992 },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.screenshot({ path: screenshotPath, fullPage: false });

const metrics = await page.evaluate(() => {
  const requiredText = [
    '通知渠道配置台',
    '钉钉 H5 工作通知',
    'DINGTALK_H5',
    '签名密钥（HMAC-SHA256）',
    '降级到站内消息',
    '张三（资产管理员）',
    '审计要求',
    '必达',
    '普通',
    '渠道健康矩阵',
    '2025-05-21 09:12:11',
    '发布校验清单（12 项）',
    '短信备用未配置',
    '查看全部 12 项校验详情',
  ];
  const forbiddenText = ['NGTALK_H5', '张三（资产管理部）', '发布校验清单 (12 项)', 'undefined', 'NaN'];
  const controls = [...document.querySelectorAll('input, textarea, select')];
  const controlText = controls
    .map((element) => element.value || element.getAttribute('value') || '')
    .filter(Boolean)
    .join('\n');
  const bodyText = `${document.body.innerText || ''}\n${controlText}`;

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

  const fieldRects = (needle) => controls
    .filter((element) => {
      const values = [
        element.value || '',
        element.getAttribute('value') || '',
        element.placeholder || '',
        element.getAttribute('placeholder') || '',
      ];
      return values.some((value) => value.includes(needle));
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        text: needle,
        source: 'field',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      };
    })
    .filter((rect) => rect.width > 0 && rect.height > 0);

  const targetTexts = [
    'DINGTALK_H5',
    '签名密钥（HMAC-SHA256）',
    '降级到站内消息',
    '张三（资产管理员）',
    '审计要求',
    '必达',
    '普通',
    '2025-05-21 09:12:11',
    '发布校验清单（12 项）',
    '短信备用未配置',
    '查看全部 12 项校验详情',
  ];
  const targetRects = Object.fromEntries(targetTexts.map((text) => [text, [...textRects(text), ...fieldRects(text)]]));

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1585 && rect.bottom <= 992 && predicate(rect)
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
    targetTexts.map((text) => [
      text,
      (targetRects[text] || []).filter((rect) => rect.x < 0 || rect.y < 0 || rect.right > 1585 || rect.bottom > 992),
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
    forbiddenPresent: forbiddenText.filter((text) => {
      if (text === 'NGTALK_H5') {
        return /(^|[^A-Z0-9_])NGTALK_H5([^A-Z0-9_]|$)/.test(bodyText);
      }
      return bodyText.includes(text);
    }),
    targetRects,
    visibility: {
      rightEditorComplete:
        visibleWithin('DINGTALK_H5') &&
        visibleWithin('签名密钥（HMAC-SHA256）') &&
        visibleWithin('降级到站内消息') &&
        visibleWithin('张三（资产管理员）') &&
        visibleWithin('审计要求') &&
        visibleWithin('必达') &&
        visibleWithin('普通'),
      bottomHealthVisible: visibleWithin('2025-05-21 09:12:11'),
      publishChecklistVisible:
        visibleWithin('发布校验清单（12 项）') &&
        visibleWithin('短信备用未配置') &&
        visibleWithin('查看全部 12 项校验详情'),
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
