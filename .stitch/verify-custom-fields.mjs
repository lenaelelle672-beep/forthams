import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-custom-fields.mjs <screen-id> <attempt-label>');
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
    '自定义字段治理台',
    '字段属性',
    '转固批次号',
    '设备序列号',
    'MAC地址',
    '保修到期日',
    '发票号',
    'cip_cap_batch_no',
    'device_serial_no',
    'mac_address',
    'warranty_expire_date',
    'invoice_no',
    'ERP.CIP_BATCH_NO',
    'ERP.SERIAL_NO',
    'ERP.MAC_ADDR',
    'ERP.WARRANTY_END',
    'ERP.INVOICE_NO',
    '^[A-Z0-9-]{1,20}$',
    '查看 236 条实例',
    '风险提示',
    '发布后历史实例保持原字段版本',
    'ERP 回执冻结不允许无痕修改',
    'H5 与桌面布局需同步',
    '发布门禁',
    '编码唯一',
    '类型合法',
    '集成映射',
    '历史影响',
    '待确认',
    '桌面表单预览',
    '钉钉H5预览',
    '导入导出模板',
    '字段影响矩阵',
  ];
  const forbiddenText = ['UM', 'undefined', 'NaN', 'Lorem', 'lorem', '⚠️', '👤', '📞', '🧩', '📱'];
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
    '自定义字段治理台',
    '字段属性',
    'cip_cap_batch_no',
    'device_serial_no',
    'mac_address',
    'warranty_expire_date',
    'invoice_no',
    'ERP.CIP_BATCH_NO',
    '^[A-Z0-9-]{1,20}$',
    '风险提示',
    '发布后历史实例保持原字段版本',
    'ERP 回执冻结不允许无痕修改',
    'H5 与桌面布局需同步',
    '发布门禁',
    '历史影响',
    '待确认',
  ];
  const targetRects = Object.fromEntries(
    targetTexts.map((text) => [text, [...textRects(text), ...formValueRects(text)]]),
  );

  const visibleWithin = (text, predicate = () => true) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= 0 && rect.y >= 0 && rect.right <= 1586 && rect.bottom <= 992 && predicate(rect)
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
      rightPanelHeaderVisible: visibleWithin('字段属性', (rect) => rect.x >= 1280),
      riskCardVisible:
        visibleWithin('风险提示', (rect) => rect.x >= 1280 && rect.y >= 650 && rect.bottom <= 840) &&
        visibleWithin('发布后历史实例保持原字段版本', (rect) => rect.x >= 1280 && rect.bottom <= 840) &&
        visibleWithin('ERP 回执冻结不允许无痕修改', (rect) => rect.x >= 1280 && rect.bottom <= 840) &&
        visibleWithin('H5 与桌面布局需同步', (rect) => rect.x >= 1280 && rect.bottom <= 840),
      releaseGateVisible:
        visibleWithin('发布门禁', (rect) => rect.x >= 1280 && rect.y >= 760 && rect.bottom <= 992) &&
        visibleWithin('历史影响', (rect) => rect.x >= 1280 && rect.bottom <= 992) &&
        visibleWithin('待确认', (rect) => rect.x >= 1280 && rect.bottom <= 992),
      tableHorizontal:
        visibleWithin('cip_cap_batch_no', (rect) => rect.width >= 80 && rect.bottom <= 720) &&
        visibleWithin('device_serial_no', (rect) => rect.width >= 80 && rect.bottom <= 720) &&
        visibleWithin('warranty_expire_date', (rect) => rect.width >= 100 && rect.bottom <= 720),
      bottomCardsVisible:
        bodyText.includes('桌面表单预览') &&
        bodyText.includes('钉钉H5预览') &&
        bodyText.includes('导入导出模板') &&
        bodyText.includes('字段影响矩阵'),
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
    title: metrics.title,
    viewport: metrics.viewport,
    documentSize: metrics.documentSize,
    missing: metrics.missing,
    forbiddenPresent: metrics.forbiddenPresent,
    visibility: metrics.visibility,
    realScrollerCount: metrics.realScrollerCount,
  },
}, null, 2));

await browser.close();
