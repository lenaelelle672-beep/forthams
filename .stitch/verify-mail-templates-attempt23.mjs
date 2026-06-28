import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../frontend/node_modules/playwright/index.js';

const { chromium } = playwright;

const root = process.cwd();
const screenId = process.argv[2] || 'de5700cf305d4930b16ca5610b9f437b';
const attempt = process.argv[3] || 'attempt23';
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
    '邮件模板配置台',
    '邮件模板列表',
    '共 4 条',
    '模板编辑区',
    '变量字典',
    'erp_receipt_no',
    '共 5 条',
    '引用流程',
    '共 3 条',
    '发布校验清单',
    '合规签名',
    '重新校验',
  ];
  const requiredSidebarText = [
    '流程设计',
    '流程监控',
    '流程日志',
    '流程委托',
    '组织管理',
    '角色管理',
    '权限管理',
    '用户管理',
    '资产属性',
    '枚举值管理',
    '系统集成',
    '接口管理',
    '数据映射',
    '调度任务',
    '通知渠道',
    '消息模板',
    '邮件模板',
    '短信模板',
    '消息日志',
    '全局参数',
    '业务参数',
    '参数日志',
  ];
  const forbiddenText = [
    'lorem',
    'Lorem',
    'undefined',
    'NaN',
  ];
  const bodyText = document.body.innerText || '';

  const placeholder = '搜索模板名称 / 编码 / 变量 / 引用流程';
  const placeholderElements = [...document.querySelectorAll('input, textarea')]
    .map((element) => ({
      tag: element.tagName,
      placeholder: element.getAttribute('placeholder') || '',
      rect: (() => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right,
        };
      })(),
    }))
    .filter((item) => item.placeholder.includes(placeholder));

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
        const style = window.getComputedStyle(node.parentElement);
        if (
          rect.width > 0 &&
          rect.height > 0 &&
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

  const targetTexts = ['共 5 条', '共 3 条', '重新校验'];
  const targetRects = Object.fromEntries(targetTexts.map((text) => [text, textRects(text)]));
  const sidebarRects = Object.fromEntries(requiredSidebarText.map((text) => [text, textRects(text)]));
  const missingSidebarVisible = requiredSidebarText.filter((text) =>
    !(sidebarRects[text] || []).some((rect) =>
      rect.x >= 0 &&
      rect.right <= 218 &&
      rect.y >= 50 &&
      rect.bottom <= 992
    )
  );
  const activeMailSidebarRects = (sidebarRects['邮件模板'] || []).filter((rect) =>
    rect.x >= 0 && rect.right <= 218 && rect.y >= 50 && rect.bottom <= 992
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

  const allTargetRectsVisible = targetTexts.every((text) =>
    (targetRects[text] || []).some((rect) => rect.bottom <= 956 && rect.x >= 0 && rect.right <= 1586)
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
    missingSidebar: requiredSidebarText.filter((text) => !bodyText.includes(text)),
    missingSidebarVisible,
    forbiddenPresent: forbiddenText.filter((text) => bodyText.includes(text)),
    placeholderVisible: placeholderElements.length > 0,
    placeholderElements,
    targetRects,
    sidebarRects,
    activeMailSidebarRects,
    allTargetRectsVisible,
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
    missingSidebar: metrics.missingSidebar,
    missingSidebarVisible: metrics.missingSidebarVisible,
    forbiddenPresent: metrics.forbiddenPresent,
    placeholderVisible: metrics.placeholderVisible,
    allTargetRectsVisible: metrics.allTargetRectsVisible,
    realScrollerCount: metrics.realScrollerCount,
    targetRects: metrics.targetRects,
    activeMailSidebarRects: metrics.activeMailSidebarRects,
  },
}, null, 2));

await browser.close();
