import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const PROXY_URL = 'http://127.0.0.1:10809';
setGlobalDispatcher(new ProxyAgent(PROXY_URL));

const STITCH_PROJECT_ID = '1232247032869317081';
const OUT_DIR = '/Users/feigao/project/Project/forthAMS/stitch-output/asset-category-v2';
mkdirSync(OUT_DIR, { recursive: true });

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
      jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  });
  const payload = JSON.parse(await resp.text());
  const result = payload.result;
  if (!resp.ok || result?.isError) throw new Error(JSON.stringify(result?.content || payload.error).slice(0, 400));
  if (result?.structuredContent && Object.keys(result.structuredContent).length > 0) return result.structuredContent;
  const text = result?.content?.find(c => c.type === 'text')?.text;
  try { return JSON.parse(text); } catch { return { text }; }
}

// ===================== CLAUDE-AUTHORED PROMPT =====================
const PROMPT = `
Create a pixel-perfect replica of a Chinese enterprise asset management system page: "资产分类" (Asset Category Configuration).

## Page Layout (Three-Column + Header)
Full desktop layout, 1440px wide. The page has:
1. A fixed LEFT SIDEBAR (~220px wide)
2. A TOP HEADER BAR (~56px tall, spanning the full width minus sidebar)
3. A MAIN CONTENT AREA split into three panels:
   - Left panel: Category tree list (~260px wide)
   - Middle panel: Category detail table (flexible, ~600px)
   - Right panel: Category attribute edit form (~300px wide)

---

## 1. Left Sidebar Navigation
- Background: light gray #f5f7fa
- Top area: system logo/name "企业资产管理系统" in small text, dark color
- Navigation is a tree-style menu with expandable groups:
  - 系统设置 (with expand arrow, collapsed)
  - 基础资料 (expanded, bold, showing children indented):
    - ▸ 资产分类 ← CURRENTLY SELECTED, blue background #e6f7ff, blue text #1677ff, left border 3px solid #1677ff
    - ▸ 编号规则
    - ▸ 位置管理
    - ▸ 供应商管理
    - ▸ 自定义字段
    - ▸ 自定义字段集
  - 流程配置 (collapsed)
  - 集成配置 (collapsed)
  - 安全与审计 (collapsed)
  - 系统运维 (collapsed)
- Menu item text: #333, unselected hover: light blue background
- Font size: 14px

---

## 2. Top Header Bar
- Background: white #ffffff, bottom border: 1px solid #e8e8e8
- LEFT: Breadcrumb "系统管理 / 基础资料 / 资产分类" in small gray text
- Page title: "资产分类策略配置台" in bold #333, font-size 16px
- Status badges below title:
  - Green badge: ✓ "当前草稿已保存" (green #52c41a background light)
  - Orange badge: ⚠ "待建资产池 23 条待补类" (orange #fa8c16)
- RIGHT side buttons (all in top right corner):
  - "新建资产分类" button: blue filled #1677ff, white text, + icon
  - "批量分类" button: blue outline, #1677ff text
  - "影响预览" button: gray outline
  - "保存草稿" button: gray outline
  - "提交校验" button: blue filled #1677ff

---

## 3. Main Content Area - Left Panel: Asset Category Tree (资产分类树)
- Panel title: "资产分类树" in bold 14px, gray #666
- Search input at top: placeholder "搜索分类名称", small, 100% width
- Tree structure with expand/collapse arrows, checkbox per item:
  ├── 全部分类 (128) — expanded, bold
  │   ├── 生产设备 (56) — expanded
  │   │   ├── □ 贴片机 (12)
  │   │   ├── □ 焊接设备 (8)
  │   │   └── □ 压铸设备 (5)
  │   ├── 检测设备 (12) — selected, blue highlight
  │   │   ├── ■ AOI (4) ← selected/checked
  │   │   └── □ 三坐标 (2)
  │   ├── 运输设备 (23)
  │   └── 通用设备 (37)
- Tree node hover: light blue background
- Selected node: blue text #1677ff, light blue background #e6f7ff
- Thin right border separating from middle panel

---

## 4. Main Content Area - Middle Panel: Category Detail Table (分类明细表)
- Panel title: "分类明细表" bold, with small text "(已选 检测设备/AOI)" in blue
- Filter bar above table:
  - Label "分类名称:" + text input (width ~150px)
  - Label "分类编码:" + text input (width ~120px)
  - "查询" button (blue filled) | "重置" button (gray outline)
  - RIGHT side: "新增下级" button | "批量停用" button | "导出" button

- Table: Ant Design style, white background, gray header
  - Columns: □(checkbox) | 分类名称 | 分类编码 | 上级分类 | 折旧年限(年) | 编号前缀 | 盘点策略 | 标签策略 | 状态 | 操作
  - Header background: #fafafa, font-weight bold, border-bottom 1px #e8e8e8
  - Sample rows:
    Row 1: □ | AOI光学检测仪 | JC-AOI-001 | 检测设备 | 5 | AOI- | 年度盘点 | 二维码 | 【正常 green tag】 | 编辑 影响 停用
    Row 2: □ | 自动光学检测机 | JC-AOI-002 | 检测设备 | 5 | AOI- | 半年盘点 | 二维码+RFID | 【正常 green tag】 | 编辑 影响 停用
    Row 3: □ | 三维光学检测 | JC-3D-001 | 检测设备 | 8 | 3D- | 年度盘点 | RFID | 【停用 red tag】 | 编辑 影响 启用
  - Alternating row background: white / #fafafa
  - Row hover: #e6f7ff
  - Status tags: "正常" green (#f6ffed border #b7eb8f text #52c41a), "停用" red (#fff2f0 border #ffccc7 text #ff4d4f)
  - Operation links: "编辑" blue text | "影响" blue text | "停用/启用" orange/gray text
  - Pagination at bottom: total 12 records, page 1/2, per-page selector

---

## 5. Main Content Area - Right Panel: Category Attribute Editor (分类属性编辑区)
- Panel header: "分类属性编辑区" bold, with subtitle "当前编辑: AOI光学检测仪"
- Gray background #fafafa, left border 1px #e8e8e8
- Form fields (label on top, input below, full width):
  - 分类名称 * (required): input filled with "AOI光学检测仪"
  - 分类编码 *: input with "JC-AOI-001" (disabled/gray background)
  - 上级分类: select dropdown "检测设备"
  - 折旧年限(年) *: number input "5"
  - 编号前缀: input "AOI-"
  - 盘点策略: select "年度盘点"
  - 标签策略: select "二维码"
  - 状态: radio buttons "正常 ●" / "停用 ○"
  - 备注说明: textarea (3 rows)
- Bottom action buttons (full width of panel):
  - "保存" blue filled button | "取消" gray outlined button

---

## Color & Typography Summary
- Primary blue: #1677ff
- Text dark: #333333
- Text gray: #666666
- Background: #f0f2f5 (page bg), #ffffff (panels), #fafafa (table header/alt rows)
- Border: #e8e8e8
- Font: PingFang SC, Microsoft YaHei, sans-serif
- Font sizes: 14px body, 16px title, 12px caption
- Border radius: 4px (inputs, buttons, tags)
- Compact density: 8px row padding in table

Use Tailwind CSS. Make it look like a professional Ant Design-based Chinese enterprise system.
`.trim();

// ==================================================================

async function main() {
  console.log('Getting auth...');
  const auth = getAuth();
  console.log('Auth OK. Project:', auth.gcpProject);

  console.log('Calling Stitch generate_screen_from_text...');
  let result;
  try {
    result = await callStitch('generate_screen_from_text', {
      projectId: STITCH_PROJECT_ID,
      prompt: PROMPT,
      deviceType: 'DESKTOP',
      modelId: 'GEMINI_3_1_PRO',
    }, auth);
    writeFileSync(`${OUT_DIR}/stitch-result.json`, JSON.stringify(result, null, 2));
    console.log('Stitch result keys:', Object.keys(result).join(', '));
  } catch(e) {
    console.error('Stitch error:', e.message);
    process.exit(1);
  }

  // Find HTML URL
  let htmlUrl = null;
  if (result.htmlCode?.downloadUrl) htmlUrl = result.htmlCode.downloadUrl;
  if (!htmlUrl && result.outputComponents) {
    for (const comp of result.outputComponents) {
      const screens = comp.design?.screens || comp.screens || [];
      for (const screen of screens) {
        if (screen.htmlCode?.downloadUrl) { htmlUrl = screen.htmlCode.downloadUrl; break; }
      }
      if (htmlUrl) break;
    }
  }

  if (!htmlUrl) {
    console.log('Full result:', JSON.stringify(result).slice(0, 2000));
    console.error('No HTML URL found');
    process.exit(1);
  }

  console.log('Downloading HTML from:', htmlUrl.slice(0, 80) + '...');
  const html = await (await fetch(htmlUrl)).text();
  writeFileSync(`${OUT_DIR}/index.html`, html);
  console.log(`HTML saved: ${html.length} bytes → ${OUT_DIR}/index.html`);
}

main().catch(e => { console.error(e); process.exit(1); });
