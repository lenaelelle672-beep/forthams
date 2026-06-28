# /GETSTITCH 100 分复刻批量执行 Prompt：系统运营中枢 39 个后台页

## 任务目标

对 **系统运营中枢 39 个后台页** 逐页执行 `/GETSTITCH` 复刻流程。

目标不是重新设计，也不是优化页面，而是基于每个页面的 `IMAGE2 v2` 产品设计稿做 **100/100 像素级 HTML 复刻**。

每个页面都需要输出 Stitch 生成的 HTML 和 PNG 候选稿，命名建议：

```text
stitch-<设计稿文件名去掉 .png>-100score.html
stitch-<设计稿文件名去掉 .png>-100score.png
```

例如：

```text
设计稿：master-data-subpage-01-asset-category-v2.png
输出：stitch-master-data-subpage-01-asset-category-v2-100score.html
输出：stitch-master-data-subpage-01-asset-category-v2-100score.png
```

## 全局路径

设计稿前缀：

```text
http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/
```

本地设计稿目录：

```text
/Users/feigao/project/Project/forthAMS/frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/
```

网页前缀：

```text
http://127.0.0.1:5173/fixed-assets/workbench?menu=
```

Stitch 项目：

```text
1232247032869317081
```

`/GETSTITCH` 工具：

```bash
/Users/feigao/.codex/getstitch/getstitch
```

100 分复刻基础 Prompt：

```bash
/Users/feigao/.codex/getstitch/getstitch prompt-100score
```

## 强制执行原则

### 1. 必须使用 IMAGE2 v2 设计稿

设计稿使用的是 `IMAGE2 v2` 产品图，不是已有 Stitch 参考稿。

每一页都必须优先使用表格里对应的 `*-v2.png` 作为 source of truth。

不要用旧 Stitch 图、不要用已有 Stitch HTML、不要用手写页面作为复刻参考。

### 2. 若缺少产品配套图，先用 IMAGE2 生成

如果某个页面缺少对应的 `IMAGE2 v2` 产品设计稿：

1. 不要跳过该页。
2. 不要用 Stitch 自己想象。
3. 不要手写 HTML 兜底。
4. 先按该页面菜单和业务上下文生成/补齐 `IMAGE2 v2` 产品图。
5. 等 IMAGE2 产品图存在后，再执行 `/GETSTITCH` 上传和 Stitch edit 复刻。

缺图时的处理顺序：

```text
检查 IMAGE2 v2 是否存在
→ 不存在则先生成 IMAGE2 v2 产品图
→ 生成后再 /GETSTITCH upload
→ 再 Stitch edit_screens 100score
→ 再导出 HTML/PNG
```

### 3. Stitch 出问题时必须等待，不允许换实现方式

如果 Stitch 不可访问、超时、限流、返回不完整、导出失败、网络波动：

- 等待。
- 按 Stitch 推荐节奏重试。
- 继续保持 Stitch 工作流。
- 报告当前阻塞点。

禁止自动切换到：

- 手写 HTML
- 截图切片
- React/Vite 手工实现
- 非 Stitch 复刻
- 其他设计工具
- 其他 fallback 实现

除非用户明确说“不要用 Stitch 了”或“允许非 Stitch fallback”，否则必须继续等待或重试 Stitch。

### 4. 每页必须体现 100 分复刻要求

每次 Stitch `edit_screens` prompt 里都必须包含以下语义：

```text
This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
```

顶部左上角品牌标识必须按 IMAGE2 产品图引用复刻：

```text
Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and any adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.
```

每页还要追加该页自己的：

- 页面名称
- menu id
- 设计稿文件名
- 网页 URL
- 可见中文标题
- 表格列
- 表单字段
- 卡片/列表/检查项
- 关键按钮
- 需要严格保留的布局结构

## 单页执行流程模板

对每个页面执行：

### Step 1. 检查 IMAGE2 v2 设计稿

```bash
ls -l "/Users/feigao/project/Project/forthAMS/frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/<设计稿文件名>"
```

如果文件不存在，先生成 IMAGE2 v2 产品图，再继续。

### Step 2. 使用 /GETSTITCH 上传设计稿

```bash
/Users/feigao/.codex/getstitch/getstitch upload \
  --project-id 1232247032869317081 \
  --file "/Users/feigao/project/Project/forthAMS/frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/<设计稿文件名>" \
  --title "<页面名称> IMAGE2 v2 reference"
```

记录返回的：

```text
screen.id
screen.name
screen.width
screen.height
```

### Step 3. 对上传后的 IMAGE screen 执行 Stitch edit

使用返回的 `screen.id` 调用 Stitch `edit_screens`。

Prompt 由两部分组成：

1. `/GETSTITCH` 固化的 100 分复刻模板：

```bash
/Users/feigao/.codex/getstitch/getstitch prompt-100score
```

2. 当前页面的专属补充：

```text
Page name: <页面名称>
Menu id: <网页 menu id>
Reference image: <设计稿文件名>
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/<设计稿文件名>
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=<网页 menu id>

Recreate this exact IMAGE2 v2 product screenshot as HTML.
Keep the same top shell, sidebar active state, content layout, tables, forms, cards, buttons, colors, borders, typography, spacing, and visible Chinese text.
Preserve the exact top-left IMAGE2 brand mark for this source: white `UNIVIEW`, source-visible divider/lockup, and adjacent subtitle only when the IMAGE2 source shows it.
Do not use any existing Stitch reference draft as the visual source.
```

### Step 4. 导出 Stitch 结果

导出新生成的 Stitch DESIGN screen：

```bash
node scripts/stitch-cli.js export 1232247032869317081 <new-screen-id>
```

### Step 5. 挂载到本地 mock 目录

```bash
install -m 0644 ".stitch/exports/<new-screen-id>/screen.html" \
  "frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/stitch-<设计稿文件名去掉 .png>-100score.html"
```

### Step 6. 生成真实浏览器 PNG

用 1586 x 992 视口生成 PNG。

如果设计稿尺寸不是 1586 x 992，则使用原图尺寸作为 viewport，不要强行缩放。

### Step 7. 验证

至少检查：

- 页面 title 正确。
- 视口尺寸等于设计稿尺寸。
- 无页面级异常滚动，除非设计稿本身是长页。
- 页面名称存在。
- 关键按钮存在。
- 关键表格/列表/表单/卡片/检查项存在。
- 结果截图与 IMAGE2 v2 设计稿视觉一致。

## 39 页对应关系

### 流程平台

| 页面 | 设计稿 | 网页 menu |
|---|---|---|
| 流程定义 | `flow-platform-subpage-01-flow-definition-v2.png` | `system-flow-definition` |
| 流程设计器 | `flow-platform-subpage-02-flow-designer-v2.png` | `system-flow-designer` |
| 表单配置 | `flow-platform-subpage-03-form-config-v2.png` | `system-form-config` |
| 表单存储 | `flow-platform-subpage-04-form-storage-v2.png` | `system-form-storage` |
| 审批规则 | `flow-platform-subpage-05-approval-rules-v2.png` | `system-approval-rules` |
| 待办字段配置 | `flow-platform-subpage-06-todo-fields-v2.png` | `system-todo-fields` |
| SLA 配置 | `flow-platform-subpage-07-sla-config-v2.png` | `system-sla-config` |

### 组织权限

| 页面 | 设计稿 | 网页 menu |
|---|---|---|
| 用户管理 | `org-permission-subpage-01-user-management-v2.png` | `system-user-management` |
| 角色权限 | `org-permission-subpage-02-role-permissions-v2.png` | `system-role-permissions` |
| 菜单权限 | `org-permission-subpage-03-menu-permissions-v2.png` | `system-menu-permissions` |
| 数据权限 | `org-permission-subpage-04-data-permissions-v2.png` | `system-data-permissions` |
| 工作交接 | `org-permission-subpage-05-handover-v2.png` | `system-handover` |
| 部门组织 | `org-permission-subpage-06-dept-org-v2.png` | `system-dept-org` |
| 岗位管理 | `org-permission-subpage-07-post-management-v2.png` | `system-post-management` |

### 基础资料

| 页面 | 设计稿 | 网页 menu |
|---|---|---|
| 资产分类 | `master-data-subpage-01-asset-category-v2.png` | `system-asset-category` |
| 编号规则 | `master-data-subpage-02-numbering-rules-v2.png` | `system-numbering-rules` |
| 位置管理 | `master-data-subpage-03-location-management-v2.png` | `system-location-management` |
| 供应商管理 | `master-data-subpage-04-vendor-management-v2.png` | `system-vendor-management` |
| 自定义字段 | `master-data-subpage-05-custom-fields-v2.png` | `system-custom-fields` |
| 自定义字段集 | `master-data-subpage-06-custom-field-sets-v2.png` | `system-custom-field-sets` |

### 集成配置

| 页面 | 设计稿 | 网页 menu |
|---|---|---|
| 外部系统配置 | `integration-subpage-01-external-systems-v2.png` | `system-external-systems` |
| 接口配置 | `integration-subpage-02-interfaces-v2.png` | `system-interfaces` |
| 字段映射 | `integration-subpage-03-field-mapping-v2.png` | `system-field-mapping` |
| 同步规则 | `integration-subpage-04-sync-rules-v2.png` | `system-sync-rules` |
| Webhook 配置 | `integration-subpage-05-webhook-config-v2.png` | `system-webhook-config` |

### 消息与通知

| 页面 | 设计稿 | 网页 menu |
|---|---|---|
| 邮件网关配置 | `notification-subpage-01-mail-gateway-v2.png` | `system-mail-gateway` |
| 流程邮件配置 | `notification-subpage-02-workflow-mail-v2.png` | `system-workflow-mail` |
| 邮件模板 | `notification-subpage-03-mail-templates-v2.png` | `system-mail-templates` |
| 邮件日志 | `notification-subpage-04-mail-logs-v2.png` | `system-mail-logs` |
| 通知模板 | `notification-subpage-05-notification-templates-v2.png` | `system-notification-templates` |
| 通知渠道 | `notification-subpage-06-notification-channels-v2.png` | `system-notification-channels` |
| 通知偏好 | `notification-subpage-07-notification-preferences-v2.png` | `system-notification-preferences` |
| 流程通知开关 | `notification-subpage-08-workflow-notification-switch-v2.png` | `system-workflow-notification-switch` |

### 系统参数

| 页面 | 设计稿 | 网页 menu |
|---|---|---|
| 基础参数 | `system-params-subpage-01-base-params-v2.png` | `system-base-params` |
| 安全策略 | `system-params-subpage-02-security-policy-v2.png` | `system-security-policy` |
| 文件存储配置 | `system-params-subpage-03-file-storage-v2.png` | `system-file-storage` |
| 导入导出配置 | `system-params-subpage-04-import-export-v2.png` | `system-import-export` |
| 缓存管理 | `system-params-subpage-05-cache-management-v2.png` | `system-cache-management` |
| 操作审计 | `system-params-subpage-06-audit-log-v2.png` | `system-audit-log` |

## 执行记录要求

每页完成后记录：

```text
页面：
menu：
设计稿：
GETSTITCH uploaded screen id：
Stitch generated screen id：
session id：
HTML 输出：
PNG 输出：
验证结果：
问题/是否需要二次 edit：
```

## 资产分类参考样例

设计稿：

```text
http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/master-data-subpage-01-asset-category-v2.png
```

网页：

```text
http://127.0.0.1:5173/fixed-assets/workbench?menu=system-asset-category
```

已验证可行的最终候选：

```text
http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/stitch-master-data-subpage-01-asset-category-v6-100score.html
```

关键经验：

```text
先 /GETSTITCH upload IMAGE2 v2 产品图
再对上传后的 IMAGE screen 执行 Stitch edit_screens
edit prompt 必须包含 100/100 pixel-fidelity transcription task
若表格或表单不贴图，继续 Stitch edit，不能转手写
```
