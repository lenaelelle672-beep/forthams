import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2];
const attempt = process.argv[3] || 'attempt';

if (!screenId) {
  throw new Error('Usage: node .stitch/verify-field-mapping.mjs <screen-id> <attempt-label>');
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
    '字段映射工作台',
    '字段映射视图',
    '映射关系画布',
    '字段映射配置编辑区',
    '样例数据预览',
    '缺失字段异常',
    '冲突检测',
    '发布门禁',
    '维护映射',
    '样例校验',
    '保存草稿',
    '提交校验',
    'asset_class',
    'asset_no',
    'asset_name',
    'amount',
    'currency',
    'emp_no',
    'dept_code',
    'purchase_date',
    'contract_no',
    '资产小类',
    '资产编码',
    '资产名称',
    '原值',
    '币种',
    '工号',
    '部门编码',
    '取得日期',
    'MES 设备绑定',
    '/api/asset/bind',
    '映射表',
    'A: 电子设备，B: 机械设备，C: 办公设备，D: 其他',
    '必填校验',
    '进入数据异常队列',
    '记录变更明细',
    'M2024050005',
    'ZC2024050005',
    '进入异常队列',
    '查看冲突详情',
    '警告（2）',
    '失败（1）',
  ];
  const forbiddenText = ['undefined', 'NaN', 'Lorem', 'lorem', '待补认证'];
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
    '字段映射工作台',
    '字段映射视图',
    '映射关系画布',
    '字段映射配置编辑区',
    'MES 设备绑定',
    '/api/asset/bind',
    'asset_class',
    '资产小类',
    '映射表',
    '进入数据异常队列',
    '记录变更明细',
    '样例数据预览',
    'M2024050005',
    'ZC2024050005',
    '缺失字段异常',
    '进入异常队列',
    '冲突检测',
    '查看冲突详情',
    '发布门禁',
    '警告（2）',
    '失败（1）',
    'asset_no',
    'asset_name',
    'amount',
    'currency',
    'emp_no',
    'dept_code',
    'purchase_date',
    'supplier_id',
    'contract_no',
    'M2024050001',
    'M2024050002',
    'M2024050003',
    'M2024050004',
    'M2024050005',
    'ZC2024050001',
    'ZC2024050002',
    'ZC2024050003',
    'ZC2024050004',
    'ZC2024050005',
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

  const paths = [...document.querySelectorAll('svg path')].map((pathElement) => {
    const rect = pathElement.getBoundingClientRect();
    const d = pathElement.getAttribute('d') || '';
    return {
      d,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
      curved: /[CQST]/.test(d),
      nonHorizontal: rect.height >= 8,
    };
  });

  const leftTableRows = [
    'asset_class',
    'asset_no',
    'asset_name',
    'amount',
    'currency',
    'emp_no',
    'dept_code',
    'purchase_date',
    'supplier_id',
    'contract_no',
  ];
  const sampleRows = [
    'M2024050001',
    'M2024050002',
    'M2024050003',
    'M2024050004',
    'M2024050005',
    'ZC2024050001',
    'ZC2024050002',
    'ZC2024050003',
    'ZC2024050004',
    'ZC2024050005',
  ];
  const visibleInRect = (text, bounds) =>
    (targetRects[text] || []).some((rect) =>
      rect.x >= bounds.x &&
      rect.y >= bounds.y &&
      rect.right <= bounds.right &&
      rect.bottom <= bounds.bottom
    );

  const nativeSelects = [...document.querySelectorAll('select')].map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      value: element.value,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    };
  });

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
      titleVisible: visibleWithin('字段映射工作台', (rect) => rect.y <= 160),
      tableVisible: visibleWithin('字段映射视图', (rect) => rect.y >= 260 && rect.y <= 420),
      canvasVisible: visibleWithin('映射关系画布', (rect) => rect.y >= 260 && rect.y <= 420),
      editorHeaderVisible: visibleWithin('字段映射配置编辑区', (rect) => rect.x >= 1200 && rect.y >= 250),
      editorValuesVisible:
        visibleWithin('MES 设备绑定', (rect) => rect.x >= 1200 && rect.bottom <= 720) &&
        visibleWithin('/api/asset/bind', (rect) => rect.x >= 1200 && rect.bottom <= 720) &&
        visibleWithin('asset_class', (rect) => rect.x >= 1200 && rect.bottom <= 720) &&
        visibleWithin('资产小类', (rect) => rect.x >= 1200 && rect.bottom <= 720) &&
        visibleWithin('进入数据异常队列', (rect) => rect.x >= 1200 && rect.bottom <= 720) &&
        visibleWithin('记录变更明细', (rect) => rect.x >= 1200 && rect.bottom <= 720),
      leftTableTenRowsVisible: leftTableRows.every((text) =>
        visibleInRect(text, { x: 195, y: 256, right: 722, bottom: 704 })
      ),
      sampleRow5Visible:
        visibleWithin('M2024050005', (rect) => rect.y >= 700 && rect.bottom <= 992) &&
        visibleWithin('ZC2024050005', (rect) => rect.y >= 700 && rect.bottom <= 992),
      sampleFiveRowsVisible: sampleRows.every((text) =>
        visibleInRect(text, { x: 195, y: 713, right: 760, bottom: 964 })
      ),
      exceptionCardVisible:
        visibleWithin('缺失字段异常', (rect) => rect.y >= 700 && rect.bottom <= 992) &&
        visibleWithin('进入异常队列', (rect) => rect.y >= 700 && rect.bottom <= 992),
      conflictCardVisible:
        visibleWithin('冲突检测', (rect) => rect.y >= 700 && rect.bottom <= 992) &&
        visibleWithin('查看冲突详情', (rect) => rect.y >= 700 && rect.bottom <= 992),
      publishGateVisible:
        visibleWithin('发布门禁', (rect) => rect.y >= 700 && rect.bottom <= 992) &&
        visibleWithin('警告（2）', (rect) => rect.y >= 700 && rect.bottom <= 992) &&
        visibleWithin('失败（1）', (rect) => rect.y >= 700 && rect.bottom <= 992),
      connectorsCurved: paths.filter((p) => p.curved).length >= 8,
      connectorsNotFlat: paths.filter((p) => p.curved && p.nonHorizontal).length >= 4,
    },
    connectorStats: {
      pathCount: paths.length,
      curvedCount: paths.filter((p) => p.curved).length,
      nonHorizontalCurvedCount: paths.filter((p) => p.curved && p.nonHorizontal).length,
      paths,
    },
    nativeSelectCount: nativeSelects.length,
    nativeSelects,
    realScrollerCount: realScrollers.length,
    realScrollers,
  };
});

const html = fs.readFileSync(htmlPath, 'utf8');
const htmlChecks = {
  hasForbiddenClass: /overflow-y-auto|overflow-auto|overflow-scroll|max-h-/.test(html),
  hasNativeSelectTag: /<select\b/i.test(html),
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
  metrics.nativeSelectCount === 0 &&
  metrics.realScrollerCount === 0 &&
  !htmlChecks.hasForbiddenClass &&
  !htmlChecks.hasNativeSelectTag;

fs.writeFileSync(metricsPath, `${JSON.stringify({ ...metrics, htmlChecks, pass }, null, 2)}\n`);
console.log(JSON.stringify({
  pass,
  screenshotPath,
  metricsPath,
  summary: {
    title: metrics.title,
    viewport: metrics.viewport,
    documentSize: metrics.documentSize,
    missing: metrics.missing,
    forbiddenPresent: metrics.forbiddenPresent,
    visibility: metrics.visibility,
    connectorStats: {
      pathCount: metrics.connectorStats.pathCount,
      curvedCount: metrics.connectorStats.curvedCount,
      nonHorizontalCurvedCount: metrics.connectorStats.nonHorizontalCurvedCount,
    },
    nativeSelectCount: metrics.nativeSelectCount,
    realScrollerCount: metrics.realScrollerCount,
    htmlChecks,
  },
}, null, 2));

await browser.close();

if (!pass) {
  process.exitCode = 1;
}
