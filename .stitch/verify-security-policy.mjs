import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-security-policy.mjs <screen-id> <attempt-label>');
}

const exportDir = path.join(root, '.stitch', 'exports', screenId);
const htmlPath = path.join(exportDir, 'screen.html');
const screenshotPath = path.join(exportDir, `chrome-1609x977-${attempt}.png`);
const metricsPath = path.join(exportDir, `browser-1609x977-${attempt}-metrics.json`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1609, height: 977 },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.screenshot({ path: screenshotPath, fullPage: false });

const metrics = await page.evaluate(() => {
  const requiredText = [
    '登录会话与敏感字段策略',
    '安全策略列表',
    '搜索策略名称/策略键',
    '安全策略编排',
    '会话与敏感字段策略',
    'session.sensitive.policy',
    '钉钉 H5 入口校验',
    'dingtalk.h5.verify',
    '高危操作确认',
    'high.risk.confirm',
    '接口密钥轮换',
    'api.key.rotate',
    'CIP 转固敏感字段策略',
    'cip.sensitive.policy',
    '强校验（跳转校验+签名）',
    '按角色脱敏（3级）',
    '审计留痕',
    '应急解锁',
    '保存草稿',
    '提交校验',
    '安全策略地图',
    '高危操作清单',
    '查看全部高危操作',
    '发布复核门禁',
    '查看复核详情',
    '异常登录趋势（最近 7 天）',
    '查看全部趋势',
  ];
  const forbiddenText = [
    'Security Policy Console',
    '安全策略编辑',
    '异常登录趋势 (最近7天)',
    '异常登录趋势\n(最近7天)',
    'undefined',
    'NaN',
    'Lorem',
    'lorem',
  ];
  const controls = [...document.querySelectorAll('input, textarea, select')];
  const controlText = controls
    .map((element) => [
      element.value || element.getAttribute('value') || '',
      element.placeholder || element.getAttribute('placeholder') || '',
    ].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n');
  const bodyText = `${document.body.innerText || ''}\n${controlText}`;

  const isVisibleStyle = (element) => {
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) !== 0;
  };

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
        if (rect.width > 0 && rect.height > 0 && isVisibleStyle(parent)) {
          rects.push({
            source: 'text',
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
        source: 'field',
        text: needle,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      };
    })
    .filter((rect) => rect.width > 0 && rect.height > 0);

  const rectsFor = (needle) => [...textRects(needle), ...fieldRects(needle)];
  const targetTexts = [
    '搜索策略名称/策略键',
    '安全策略编排',
    'session.sensitive.policy',
    'dingtalk.h5.verify',
    'high.risk.confirm',
    'api.key.rotate',
    'cip.sensitive.policy',
    '审计留痕',
    '应急解锁',
    '保存草稿',
    '提交校验',
    '查看全部高危操作',
    '查看复核详情',
    '异常登录趋势（最近 7 天）',
    '查看全部趋势',
  ];
  const targetRects = Object.fromEntries(targetTexts.map((text) => [text, rectsFor(text)]));

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1609 && rect.bottom <= 977 && predicate(rect)
    );

  const rowKeys = [
    'session.sensitive.policy',
    'dingtalk.h5.verify',
    'high.risk.confirm',
    'api.key.rotate',
    'cip.sensitive.policy',
  ];

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
      (targetRects[text] || []).filter((rect) => rect.x < 0 || rect.y < 0 || rect.right > 1609 || rect.bottom > 977),
    ]),
  );

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
      tableFiveRowsVisible: rowKeys.every((text) =>
        visibleWithin(text, (rect) => rect.x >= 250 && rect.x <= 1085 && rect.y >= 330 && rect.bottom <= 680),
      ),
      rightEditorBottomVisible:
        visibleWithin('安全策略编排', (rect) => rect.x >= 1080 && rect.bottom <= 320) &&
        visibleWithin('审计留痕', (rect) => rect.x >= 1080 && rect.bottom <= 720) &&
        visibleWithin('应急解锁', (rect) => rect.x >= 1080 && rect.bottom <= 760) &&
        visibleWithin('保存草稿', (rect) => rect.x >= 1080 && rect.y >= 520 && rect.bottom <= 760) &&
        visibleWithin('提交校验', (rect) => rect.x >= 1080 && rect.y >= 520 && rect.bottom <= 760),
      highRiskLinkVisible: visibleWithin('查看全部高危操作', (rect) => rect.x >= 560 && rect.x <= 930 && rect.bottom <= 945),
      bottomLinksVisible:
        visibleWithin('查看全部高危操作', (rect) => rect.bottom <= 945) &&
        visibleWithin('查看复核详情', (rect) => rect.bottom <= 945) &&
        visibleWithin('查看全部趋势', (rect) => rect.bottom <= 945),
      trendTitleExactVisible: visibleWithin('异常登录趋势（最近 7 天）', (rect) => rect.x >= 1240 && rect.bottom <= 760),
      searchPlaceholderVisible: visibleWithin('搜索策略名称/策略键'),
    },
    clippedTargets,
    realScrollerCount: realScrollers.length,
    realScrollers,
  };
});

const html = fs.readFileSync(htmlPath, 'utf8');
metrics.htmlForbiddenPresent = ['overflow-y-auto', 'overflow-auto', 'Security Policy Console']
  .filter((text) => html.includes(text));

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
    htmlForbiddenPresent: metrics.htmlForbiddenPresent,
    visibility: metrics.visibility,
    clippedTargets: metrics.clippedTargets,
    realScrollerCount: metrics.realScrollerCount,
  },
}, null, 2));

await browser.close();
