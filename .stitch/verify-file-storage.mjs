import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-file-storage.mjs <screen-id> <attempt-label>');
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
    '文件存储与缩略图配置台',
    '文件存储策略列表',
    '文件存储策略编排',
    '资产附件主桶',
    'CIP 验收附件归档桶',
    '缩略图生成策略',
    'Office 预览策略',
    '安全扫描规则',
    '对象存储（OSS）- 阿里云',
    '缩略图生成策略（THUMBNAIL_POLICY）',
    '启用（病毒扫描 + 敏感内容识别）',
    '回退到本地临时存储（7 天）',
    '存储拓扑',
    '缩略图队列',
    '预览格式与安全扫描',
    '归档与失败回退',
    'diagram_v2.png',
    '设备铭牌.jpg',
    'plan_floor3.dwg',
    'DWG',
    'EXE',
    '查看全部队列',
    '查看更多格式配置',
    '查看失败明细',
  ];
  const forbiddenText = [
    '文件存储策略编辑',
    'undefined',
    'NaN',
    'Lorem',
    'lorem',
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
    '保存草稿',
    '提交校验',
    '测试连接',
  ];
  const targetRects = Object.fromEntries(targetTexts.map((text) => [text, textRects(text)]));

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1595 && rect.bottom <= 986 && predicate(rect)
    );

  const tableRows = [
    '资产附件主桶',
    'CIP 验收附件归档桶',
    '缩略图生成策略',
    'Office 预览策略',
    '安全扫描规则',
  ];
  const tableRowVisibility = Object.fromEntries(
    tableRows.map((text) => [
      text,
      visibleWithin(text, (rect) =>
        rect.x >= 218 &&
        rect.x <= 970 &&
        rect.y >= 310 &&
        rect.bottom <= 595 &&
        rect.width >= 40 &&
        rect.height <= 38
      ),
    ]),
  );

  const rightFields = [
    '对象存储（OSS）- 阿里云',
    '缩略图生成策略（THUMBNAIL_POLICY）',
    '启用（病毒扫描 + 敏感内容识别）',
    '回退到本地临时存储（7 天）',
  ];
  const rightFieldVisibility = Object.fromEntries(
    rightFields.map((text) => [
      text,
      visibleWithin(text, (rect) => rect.x >= 980 && rect.right <= 1595 && rect.y >= 285 && rect.bottom <= 625),
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
      titleVisible: visibleWithin('文件存储与缩略图配置台', (rect) => rect.x >= 218 && rect.y <= 115),
      fiveTableRowsVisible: Object.values(tableRowVisibility).every(Boolean),
      rightEditorVisible:
        visibleWithin('文件存储策略编排', (rect) => rect.x >= 980 && rect.bottom <= 285) &&
        Object.values(rightFieldVisibility).every(Boolean) &&
        visibleWithin('保存草稿', (rect) => rect.x >= 980 && rect.y >= 540 && rect.bottom <= 635) &&
        visibleWithin('提交校验', (rect) => rect.x >= 980 && rect.y >= 540 && rect.bottom <= 635) &&
        visibleWithin('测试连接', (rect) => rect.x >= 980 && rect.y >= 540 && rect.bottom <= 635),
      bottomTitlesVisible:
        visibleWithin('存储拓扑', (rect) => rect.y >= 610 && rect.bottom <= 700) &&
        visibleWithin('缩略图队列', (rect) => rect.y >= 610 && rect.bottom <= 700) &&
        visibleWithin('预览格式与安全扫描', (rect) => rect.y >= 610 && rect.bottom <= 700) &&
        visibleWithin('归档与失败回退', (rect) => rect.y >= 610 && rect.bottom <= 700),
      bottomContentVisible:
        visibleWithin('diagram_v2.png', (rect) => rect.y >= 650 && rect.bottom <= 950) &&
        visibleWithin('设备铭牌.jpg', (rect) => rect.y >= 650 && rect.bottom <= 950) &&
        visibleWithin('plan_floor3.dwg', (rect) => rect.y >= 650 && rect.bottom <= 970) &&
        visibleWithin('DWG', (rect) => rect.y >= 650 && rect.bottom <= 970) &&
        visibleWithin('EXE', (rect) => rect.y >= 650 && rect.bottom <= 970),
      bottomLinksVisible:
        visibleWithin('查看全部队列', (rect) => rect.y >= 760 && rect.bottom <= 970) &&
        visibleWithin('查看更多格式配置', (rect) => rect.y >= 760 && rect.bottom <= 970) &&
        visibleWithin('查看失败明细', (rect) => rect.y >= 760 && rect.bottom <= 970),
    },
    tableRowVisibility,
    rightFieldVisibility,
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
    rightFieldVisibility: metrics.rightFieldVisibility,
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
  metrics.realScrollerCount === 0;

await browser.close();

if (!pass) {
  process.exitCode = 1;
}
