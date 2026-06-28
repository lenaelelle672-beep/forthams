import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new ProxyAgent('http://127.0.0.1:10809'));

const PROJECT_ID = '1232247032869317081';
const OUT = '/Users/feigao/project/Project/forthAMS/stitch-output/asset-category-v4';
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

const PROMPT = `
Create a pixel-perfect HTML replica of a Chinese enterprise fixed asset management system page.
Use Tailwind CSS. Font: PingFang SC, Microsoft YaHei, sans-serif. All text in Chinese as specified.

=== PAGE STRUCTURE ===
Full-height desktop layout (1440×900px):
- Fixed LEFT SIDEBAR: exactly 220px wide
- Fixed TOP HEADER: full width, 48px tall
- MAIN CONTENT: fills remaining space, display:flex flex-col

=== 1. TOP HEADER (height 48px, bg #001529) ===
Left: "固定资产管理系统" white bold 16px, margin-left 24px
Center nav tabs (white text 14px, gap 4px):
  固定资产工作台 | 资产全景视图 | 大屏态势 | 流程协同 | 系统运营中枢
  "系统运营中枢" = ACTIVE TAB: bg white, text #1890ff, border-radius 4px, padding 4px 16px
Right (margin-right 24px, gap 16px): 
  🔔 bell icon with red badge "12" | ❓ help icon | ⚙ settings icon | circular avatar | "系统管理员 ▾" white text

=== 2. LEFT SIDEBAR (width 220px, bg #ffffff, border-right 1px solid #e8e8e8, height 100%) ===
EXACT menu items — do NOT add or change any item:
  系统设置          (⚙ icon, collapsed, chevron-right)
  组织与权限         (👥 icon, collapsed)
  用户与角色         (👤 icon, collapsed)
  基础资料          (📁 icon, EXPANDED, chevron-down, bold)
    ↳ 资产分类       ← ACTIVE: bg #e6f7ff, text #1890ff, left-border 3px solid #1890ff, padding-left 32px
    ↳ 编号规则        padding-left 32px, text #595959
    ↳ 位置管理        padding-left 32px, text #595959
    ↳ 供应商管理      padding-left 32px, text #595959
    ↳ 自定义字段      padding-left 32px, text #595959
    ↳ 自定义字段集    padding-left 32px, text #595959
  流程配置          (🔄 icon, collapsed)
  集成配置          (🔗 icon, collapsed)
  安全与审计         (🔒 icon, collapsed)
  系统运维          (🖥 icon, collapsed)
Each item: height 40px, flex, align-center, padding 0 16px, text 14px #595959, hover bg #f5f5f5

=== 3. MAIN CONTENT AREA (bg #f5f7fa, flex-col) ===

--- 3a. TITLE BAR (bg white, padding 16px 24px, border-bottom 1px #e8e8e8) ---
Left column:
  Title: "资产分类策略配置台" font-size 18px, color #262626, font-weight 600
  Subtitle: "维护资产大类、小类、折旧、编号前缀、盘点策略、标签策略和重点设备规则。" 12px #8c8c8c, margin-top 4px
  Status badges (margin-top 8px, display inline-flex gap 8px):
    [✓ 当前草稿已保存]  bg #f6ffed, border 1px #b7eb8f, text #52c41a, 12px, padding 2px 8px, border-radius 2px
    [✓ 编码唯一性通过]  same green style
    [⚠ 待建资产池 23 条待补类]  bg #fff7e6, border 1px #ffd591, text #fa8c16, 12px, padding 2px 8px, border-radius 2px
Right column (float right / margin-left auto, display flex gap 8px, align-items flex-start):
  Buttons in this EXACT order left-to-right:
  1. "新建资产分类"  bg #1890ff, text white, border-radius 4px, height 32px, padding 0 16px, + icon before text
  2. "批量补类"      bg white, border 1px #1890ff, text #1890ff, height 32px, padding 0 12px
  3. "影响预览"      bg white, border 1px #d9d9d9, text #595959, height 32px, padding 0 12px
  4. "保存草稿"      bg white, border 1px #d9d9d9, text #595959, height 32px, padding 0 12px
  5. "提交校验"      bg #1890ff, text white, border-radius 4px, height 32px, padding 0 16px

--- 3b. THREE-PANEL CONTENT (display flex, flex 1, overflow hidden) ---

[LEFT TREE PANEL] width 280px, bg white, border-right 1px #e8e8e8, display flex flex-col
  Header: "资产分类树" bold 14px #262626, padding 12px 16px, border-bottom 1px #e8e8e8
  Search: input full-width, height 32px, placeholder "搜索分类名称", margin 8px 16px, border 1px #d9d9d9, border-radius 4px, padding 0 8px
  Tree (overflow-y auto, padding 8px 0):
    ▼ 全部分类 (128)   bold, color #262626, padding 6px 16px
      ▼ 生产设备 (56)  color #595959, padding 6px 16px 6px 32px
          □ 贴片机 (8)    padding 6px 16px 6px 48px, color #8c8c8c
          □ 回流焊炉 (6) padding 6px 16px 6px 48px, color #8c8c8c
      ▼ 检测设备 (12)  bg #e6f7ff, color #1890ff, padding 6px 16px 6px 32px  ← SELECTED
          ■ AOI检测机 (6)  padding 6px 16px 6px 48px, color #1890ff, checkbox checked blue
      ▶ IT设备 (28)    color #595959, padding 6px 16px 6px 32px
      ▶ 工装夹具 (18)  color #595959, padding 6px 16px 6px 32px
      ▶ 办公设备 (14)  color #595959, padding 6px 16px 6px 32px
      ▶ 运输设备 (6)   color #595959, padding 6px 16px 6px 32px
  Tree node hover: bg #f5f5f5

[CENTER TABLE PANEL] flex 1, bg white, display flex flex-col, overflow hidden
  Panel header (padding 12px 16px, border-bottom 1px #e8e8e8, display flex justify-between):
    Left: "分类明细表" bold 14px + <span style="color:#8c8c8c;font-size:12px;margin-left:8px">(已选: 检测设备)</span>
    Right buttons: "新增下级" (border 1px #1890ff, text #1890ff, height 28px, padding 0 8px, 12px) | "批量停用" (border #d9d9d9, text #595959) | "导出" (border #d9d9d9, text #595959)
  Table (flex 1, overflow auto):
    thead: bg #fafafa, border-bottom 2px #f0f0f0
    Columns (th): □ checkbox | 分类名称 | 分类编码 | 上级分类 | 折旧年限(年) | 编号前缀 | 盘点策略 | 标签策略 | 状态 | 操作
    th style: padding 12px 8px, font-size 12px, color #8c8c8c, font-weight 600, text-align left
    
    tbody rows (border-bottom 1px #f0f0f0, hover bg #e6f7ff):
    Row 1: □ | 生产设备/贴片机 | SE-SMT-001 | 生产设备 | 8  | SESMT | 月度盘点 | 设备类标签 | [启用 green] | 编辑 ｜ 影响 ｜ 停用
    Row 2: □ | 生产设备/回流焊炉 | SE-RFH-001 | 生产设备 | 10 | SERFH | 季度盘点 | 设备类标签 | [启用 green] | 编辑 ｜ 影响 ｜ 停用
    Row 3: □ | 检测设备/AOI    | TE-AOI-001 | 检测设备 | 7  | TEAOI | 月度盘点 | 检测类标签 | [启用 green] | 编辑 ｜ 影响 ｜ 停用
    Row 4: □ | IT设备/笔记本   | IT-NB-001  | IT设备   | 5  | ITNB  | 年度盘点 | IT类标签   | [停用 gray]  | 编辑 ｜ 影响 ｜ 启用
    td style: padding 12px 8px, font-size 14px, color #262626
    
    Status tag 启用: display inline-block, bg #f6ffed, border 1px #b7eb8f, color #52c41a, padding 1px 8px, border-radius 2px, font-size 12px
    Status tag 停用: display inline-block, bg #f5f5f5, border 1px #d9d9d9, color #8c8c8c, padding 1px 8px, border-radius 2px, font-size 12px
    Operation links: "编辑" color #1890ff | separator "｜" color #d9d9d9 | "影响" color #1890ff | separator | "停用"/"启用" color #fa8c16
    
  Pagination (padding 12px 16px, border-top 1px #f0f0f0, text-align right, flex justify-end align-center gap 8px):
    "共 7 条" color #8c8c8c, font-size 14px
    Page buttons: [＜] [1 active: bg #1890ff text white] [2] [3] [＞], each 32px square, border 1px #d9d9d9, border-radius 4px
    "10条/页 ▾" select, height 32px, border 1px #d9d9d9, padding 0 8px, border-radius 4px

[RIGHT FORM PANEL] width 320px, bg white, border-left 1px #e8e8e8, display flex flex-col, overflow-y auto
  Header (padding 12px 16px, border-bottom 1px #e8e8e8):
    "分类属性编辑区" bold 14px #262626
    "(当前编辑: 生产设备/贴片机)" font-size 12px, color #1890ff, margin-top 4px
  Form body (padding 16px, display flex flex-col gap 12px):
    Each field wrapper: display flex flex-col gap 4px
    Label style: font-size 12px, color #8c8c8c (required fields have red * after label)
    Input/select style: height 32px, border 1px #d9d9d9, border-radius 4px, padding 0 8px, font-size 14px, color #262626, width 100%
    Disabled input: bg #f5f5f5, color #8c8c8c
    
    Fields IN THIS ORDER:
    1.  分类名称 *     → input, value="生产设备/贴片机"
    2.  分类编码 *     → input, value="SE-SMT-001", disabled (bg #f5f5f5)
    3.  上级分类 *     → select, value="生产设备"
    4.  折旧年限(年) * → number input, value="8"
    5.  编号前缀 *     → input, value="SESMT"
    6.  盘点策略 *     → select, value="月度盘点"
    7.  标签策略 *     → select, value="设备类标签"
    8.  折旧策略 *     → select, value="直线法"
    9.  重点设备规则   → input, value="关键设备(价值>10万)"
    10. MES/MAC绑定策略 → input, value="生产设备强制绑定MES"
    11. 负责人 *       → select, value="设备管理员"
  Form footer (padding 12px 16px, border-top 1px #f0f0f0, display flex gap 8px):
    "保存草稿"  bg white, border 1px #d9d9d9, text #595959, height 32px, flex 1
    "提交校验"  bg #1890ff, text white, height 32px, flex 1
    "预览影响"  bg white, border 1px #1890ff, text #1890ff, height 32px, flex 1

--- 3c. BOTTOM IMPACT PREVIEW SECTION (bg white, margin-top 16px, padding 16px 24px, border-top 1px #e8e8e8) ---
Section header (margin-bottom 12px):
  "影响预览" bold 16px #262626 + "(基于当前编辑)" 12px #8c8c8c margin-left 8px

5 cards in a row (display grid, grid-template-columns repeat(5,1fr), gap 12px):

Card 1: "编号规则引用"
  Icon: 🔢 (blue)
  Desc: "SE-SMT-001 将影响 8 条已有资产编号"
  Link: "查看详情 ›" blue text

Card 2: "待建资产池"
  Icon: 📦 (orange)
  Desc: "23 条资产待归入此分类"
  Link: "查看详情 ›"

Card 3: "盘点策略"
  Icon: 📋 (green)
  Desc: "月度盘点将同步更新 8 条资产"
  Link: "查看详情 ›"

Card 4: "折旧衔接"
  Icon: 💰 (purple)
  Desc: "折旧年限变更将影响 3 条资产"
  Link: "查看详情 ›"

Card 5: "MES/MAC绑定"
  Icon: 🔗 (cyan)
  Desc: "强制绑定策略影响 12 台设备"
  Link: "查看详情 ›"

Card style: bg #fafafa, border 1px #f0f0f0, border-radius 4px, padding 16px, display flex flex-col gap 8px
Card icon: font-size 24px
Card desc: font-size 14px, color #595959
Card link: font-size 12px, color #1890ff, cursor pointer

Below cards — "发布检查清单" section (margin-top 16px):
Title: "发布检查清单" bold 14px #262626
Checklist items (display flex flex-col gap 8px, margin-top 8px):
  ✓ 分类编码唯一性验证通过    color #52c41a
  ✓ 折旧年限合规性检查通过    color #52c41a
  ✓ 编号前缀格式验证通过      color #52c41a
  ⚠ 待建资产池存在未处理项    color #fa8c16
  ✓ 关联流程配置完整          color #52c41a
Each item: font-size 14px, display flex align-center gap 8px, icon 16px

=== COLORS SUMMARY ===
Page bg: #f5f7fa | White: #ffffff | Header: #001529
Primary: #1890ff | Active bg: #e6f7ff | Table header: #fafafa
Border heavy: #e8e8e8 | Border light: #f0f0f0 | Border input: #d9d9d9
Text-1: #262626 | Text-2: #595959 | Text-3: #8c8c8c
Green: #52c41a | Orange: #fa8c16 | Red: #ff4d4f
`.trim();

async function main() {
  const auth = getAuth();
  console.log('Auth OK:', auth.project);
  console.log('Generating v4...');

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

  const html = await (await fetch(htmlUrl)).text();
  writeFileSync(`${OUT}/index.html`, html);
  console.log(`Done: ${html.length} bytes → ${OUT}/index.html`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
