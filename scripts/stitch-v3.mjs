import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new ProxyAgent('http://127.0.0.1:10809'));

const PROJECT_ID = '1232247032869317081';
const OUT = '/Users/feigao/project/Project/forthAMS/stitch-output/asset-category-v3';
mkdirSync(OUT, { recursive: true });

function getAuth() {
  const token = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim();
  const project = execFileSync('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim();
  return { token, project };
}

async function callStitch(tool, args, auth) {
  const r = await fetch('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, 'X-Goog-User-Project': auth.project },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: tool, arguments: args } })
  });
  const d = await r.json();
  if (d.result?.isError) throw new Error(JSON.stringify(d.result.content).slice(0, 400));
  return d.result?.structuredContent || JSON.parse(d.result?.content?.find(c => c.type === 'text')?.text || '{}');
}

// ======================== PRECISE PROMPT FROM CLAUDE VISION ANALYSIS ========================
const PROMPT = `
Create a pixel-perfect HTML replica of a Chinese enterprise fixed asset management system page called "资产分类策略配置台" (Asset Category Strategy Configuration Console).

## OVERALL LAYOUT
- Desktop, 1440px wide
- Fixed LEFT SIDEBAR: 220px wide, white background #ffffff, 1px right border #e8e8e8
- Fixed TOP HEADER: full width, 48px tall, dark navy #001529
- MAIN CONTENT AREA: remaining space, background #f5f7fa
  - Inside main: title bar + three-panel split (left tree 280px | center table flex | right form 320px)

---

## 1. LEFT SIDEBAR NAVIGATION
Background: #ffffff, right border: 1px solid #e8e8e8

Menu structure (tree-style, 14px font, 40px item height):
- 系统设置 (with chevron icon, collapsed)
- 组织与权限 (collapsed)
- 用户与角色 (collapsed)  
- 基础资料 (EXPANDED group, bold, folder icon)
  - 资产分类 ← ACTIVE: bg #e6f7ff, text #1890ff, 3px left border solid #1890ff, font-weight 600
  - 编号规则 (normal, text #333, padding-left 20px extra indent)
  - 位置管理
  - 供应商管理
  - 自定义字段
  - 自定义字段集
- 流程配置 (collapsed)
- 集成配置 (collapsed)
- 安全与审计 (collapsed)
- 系统运维 (collapsed)

Each menu item: flex row, gap 8px, icon (16px gray) + text. Hover: bg #f5f5f5.

---

## 2. TOP HEADER BAR
Background: #001529, height 48px, padding 0 24px
- LEFT: Logo text "固定资产管理系统" white, font-weight 700, 16px
- CENTER navigation tabs (white text, 14px): 固定资产工作台 | 资产全景视图 | 大屏态势 | 流程协同 | 系统运营中枢
  - "系统运营中枢" is ACTIVE: white background, text #1890ff, border-radius 4px, padding 4px 12px
- RIGHT: notification bell icon (white, red badge "12") | help icon | settings icon | circular avatar | "系统管理员" white text with dropdown arrow

---

## 3. MAIN CONTENT AREA

### 3a. Title Bar (white bg, padding 16px 24px, border-bottom 1px #e8e8e8)
- H1: "资产分类策略配置台" font-size 18px, color #333333, font-weight 600
- Subtitle: "维护资产大类、小类、折旧、编号前缀、盘点策略、标签策略和重点设备规则。" font-size 12px, color #666666
- Status badges (inline, margin-top 8px):
  - Green badge: ✓ 当前草稿已保存 (bg #f6ffed, border #b7eb8f, text #52c41a)
  - Green badge: ✓ 编码唯一性通过 (same green)
  - Orange badge: ⚠ 待建资产池 23 条待补类 (bg #fff7e6, border #ffd591, text #fa8c16)
- RIGHT side buttons (float right, same line as title):
  - "新建资产分类" btn: bg #1890ff, text white, border-radius 4px, + icon
  - "批量补类" btn: bg white, border 1px #1890ff, text #1890ff
  - "影响预览" btn: bg white, border 1px #d9d9d9, text #333
  - "保存草稿" btn: bg white, border 1px #d9d9d9, text #333
  - "提交校验" btn: bg #1890ff, text white

### 3b. Three-panel content area (display: flex, height: calc(100vh - 48px - 80px))

#### LEFT PANEL — 资产分类树 (width: 280px, bg white, border-right 1px #e8e8e8, overflow-y auto)
Panel header: "资产分类树" bold 14px, padding 12px 16px, border-bottom 1px #e8e8e8
Search input: placeholder "搜索分类名称", 100% width minus padding, height 32px, margin 8px 16px

Tree nodes (14px, line-height 32px, padding-left varies by depth):
▼ 全部分类 (128) — depth 0, bold, expanded arrow
  ▼ 生产设备 (56) — depth 1, expanded
      贴片机 (8) — depth 2, with checkbox □
      回流焊炉 (6) — depth 2, with checkbox □
  ▼ 检测设备 (12) — depth 1, SELECTED (bg #e6f7ff, text #1890ff)
      AOI检测机 (6) — depth 2, CHECKED ■ (text #1890ff)
  ▶ IT设备 (28) — depth 1, collapsed
  ▶ 工装夹具 (18) — depth 1, collapsed
  ▶ 办公设备 (14) — depth 1, collapsed
  ▶ 运输设备 (6) — depth 1, collapsed

Node hover: bg #f5f5f5. Selected: bg #e6f7ff. Arrows: ▼/▶ gray #999.

#### CENTER PANEL — 分类明细表 (flex: 1, bg white, overflow auto)
Panel header: padding 12px 16px, border-bottom 1px #e8e8e8
- Left: "分类明细表" bold 14px + small gray text "(已选: 检测设备)" 
- Right mini-buttons: "新增下级" (blue outline) | "批量停用" (gray outline) | "导出" (gray outline)

Table (Ant Design style, width 100%, border-collapse collapse):
HEADER ROW: bg #fafafa, font-weight 600, 12px, color #666, padding 12px 8px, border-bottom 2px #e8e8e8
Columns: □ | 分类名称 | 分类编码 | 上级分类 | 折旧年限(年) | 编号前缀 | 盘点策略 | 标签策略 | 状态 | 操作

DATA ROWS (height 48px, border-bottom 1px #f0f0f0, hover bg #e6f7ff):
Row 1: □ | 生产设备/贴片机 | SE-SMT-001 | 生产设备 | 8 | SESMT | 月度盘点 | 设备类标签 | [启用 green] | 编辑 影响 停用
Row 2: □ | 生产设备/回流焊炉 | SE-RFH-001 | 生产设备 | 10 | SERFH | 季度盘点 | 设备类标签 | [启用 green] | 编辑 影响 停用
Row 3: □ | 检测设备/AOI | TE-AOI-001 | 检测设备 | 7 | TEAOI | 月度盘点 | 检测类标签 | [启用 green] | 编辑 影响 停用
Row 4: □ | IT设备/笔记本 | IT-NB-001 | IT设备 | 5 | ITNB | 年度盘点 | IT类标签 | [停用 gray] | 编辑 影响 启用

Status tags:
- 启用: bg #f6ffed, border 1px #b7eb8f, text #52c41a, border-radius 2px, padding 1px 8px, font-size 12px
- 停用: bg #f5f5f5, border 1px #d9d9d9, text #999999, border-radius 2px, padding 1px 8px, font-size 12px

Operation links (14px, no underline): 编辑 (#1890ff) | 影响 (#1890ff) | 停用 (#fa8c16) | space between with "|" divider

PAGINATION (padding 12px 16px, text-align right, border-top 1px #f0f0f0):
"共 7 条" gray text | page buttons: [< ] [1 active blue] [2] [3] [ >] | "10条/页" dropdown

#### RIGHT PANEL — 分类属性编辑区 (width: 320px, bg white, border-left 1px #e8e8e8, overflow-y auto)
Panel header: "分类属性编辑区" bold 14px, padding 12px 16px, border-bottom 1px #e8e8e8
Current: small text "(当前编辑: 生产设备/贴片机)" color #1890ff

Form body (padding 16px, display flex flex-col gap 16px):
Each field: label (12px #666, margin-bottom 4px) + input (height 32px, border 1px #d9d9d9, border-radius 4px, padding 0 8px, width 100%)

Fields:
- 分类名称 * → input value "生产设备/贴片机"
- 分类编码 * → input value "SE-SMT-001" (bg #fafafa, disabled)
- 上级分类 * → select "生产设备" with dropdown arrow
- 折旧年限(年) * → number input "8"
- 编号前缀 * → input "SESMT"
- 盘点策略 * → select "月度盘点"
- 标签策略 * → select "设备类标签"
- 折旧策略 * → select "直线法"
- 重点设备规则 → input "关键设备(价值>10万)"
- MES/MAC绑定策略 → input "生产设备强制绑定MES"
- 负责人 * → select "设备管理员"

Required fields marked with red asterisk * after label.
Focus style: border #1890ff, box-shadow 0 0 0 2px rgba(24,144,255,0.2)

Form footer (padding 16px, border-top 1px #e8e8e8, display flex gap 8px):
- "保存草稿" btn: white bg, border #d9d9d9, text #333, flex 1
- "提交校验" btn: bg #1890ff, text white, flex 1
- "预览影响" btn: white bg, border #1890ff, text #1890ff, flex 1

---

## COLOR SUMMARY
- Page bg: #f5f7fa
- White panels: #ffffff
- Header navy: #001529
- Primary blue: #1890ff
- Active bg: #e6f7ff
- Table header bg: #fafafa
- Border: #e8e8e8, #f0f0f0
- Text primary: #333333
- Text secondary: #666666
- Green: #52c41a | Orange: #fa8c16 | Gray disabled: #d9d9d9

## TECH STACK
- Use Tailwind CSS + custom CSS
- Chinese fonts: PingFang SC, Microsoft YaHei, sans-serif
- All text content must be in Chinese as specified above
- Make it look exactly like Ant Design 4.x enterprise admin UI
`.trim();
// =========================================================================================

async function main() {
  const auth = getAuth();
  console.log('Auth OK:', auth.project);

  console.log('Generating screen...');
  const result = await callStitch('generate_screen_from_text', {
    projectId: PROJECT_ID, prompt: PROMPT, deviceType: 'DESKTOP', modelId: 'GEMINI_3_1_PRO',
  }, auth);

  writeFileSync(`${OUT}/stitch-result.json`, JSON.stringify(result, null, 2));

  let htmlUrl = result.htmlCode?.downloadUrl;
  if (!htmlUrl) {
    for (const comp of (result.outputComponents || [])) {
      for (const screen of (comp.design?.screens || comp.screens || [])) {
        if (screen.htmlCode?.downloadUrl) { htmlUrl = screen.htmlCode.downloadUrl; break; }
      }
      if (htmlUrl) break;
    }
  }

  if (!htmlUrl) { console.error('No HTML URL. Keys:', Object.keys(result)); process.exit(1); }

  console.log('Downloading HTML...');
  const html = await (await fetch(htmlUrl)).text();
  writeFileSync(`${OUT}/index.html`, html);
  console.log(`Done: ${html.length} bytes → ${OUT}/index.html`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
