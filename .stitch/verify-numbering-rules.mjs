import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-numbering-rules.mjs <screen-id> <attempt-label>');
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
    '资产编号规则配置台',
    '新建编号规则',
    '试算编号',
    '冲突检测',
    '保存草稿',
    '提交校验',
    'uniview',
    '固定资产管理系统',
    '当前草稿已保存',
    '编号规则列表',
    '编号规则明细表',
    '编号试算预览',
    '冲突检测队列（共 1 项待处理）',
    '编号规则属性编辑区',
    '发布门禁 / 回滚策略',
    '小类+年月+公共月序列',
    'R-CLS-YM-MSEQ',
    'CIP转固公共月序列',
    'R-CIP-MSEQ',
    '数量折行',
    '序列位数',
    '预览不占号',
    'CIP2026060006',
    '历史锁号重复',
    '手工改号冲突',
    '资产小类缺失',
    '已核销批次只读',
    '数量折行已配置',
    '试算样本通过',
    '回滚方案已编写',
    '已生成资产保留旧编号',
  ];
  const forbiddenText = [
    '数量拆行',
    '序位位数',
    '预留不占号',
    '历史号重复',
    'undefined',
    'NaN',
    'Lorem',
    'lorem',
  ];
  const controls = [...document.querySelectorAll('input, textarea, select')];
  const controlText = controls
    .map((element) =>
      [
        element.value || element.getAttribute('value') || '',
        element.placeholder || element.getAttribute('placeholder') || '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean)
    .join('\n');
  const bodyText = `${document.body.innerText || ''}\n${controlText}`;
  const compactBodyText = bodyText.replace(/\s+/g, '');

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

  const fieldRects = (needle) =>
    controls
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
    '编号规则明细表',
    '小类+年月+公共月序列',
    'CIP转固公共月序列',
    'IT设备编号',
    '服务器编号',
    '备件编码',
    '临时资产编号',
    '编号试算预览',
    'SESMT2026060001',
    'SESMT2026060002',
    'SESMT2026060003',
    'SESMT2026060004',
    'CIP2026060005',
    'CIP2026060006',
    '冲突检测队列（共 1 项待处理）',
    '历史锁号重复',
    '手工改号冲突',
    '资产小类缺失',
    '已核销批次只读',
    '编号规则属性编辑区',
    '序列位数',
    '数量折行',
    '预览不占号',
    '保存草稿',
    '提交校验',
    '试算编号',
    '发布门禁 / 回滚策略',
    '数量折行已配置',
    '试算样本通过',
    '冲突队列已处理',
    '回滚方案已编写',
  ];
  const targetRects = Object.fromEntries(targetTexts.map((text) => [text, rectsFor(text)]));
  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some(
      (rect) =>
        rect.x >= 0 &&
        rect.y >= 0 &&
        rect.right <= 1586 &&
        rect.bottom <= 992 &&
        predicate(rect),
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

  const verticalText = targetTexts
    .flatMap((text) => (targetRects[text] || []).map((rect) => ({ text, ...rect })))
    .filter((rect) => rect.height > rect.width * 1.35 && rect.height >= 24);

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
    missing: [
      ...requiredText.filter((text) => !bodyText.includes(text)),
      ...[
        ['试算样本 3 条', '试算样本3条'],
        ['冲突检测 1 项待处理', '冲突检测1项待处理'],
      ]
        .filter(([, compact]) => !compactBodyText.includes(compact))
        .map(([label]) => label),
    ],
    forbiddenPresent: forbiddenText.filter((text) => bodyText.includes(text)),
    targetRects,
    visibility: {
      detailTableVisible:
        visibleWithin('编号规则明细表', (rect) => rect.x >= 440 && rect.y <= 290) &&
        ['小类+年月+公共月序列', 'CIP转固公共月序列', 'IT设备编号', '服务器编号', '备件编码', '临时资产编号'].every(
          (text) => visibleWithin(text, (rect) => rect.x >= 450 && rect.x <= 1210 && rect.y >= 260 && rect.bottom <= 535),
        ),
      previewVisible:
        visibleWithin('编号试算预览', (rect) => rect.x >= 440 && rect.y >= 500 && rect.bottom <= 590) &&
        ['SESMT2026060001', 'SESMT2026060004', 'CIP2026060005', 'CIP2026060006'].every((text) =>
          visibleWithin(text, (rect) => rect.x >= 450 && rect.x <= 1210 && rect.y >= 560 && rect.bottom <= 805),
        ),
      conflictQueueVisible:
        visibleWithin('冲突检测队列（共 1 项待处理）', (rect) => rect.x >= 440 && rect.y >= 730 && rect.bottom <= 850) &&
        ['历史锁号重复', '手工改号冲突', '资产小类缺失', '已核销批次只读'].every((text) =>
          visibleWithin(text, (rect) => rect.x >= 440 && rect.x <= 1215 && rect.y >= 810 && rect.bottom <= 965),
        ),
      rightEditorVisible:
        visibleWithin('编号规则属性编辑区', (rect) => rect.x >= 1210 && rect.y <= 290) &&
        ['序列位数', '数量折行', '预览不占号'].every((text) =>
          visibleWithin(text, (rect) => rect.x >= 1210 && rect.right <= 1586 && rect.y >= 300 && rect.bottom <= 735),
        ) &&
        visibleWithin('保存草稿', (rect) => rect.x >= 1210 && rect.y >= 650 && rect.bottom <= 735) &&
        visibleWithin('提交校验', (rect) => rect.x >= 1210 && rect.y >= 650 && rect.bottom <= 735) &&
        visibleWithin('试算编号', (rect) => rect.x >= 1210 && rect.y >= 650 && rect.bottom <= 735),
      rightGateVisible:
        visibleWithin('发布门禁 / 回滚策略', (rect) => rect.x >= 1210 && rect.y >= 720 && rect.bottom <= 790) &&
        ['数量折行已配置', '试算样本通过', '冲突队列已处理', '回滚方案已编写'].every((text) =>
          visibleWithin(text, (rect) => rect.x >= 1210 && rect.right <= 1586 && rect.y >= 760 && rect.bottom <= 965),
        ),
    },
    realScrollerCount: realScrollers.length,
    realScrollers,
    verticalText,
  };
});

const html = fs.readFileSync(htmlPath, 'utf8');
const htmlChecks = {
  hasOverflowAuto: /overflow-(?:x-|y-)?auto|overflow:\s*auto|overflow:\s*scroll/.test(html),
  hasForbiddenClass: /max-h-\[|overflow-y-auto|overflow-auto/.test(html),
};

const pass =
  metrics.viewport.width === 1586 &&
  metrics.viewport.height === 992 &&
  metrics.documentSize.documentElement.scrollWidth <= 1586 &&
  metrics.documentSize.documentElement.scrollHeight <= 992 &&
  metrics.documentSize.body.scrollWidth <= 1586 &&
  metrics.documentSize.body.scrollHeight <= 992 &&
  metrics.missing.length === 0 &&
  metrics.forbiddenPresent.length === 0 &&
  Object.values(metrics.visibility).every(Boolean) &&
  metrics.realScrollerCount === 0 &&
  metrics.verticalText.length === 0 &&
  !htmlChecks.hasForbiddenClass;

fs.writeFileSync(
  metricsPath,
  JSON.stringify({ ...metrics, htmlChecks, pass, screenshotPath }, null, 2),
);

await browser.close();

console.log(
  JSON.stringify(
    {
      pass,
      screenshotPath,
      metricsPath,
      missing: metrics.missing,
      forbiddenPresent: metrics.forbiddenPresent,
      visibility: metrics.visibility,
      documentSize: metrics.documentSize,
      realScrollerCount: metrics.realScrollerCount,
      verticalTextCount: metrics.verticalText.length,
      htmlChecks,
    },
    null,
    2,
  ),
);

if (!pass) {
  process.exitCode = 1;
}
