import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-workflow-mail.mjs <screen-id> <attempt-label>');
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
    '流程邮件配置台',
    '流程邮件规则',
    'CIP 转固流程邮件规则',
    '规则字段维护',
    'CIP 转固流程',
    '资产入账流程',
    '资产处置流程',
    '隐患扣款流程',
    'SLA 超时升级',
    'CIP 转固通知',
    '入账完成通知',
    '处置完成通知',
    '扣款提醒',
    'SLA升级通知',
    'MAIL-GW-001',
    '固定资产管理员',
    'CIP 转固流程-转固完成通知',
    'CIP 转固完成通知',
    '抄送规则',
    '失败重试',
    '附件策略',
    '审计要求',
    '邮件预览',
    '变量映射',
    '发送预演与发布校验',
    '发送预演（节点：转固完成）',
    '张三',
    '李四',
    '王五',
    'zhangsan@uniview.com',
    'lisi@uniview.com',
    'wangwu@uniview.com',
    '查看完整日志',
  ];
  const forbiddenText = [
    '发送预演 （节点：转固完成）',
    'undefined',
    'NaN',
    'Lorem',
    'lorem',
    '✉',
    '✈',
    '📧',
    '🔗',
    '👁',
    '⚙',
    '🚀',
  ];
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
    '流程邮件配置台',
    '流程邮件规则',
    'CIP 转固流程邮件规则',
    '规则字段维护',
    'CIP 转固流程',
    '资产入账流程',
    '资产处置流程',
    '隐患扣款流程',
    'SLA 超时升级',
    'CIP 转固通知',
    '入账完成通知',
    '处置完成通知',
    '扣款提醒',
    'SLA升级通知',
    '发送预演（节点：转固完成）',
    '邮件预览',
    '变量映射',
    '发送预演与发布校验',
    '最近审计记录',
    '查看完整日志',
    '规则字段维护',
    '保存草稿',
    '发送预演',
    '提交校验',
  ];
  const targetRects = Object.fromEntries(
    targetTexts.map((text) => [text, [...textRects(text), ...formValueRects(text)]]),
  );

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1586 && rect.bottom <= 992 && predicate(rect)
    );

  const leftTableTexts = [
    'CIP 转固流程',
    '资产入账流程',
    '资产处置流程',
    '隐患扣款流程',
    'SLA 超时升级',
    'CIP 转固通知',
    '入账完成通知',
    '处置完成通知',
    '扣款提醒',
    'SLA升级通知',
  ];
  const leftTableVisibility = Object.fromEntries(
    leftTableTexts.map((text) => [
      text,
      (targetRects[text] || []).some((rect) =>
        rect.x >= 232 &&
        rect.x <= 790 &&
        rect.y >= 250 &&
        rect.bottom <= 670 &&
        rect.right <= 790 &&
        rect.width >= 18 &&
        rect.height <= 34
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
      titleVisible: visibleWithin('流程邮件配置台', (rect) => rect.x >= 220 && rect.y <= 130),
      middleHeaderVisible: visibleWithin('CIP 转固流程邮件规则', (rect) => rect.x >= 780 && rect.right <= 1250),
      rightEditorVisible:
        visibleWithin('规则字段维护', (rect) => rect.x >= 1240) &&
        visibleWithin('保存草稿', (rect) => rect.x >= 1240 && rect.bottom <= 900) &&
        visibleWithin('发送预演', (rect) => rect.x >= 1240 && rect.bottom <= 900) &&
        visibleWithin('提交校验', (rect) => rect.x >= 1240 && rect.bottom <= 900),
      bottomCardsVisible:
        visibleWithin('邮件预览', (rect) => rect.y >= 650 && rect.bottom <= 992) &&
        visibleWithin('变量映射', (rect) => rect.y >= 650 && rect.bottom <= 992) &&
        visibleWithin('发送预演与发布校验', (rect) => rect.y >= 650 && rect.bottom <= 992) &&
        visibleWithin('查看完整日志', (rect) => rect.y >= 760 && rect.bottom <= 992),
      exactPreviewHeadingVisible: visibleWithin('发送预演（节点：转固完成）', (rect) => rect.y >= 680 && rect.bottom <= 992),
      leftTableAllRowsHorizontal: Object.values(leftTableVisibility).every(Boolean),
    },
    leftTableVisibility,
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
    leftTableVisibility: metrics.leftTableVisibility,
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
