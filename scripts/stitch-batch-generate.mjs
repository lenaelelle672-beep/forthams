/**
 * Stitch 批量生成脚本
 * 流程: 下载设计稿 PNG → Claude 视觉分析 → Stitch generate_screen_from_text → 下载 HTML
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import Anthropic from '@anthropic-ai/sdk';

// 配置代理
const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || 'http://127.0.0.1:10809';
setGlobalDispatcher(new ProxyAgent(PROXY_URL));

const DESIGN_BASE = 'http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/';
const STITCH_PROJECT_ID = '1232247032869317081';
const OUTPUT_DIR = '/Users/feigao/project/Project/forthAMS/stitch-output';

// 所有页面定义
const PAGES = [
  // 流程平台
  { name: 'flow-definition', label: '流程定义', img: 'flow-platform-subpage-01-flow-definition-v2.png' },
  { name: 'flow-designer', label: '流程设计器', img: 'flow-platform-subpage-02-flow-designer-v2.png' },
  { name: 'form-config', label: '表单配置', img: 'flow-platform-subpage-03-form-config-v2.png' },
  { name: 'form-storage', label: '表单存储', img: 'flow-platform-subpage-04-form-storage-v2.png' },
  { name: 'approval-rules', label: '审批规则', img: 'flow-platform-subpage-05-approval-rules-v2.png' },
  { name: 'todo-fields', label: '待办字段配置', img: 'flow-platform-subpage-06-todo-fields-v2.png' },
  { name: 'sla-config', label: 'SLA 配置', img: 'flow-platform-subpage-07-sla-config-v2.png' },
  // 组织权限
  { name: 'user-management', label: '用户管理', img: 'org-permission-subpage-01-user-management-v2.png' },
  { name: 'role-permissions', label: '角色权限', img: 'org-permission-subpage-02-role-permissions-v2.png' },
  { name: 'menu-permissions', label: '菜单权限', img: 'org-permission-subpage-03-menu-permissions-v2.png' },
  { name: 'data-permissions', label: '数据权限', img: 'org-permission-subpage-04-data-permissions-v2.png' },
  { name: 'handover', label: '工作交接', img: 'org-permission-subpage-05-handover-v2.png' },
  { name: 'dept-org', label: '部门组织', img: 'org-permission-subpage-06-dept-org-v2.png' },
  { name: 'post-management', label: '岗位管理', img: 'org-permission-subpage-07-post-management-v2.png' },
  // 基础资料
  { name: 'asset-category', label: '资产分类', img: 'master-data-subpage-01-asset-category-v2.png' },
  { name: 'numbering-rules', label: '编号规则', img: 'master-data-subpage-02-numbering-rules-v2.png' },
  { name: 'location-management', label: '位置管理', img: 'master-data-subpage-03-location-management-v2.png' },
  { name: 'vendor-management', label: '供应商管理', img: 'master-data-subpage-04-vendor-management-v2.png' },
  { name: 'custom-fields', label: '自定义字段', img: 'master-data-subpage-05-custom-fields-v2.png' },
  { name: 'custom-field-sets', label: '自定义字段集', img: 'master-data-subpage-06-custom-field-sets-v2.png' },
  // 集成配置
  { name: 'external-systems', label: '外部系统配置', img: 'integration-subpage-01-external-systems-v2.png' },
  { name: 'interfaces', label: '接口配置', img: 'integration-subpage-02-interfaces-v2.png' },
  { name: 'field-mapping', label: '字段映射', img: 'integration-subpage-03-field-mapping-v2.png' },
  { name: 'sync-rules', label: '同步规则', img: 'integration-subpage-04-sync-rules-v2.png' },
  { name: 'webhook-config', label: 'Webhook 配置', img: 'integration-subpage-05-webhook-config-v2.png' },
  // 消息与通知
  { name: 'mail-gateway', label: '邮件网关配置', img: 'notification-subpage-01-mail-gateway-v2.png' },
  { name: 'workflow-mail', label: '流程邮件配置', img: 'notification-subpage-02-workflow-mail-v2.png' },
  { name: 'mail-templates', label: '邮件模板', img: 'notification-subpage-03-mail-templates-v2.png' },
  { name: 'mail-logs', label: '邮件日志', img: 'notification-subpage-04-mail-logs-v2.png' },
  { name: 'notification-templates', label: '通知模板', img: 'notification-subpage-05-notification-templates-v2.png' },
  { name: 'notification-channels', label: '通知渠道', img: 'notification-subpage-06-notification-channels-v2.png' },
  { name: 'notification-preferences', label: '通知偏好', img: 'notification-subpage-07-notification-preferences-v2.png' },
  { name: 'workflow-notification-switch', label: '流程通知开关', img: 'notification-subpage-08-workflow-notification-switch-v2.png' },
  // 系统参数
  { name: 'base-params', label: '基础参数', img: 'system-params-subpage-01-base-params-v2.png' },
  { name: 'security-policy', label: '安全策略', img: 'system-params-subpage-02-security-policy-v2.png' },
  { name: 'file-storage', label: '文件存储配置', img: 'system-params-subpage-03-file-storage-v2.png' },
  { name: 'import-export', label: '导入导出配置', img: 'system-params-subpage-04-import-export-v2.png' },
  { name: 'cache-management', label: '缓存管理', img: 'system-params-subpage-05-cache-management-v2.png' },
  { name: 'audit-log', label: '操作审计', img: 'system-params-subpage-06-audit-log-v2.png' },
];

function getAuth() {
  const accessToken = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000
  }).trim();
  const gcpProject = execFileSync('gcloud', ['config', 'get-value', 'project'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000
  }).trim();
  return { accessToken, gcpProject };
}

async function callStitch(toolName, args, auth) {
  const resp = await fetch('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.accessToken}`,
      'X-Goog-User-Project': auth.gcpProject,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  });
  const text = await resp.text();
  const payload = JSON.parse(text);
  const result = payload.result;
  if (!resp.ok || result?.isError) {
    throw new Error(`Stitch ${toolName} failed: ${JSON.stringify(result?.content || payload.error || text).slice(0, 400)}`);
  }
  if (result?.structuredContent && Object.keys(result.structuredContent).length > 0) {
    return result.structuredContent;
  }
  const textContent = result?.content?.find(c => c.type === 'text')?.text;
  try { return JSON.parse(textContent); } catch { return { text: textContent }; }
}

async function downloadImg(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download ${url}: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function analyzeWithClaude(imgBuffer, pageLabel) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    httpAgent: undefined, // undici ProxyAgent handles it globally
  });

  const base64 = imgBuffer.toString('base64');
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: base64 }
        },
        {
          type: 'text',
          text: `你是一个 UI 复刻专家。请精确分析这张「${pageLabel}」系统配置页面截图，生成一段极详细的英文 Stitch prompt，用于在 Stitch 中完美复刻这个页面的 HTML。

要求：
1. 描述整体页面布局（顶部导航栏、左侧菜单、主内容区）
2. 详细描述每个 UI 组件的：位置、尺寸大小、颜色、文字内容（中文原文保留）、边框、背景
3. 描述表格/表单/按钮/搜索栏/分页等每个组件的详细状态
4. 指定色彩系统：深色侧边栏 (#1a2332 or similar)，白色内容区，蓝色主色调 (#1677ff)
5. 描述当前选中状态的菜单项
6. 输出纯英文 prompt，但保留所有中文文字内容原文

生成的 prompt 要足够详细，让 Stitch 可以精确复刻页面布局和视觉效果。`
        }
      ]
    }]
  });

  return msg.content[0].text;
}

async function generateStitchScreen(projectId, prompt, auth) {
  return await callStitch('generate_screen_from_text', {
    projectId,
    prompt,
    deviceType: 'DESKTOP',
    modelId: 'GEMINI_3_1_PRO',
  }, auth);
}

async function getScreenHtml(projectId, screenId, auth) {
  const result = await callStitch('get_screen', {
    name: `projects/${projectId}/screens/${screenId}`,
    projectId,
    screenId,
  }, auth);
  return result;
}

async function processPage(page, auth, anthropic_available) {
  const imgUrl = DESIGN_BASE + page.img;
  const outDir = `${OUTPUT_DIR}/${page.name}`;
  mkdirSync(outDir, { recursive: true });

  const statusFile = `${outDir}/status.json`;
  if (existsSync(statusFile)) {
    const status = JSON.parse(readFileSync(statusFile, 'utf8'));
    if (status.done) {
      console.log(`  [SKIP] ${page.label} — already done`);
      return;
    }
  }

  console.log(`\n[${page.label}] Downloading design image...`);
  let imgBuffer;
  try {
    imgBuffer = await downloadImg(imgUrl);
    writeFileSync(`${outDir}/design.png`, imgBuffer);
    console.log(`  Image: ${imgBuffer.length} bytes`);
  } catch (e) {
    console.error(`  ERROR downloading image: ${e.message}`);
    writeFileSync(statusFile, JSON.stringify({ done: false, error: e.message, step: 'download' }));
    return;
  }

  let claudePrompt;
  if (anthropic_available) {
    console.log(`  Analyzing with Claude...`);
    try {
      claudePrompt = await analyzeWithClaude(imgBuffer, page.label);
      writeFileSync(`${outDir}/claude-analysis.txt`, claudePrompt);
      console.log(`  Claude analysis: ${claudePrompt.length} chars`);
    } catch (e) {
      console.error(`  ERROR Claude analysis: ${e.message}`);
      claudePrompt = null;
    }
  }

  // Fallback prompt if Claude not available
  const stitchPrompt = claudePrompt || `
Create a pixel-perfect replica of a Chinese enterprise system admin page called "${page.label}".

Layout:
- Full desktop layout (1440px wide)
- Dark left sidebar (~220px) with deep navy color (#1a2332), containing navigation menu items in Chinese
- White main content area
- Top header bar with breadcrumb navigation

Style:
- Ant Design-inspired components
- Primary color: #1677ff (blue)
- Table with light gray striped rows, sortable column headers
- Search/filter bar at top of content area with input fields and blue "查询" button
- Action buttons: "新增" (blue), "编辑" (outlined), "删除" (red outlined)
- Pagination at bottom

The page "${page.label}" is a ${page.label} management page with typical CRUD operations.
Include realistic Chinese UI text content matching the page purpose.
Use Tailwind CSS for styling.
`.trim();

  console.log(`  Generating Stitch screen...`);
  let screenResult;
  try {
    screenResult = await generateStitchScreen(STITCH_PROJECT_ID, stitchPrompt, auth);
    writeFileSync(`${outDir}/stitch-result.json`, JSON.stringify(screenResult, null, 2));
    console.log(`  Stitch result keys: ${Object.keys(screenResult).join(', ')}`);
  } catch (e) {
    console.error(`  ERROR Stitch generate: ${e.message}`);
    writeFileSync(statusFile, JSON.stringify({ done: false, error: e.message, step: 'stitch-generate' }));
    return;
  }

  // Extract screen HTML URL from result
  let htmlUrl = null;
  let htmlContent = null;

  // Path 1: direct htmlCode in result
  if (screenResult.htmlCode?.downloadUrl) {
    htmlUrl = screenResult.htmlCode.downloadUrl;
  }

  // Path 2: outputComponents[N].design.screens[0].htmlCode.downloadUrl
  if (!htmlUrl && screenResult.outputComponents) {
    for (const comp of screenResult.outputComponents) {
      if (comp.design?.screens?.length > 0) {
        const screen = comp.design.screens[0];
        if (screen.htmlCode?.downloadUrl) {
          htmlUrl = screen.htmlCode.downloadUrl;
          console.log(`  Found HTML in outputComponents.design.screens[0] (id: ${screen.id})`);
          break;
        }
      }
      // Also try direct screen in outputComponents
      if (comp.screen?.htmlCode?.downloadUrl) {
        htmlUrl = comp.screen.htmlCode.downloadUrl;
        console.log(`  Found HTML in outputComponents.screen`);
        break;
      }
    }
  }

  // Path 3: top-level screens array
  if (!htmlUrl) {
    const screens = screenResult.screens || screenResult.screenInstances || [];
    if (screens.length > 0) {
      const screen = screens[0];
      if (screen.htmlCode?.downloadUrl) {
        htmlUrl = screen.htmlCode.downloadUrl;
      } else {
        const screenId = screen.screenId || screen.id || screen.name?.split('/').pop();
        if (screenId) {
          console.log(`  Getting screen details for ID: ${screenId}`);
          try {
            const screenData = await getScreenHtml(STITCH_PROJECT_ID, screenId, auth);
            htmlUrl = screenData.htmlCode?.downloadUrl;
            writeFileSync(`${outDir}/screen-data.json`, JSON.stringify(screenData, null, 2));
          } catch (e) {
            console.error(`  ERROR get_screen: ${e.message}`);
          }
        }
      }
    }
  }

  if (htmlUrl) {
    console.log(`  Downloading HTML...`);
    try {
      const htmlResp = await fetch(htmlUrl);
      htmlContent = await htmlResp.text();
      writeFileSync(`${outDir}/index.html`, htmlContent);
      console.log(`  HTML saved: ${htmlContent.length} bytes`);
    } catch (e) {
      console.error(`  ERROR downloading HTML: ${e.message}`);
    }
  } else {
    console.log(`  WARNING: No HTML URL found in result`);
  }

  writeFileSync(statusFile, JSON.stringify({
    done: !!htmlContent,
    htmlSize: htmlContent?.length || 0,
    claudeUsed: !!claudePrompt,
    timestamp: new Date().toISOString(),
  }));

  if (htmlContent) {
    console.log(`  ✓ DONE: ${page.label}`);
  } else {
    console.log(`  ⚠ Partial: ${page.label} (no HTML)`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targetPage = args[0]; // optional: run only one page by name

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Getting gcloud auth...');
  const auth = getAuth();
  console.log(`Auth OK. Project: ${auth.gcpProject}`);

  const anthropic_available = !!process.env.ANTHROPIC_API_KEY;
  if (!anthropic_available) {
    console.log('WARNING: ANTHROPIC_API_KEY not set, will use fallback prompts');
  }

  const pages = targetPage ? PAGES.filter(p => p.name === targetPage) : PAGES;
  if (pages.length === 0) {
    console.error(`No page found with name: ${targetPage}`);
    process.exit(1);
  }

  console.log(`\nProcessing ${pages.length} page(s)...\n`);

  for (const page of pages) {
    try {
      await processPage(page, auth, anthropic_available);
    } catch (e) {
      console.error(`FATAL ERROR for ${page.label}: ${e.message}`);
    }
    // Small delay between pages to avoid rate limits
    if (pages.length > 1) await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=== Batch complete ===');
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
