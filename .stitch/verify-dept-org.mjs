import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-dept-org.mjs <screen-id> <attempt-label>');
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
    '部门组织与负责人配置',
    '组织架构树',
    '部门列表',
    '部门详情',
    '搜索部门、编码、负责人、成本中心、同步来源',
    '8/12',
    '设备管理部',
    '工程技术中心',
    '资产会计组',
    'CIP项目组',
    '信息技术部',
    '财务共享中心',
    '物流管理组',
    '运维支持组',
    'MM-0051',
    '中（4 条待办，2 条审批）',
    '按组织规则执行',
    '是否启用',
    '保存部门',
    '差异确认',
    '查看审计',
    '审批影响链路与发布检查',
    'CIP立项',
    '费用归集',
    '转固验收',
    '工作交接',
    '负责人变更会影响待办和审批节点，请先生成影响快照。',
    '生成影响快照',
    '发布检查清单',
    '父级路径有效',
    '成本中心已绑定',
    '负责人已确认',
    '同步差异已处理',
    '审批影响已预览',
    '交接规则已配置',
    '提示说明',
    '查看差异详情',
  ];
  const forbiddenText = ['8 / 12', '物资管理组', 'undefined', 'NaN', 'Lorem', 'lorem'];
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
    '搜索部门、编码、负责人、成本中心、同步来源',
    '8/12',
    '设备管理部',
    '物流管理组',
    '运维支持组',
    '中（4 条待办，2 条审批）',
    '按组织规则执行',
    '是否启用',
    '保存部门',
    '查看审计',
    'CIP立项',
    '工作交接',
    '生成影响快照',
    '发布检查清单',
    '交接规则已配置',
    '查看差异详情',
  ];
  const targetRects = Object.fromEntries(
    targetTexts.map((text) => [text, [...textRects(text), ...formValueRects(text)]]),
  );

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1586 && rect.bottom <= 992 && predicate(rect)
    );

  const rowTexts = [
    '设备管理部',
    '工程技术中心',
    '资产会计组',
    'CIP项目组',
    '信息技术部',
    '财务共享中心',
    '物流管理组',
    '运维支持组',
  ];
  const rowVisibility = Object.fromEntries(
    rowTexts.map((text) => [
      text,
      [...textRects(text), ...formValueRects(text)].some((rect) =>
        rect.x >= 430 && rect.x <= 1248 && rect.y >= 250 && rect.bottom <= 690 && rect.width >= 24 && rect.height <= 36
      ),
    ]),
  );

  const rightTexts = [
    '中（4 条待办，2 条审批）',
    '按组织规则执行',
    '是否启用',
    '保存部门',
    '查看审计',
  ];
  const rightVisibility = Object.fromEntries(
    rightTexts.map((text) => [
      text,
      visibleWithin(text, (rect) => rect.x >= 1250 && rect.right <= 1586 && rect.y >= 130 && rect.bottom <= 704),
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
      filterVisible: visibleWithin('搜索部门、编码、负责人、成本中心、同步来源', (rect) => rect.y >= 135 && rect.y <= 220),
      counterExactVisible: visibleWithin('8/12', (rect) => rect.y >= 135 && rect.y <= 220),
      allRowsVisible: Object.values(rowVisibility).every(Boolean),
      rightPanelComplete: Object.values(rightVisibility).every(Boolean),
      bottomBandVisible:
        visibleWithin('CIP立项', (rect) => rect.y >= 700 && rect.bottom <= 958) &&
        visibleWithin('工作交接', (rect) => rect.y >= 700 && rect.bottom <= 958) &&
        visibleWithin('生成影响快照', (rect) => rect.y >= 820 && rect.bottom <= 972) &&
        visibleWithin('交接规则已配置', (rect) => rect.y >= 700 && rect.bottom <= 958) &&
        visibleWithin('查看差异详情', (rect) => rect.y >= 760 && rect.bottom <= 958),
    },
    rowVisibility,
    rightVisibility,
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
    rowVisibility: metrics.rowVisibility,
    rightVisibility: metrics.rightVisibility,
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
