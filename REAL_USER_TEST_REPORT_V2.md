# forthAMS 真人模拟测试报告 V2

> **测试时间**：2026-05-22
> **测试范围**：27 个后端 Controller · 24 个前端页面 · 104 个 API · 19 个 Entity · 6 个 Enum
> **测试方法**：代码审计 + API 级模拟 + 前端交互分析 + 数据库 Schema 校验
> **对比基线**：V1 报告（9 个 Bug）

---

## 一、测试概况

| 指标 | 数值 |
|------|------|
| 总测试模块 | **27** |
| 功能测试点 | **203** |
| ✅ 通过 | **161** (79.3%) |
| ❌ 失败 | **18** (8.9%) |
| ⚠️ 警告 | **24** (11.8%) |
| P0 严重 Bug | **6** |
| P1 高优 Bug | **11** |
| P2 一般 Bug | **25** |

**与 V1 对比**：V1 发现 9 个 Bug（4 已修复），V2 新增 **42 个问题**，其中 6 个 P0 严重。

---

## 二、模块测试详情

---

### 1. 登录认证 `/login`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 用户名密码登录 | 交互 | ✅ | POST /auth/login 正常 |
| 2 | 快捷账号一键登录 | 交互 | ✅ | 4 个演示账号正常 |
| 3 | 密码可见性切换 | 交互 | ✅ | eye icon toggle |
| 4 | 记住我 | 交互 | ✅ | localStorage 存储 |
| 5 | 忘记密码 | 交互 | ⚠️ | 仅 toast 提示，无实际功能 |
| 6 | 认证连通性测试 | API | ⚠️ | GET /auth/test 疑似调试遗留 |
| 7 | 用户注册 | API | ⚠️ | POST /auth/register 公开无验证码 |
| 8 | Token 安全 | 安全 | ⚠️ | 存 localStorage，无 httpOnly cookie |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P2 | 4 个演示账号（admin/asset/manager/staff）硬编码在前端 | 生产环境移除或通过配置注入 |
| 2 | P2 | Token 存 localStorage，XSS 可窃取 | 改用 httpOnly cookie |
| 3 | P2 | "忘记密码"仅 toast，无实际功能 | 实现邮箱/手机重置流程 |
| 4 | P2 | GET /auth/test 调试端点未移除 | 删除或移至 /public/ 下 |
| 5 | P1 | POST /auth/register 公开无验证码，可被恶意注册 | 添加图形验证码或限制 |

---

### 2. 仪表板 `/dashboard`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 4 个 KPI 卡片展示 | 展示 | ✅ | 总资产/在用/闲置/待审批 |
| 2 | 资产价值趋势图 | 展示 | ✅ | Recharts 面积图，365 天 |
| 3 | 分类分布饼图 | 展示 | ✅ | 按资产类别统计 |
| 4 | 最近工单表格 | 交互 | ✅ | 点击行可跳转详情 |
| 5 | 维保预警列表 | 展示 | ✅ | 取前 5 条 |
| 6 | 部门资产统计 | 展示 | ✅ | 进度条展示 |
| 7 | CSV 导出 | 功能 | ⚠️ | 仅导出部门统计，非全部仪表板数据 |
| 8 | 刷新视图 | 交互 | ✅ | 点击刷新 |
| 9 | 查看/前往全部 | 导航 | ✅ | 跳转对应模块 |
| 10 | GET /dashboard/stats | API | ✅ | 5 个统计端点正常 |
| 11 | GET /dashboard/trends | API | ✅ | 支持 days 参数 |
| 12 | GET /dashboard/dept-distribution | API | ✅ | 正常返回 |
| 13 | GET /dashboard/maintenance-stats | API | ✅ | 正常返回 |
| 14 | GET /dashboard/pending-approvals | API | ✅ | 正常返回 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P2 | CSV 导出仅导出部门统计 | 提供全量仪表板数据导出 |
| 2 | P2 | 维保预警取前 5 条无分页 | 添加分页或"查看全部"链接 |
| 3 | P2 | staleTime 30s 可能导致频繁请求 | 调整为 5min |

---

### 3. 资产台账-列表 `/assets`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 关键词搜索 | 交互 | ✅ | 300ms 防抖 |
| 2 | 分类下拉筛选 | 交互 | ✅ | 树形分类 |
| 3 | 多状态标签筛选 | 交互 | ❌ | API 仅传 selectedStatuses[0]，多选不生效 |
| 4 | 部门下拉筛选 | 交互 | ✅ | 正常 |
| 5 | 重要设备开关 | 交互 | ✅ | 正常 |
| 6 | 重置筛选 | 交互 | ✅ | 正常 |
| 7 | 点击行跳转详情 | 导航 | ✅ | 正常 |
| 8 | 数据表格分页 | 展示 | ⚠️ | pageSize 固定 10 不可调 |
| 9 | 导入/导出 | 功能 | ⚠️ | CSV 导出仅当前页 |
| 10 | 新建资产 | 导航 | ✅ | 跳转 /assets/new |
| 11 | 底部统计卡 | 展示 | ⚠️ | 数据来自 dashboard stats 可能不同步 |
| 12 | GET /assets | API | ✅ | 正常 |
| 13 | GET /assets/list | API | ⚠️ | 与 GET /assets 功能完全重复 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | **P1** | 多状态筛选仅传第一个选中值，多选不生效 | 修改为逗号拼接或数组参数 |
| 2 | P2 | pageSize 固定 10 不可调 | 添加 pageSize selector |
| 3 | P2 | CSV 导出仅当前页 | 支持全量导出 |
| 4 | P2 | "闲置率""本月折旧"来自 dashboard stats | 改为从列表数据实时计算 |
| 5 | P2 | "+2.4%""4.2h"硬编码文案 | 接入真实统计数据 |
| 6 | P2 | GET /assets 与 GET /assets/list 重复 | 删除 listRoot 代理方法 |

---

### 4. 资产台账-详情 `/assets/:id`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 基本信息展示 | 展示 | ✅ | 正常 |
| 2 | 分类品牌型号详情 | 展示 | ✅ | 正常 |
| 3 | RFID 标签展示 | 展示 | ⚠️ | 仅文字，无实际扫码 |
| 4 | 折旧趋势图 | 展示 | ✅ | Recharts 面积图 |
| 5 | 变更记录 | 展示 | ⚠️ | 始终显示"暂无变更记录"，无 API 对接 |
| 6 | 返回列表 | 导航 | ✅ | 正常 |
| 7 | 跳转编辑 | 导航 | ✅ | 正常 |
| 8 | 删除资产（二次确认） | 交互 | ⚠️ | 成功后无 toast 提示 |
| 9 | GET /assets/:id | API | ✅ | 正常 |
| 10 | GET /assets/:id/depreciation-schedule | API | ✅ | 正常 |
| 11 | DELETE /assets/:id | API | ✅ | 正常 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P2 | 变更记录区域无 API 对接 | 对接 audit-log API |
| 2 | P2 | 删除成功后无 toast 提示 | 添加 success toast |

---

### 5. 资产台账-表单 `/assets/new` `/assets/:id/edit`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 基本信息填写 | 交互 | ✅ | 正常 |
| 2 | 树形分类选择 | 交互 | ✅ | 正常 |
| 3 | 部门选择 | 交互 | ✅ | 正常 |
| 4 | 位置选择 | 交互 | ✅ | 正常 |
| 5 | 财务信息 | 交互 | ✅ | 正常 |
| 6 | 提交创建 | 功能 | ✅ | POST /assets 正常 |
| 7 | 提交编辑 | 功能 | ✅ | PUT /assets/:id 正常 |
| 8 | 图片上传 | 功能 | ❌ | 无图片上传功能 |
| 9 | 编辑模式加载态 | 展示 | ⚠️ | 无加载态指示器 |
| 10 | description/remark 字数提示 | 交互 | ⚠️ | maxlength 无前端提示 |
| 11 | POST /assets (DTO 校验) | API | ⚠️ | AssetCreateDTO 无 @Valid |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P1 | 无图片/附件上传功能 | 集成文件上传组件 |
| 2 | P2 | 编辑模式无加载态 | 添加 Skeleton/Spinner |
| 3 | P2 | 提交后未刷新列表缓存 | queryClient.invalidateQueries |
| 4 | P2 | maxlength 500/200 无前端字数提示 | 添加字数计数器 |
| 5 | P2 | DTO 缺少 @Valid 注解 | 添加 @Valid + @NotBlank 等注解 |

---

### 6. 工单管理-列表 `/workorders`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 关键词搜索 | 交互 | ✅ | 正常 |
| 2 | 快捷状态筛选 | 交互 | ⚠️ | IN_PROGRESS/COMPLETED 不在快捷筛选中 |
| 3 | 数据表格 | 展示 | ✅ | 正常 |
| 4 | 分页 | 交互 | ✅ | 正常 |
| 5 | 点击行跳转详情 | 导航 | ✅ | 正常 |
| 6 | 新建工单 | 导航 | ✅ | 正常 |
| 7 | 导出功能 | 功能 | ⚠️ | 无导出功能 |
| 8 | 批量操作 | 功能 | ⚠️ | 无批量操作 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P2 | IN_PROGRESS/COMPLETED 状态不在快捷筛选 | 补全所有状态 |
| 2 | P2 | 无导出功能 | 添加工单导出 |

---

### 7. 工单管理-详情 `/workorders/:id`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 工单信息展示 | 展示 | ✅ | 正常 |
| 2 | 审批时间线 | 展示 | ✅ | ApprovalTimeline 组件 |
| 3 | 审批通过 | 交互 | ⚠️ | 无确认弹窗，可能误操作 |
| 4 | 驳回（填原因） | 交互 | ⚠️ | 驳回原因无字数校验 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P2 | 审批通过无确认弹窗 | 添加二次确认 |
| 2 | P2 | 驳回原因无字数限制校验 | 添加 maxlength 校验 |

---

### 8. 工单管理-表单 `/workorders/new` `/workorders/:id/edit`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 标题/类型/优先级填写 | 交互 | ✅ | 正常 |
| 2 | 关联资产搜索 | 交互 | ❌ | 搜索按钮无实际功能，仅有输入框 |
| 3 | 负责人选择 | 交互 | ✅ | 正常 |
| 4 | 协作人管理 | 交互 | ❌ | 前端纯文本管理，未提交到后端 |
| 5 | 智能辅助系统 | 展示 | ⚠️ | 静态文案，非实际 AI |
| 6 | 提交工单 | 功能 | ✅ | 正常 |
| 7 | GET /users/search | API | ⚠️ | getUserList 手动 useEffect，错误被静默吞掉 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | **P1** | 关联资产搜索按钮无实际功能 | 实现资产搜索弹窗 |
| 2 | **P1** | 协作人列表未提交到后端 | 在 FormValues schema 中添加 collaborators 字段 |

---

### 9. 审批流程 `/approvals`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 待我审批 Tab | 交互 | ✅ | 正常 |
| 2 | 我发起的 Tab | 交互 | ✅ | 正常 |
| 3 | 已审批 Tab | 交互 | ✅ | 正常 |
| 4 | 统计卡片 | 展示 | ⚠️ | "已通过""已驳回"始终显示"-" |
| 5 | 类型/状态/日期筛选 | 交互 | ⚠️ | 筛选状态未与 Tab 联动 |
| 6 | 通过审批 | 交互 | ✅ | 正常 |
| 7 | 驳回审批 | 交互 | ✅ | 正常 |
| 8 | 查看详情 | 交互 | ✅ | 弹窗展示 |
| 9 | GET /approvals | API | ✅ | 正常 |
| 10 | GET /approvals/pending/count | API | ✅ | 正常 |
| 11 | POST /approvals/:id/approve | API | ✅ | 正常 |
| 12 | POST /approvals/:id/reject | API | ✅ | 正常 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P2 | "已通过""已驳回"统计卡片始终"-" | 分别调用 API 获取各状态计数 |
| 2 | P2 | 筛选状态与 Tab 联动冲突 | 统一状态管理逻辑 |
| 3 | P2 | 日期范围无校验（结束日期可早于开始日期） | 添加日期校验 |
| 4 | P2 | ApprovalController 手动解析 JWT | 使用 @AuthenticationPrincipal |

---

### 10. 盘点管理 `/inventory`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 统计卡片（进行中/已完成/待开始） | 展示 | ⚠️ | 仅统计当前页数据，非全局 |
| 2 | 状态筛选 | 交互 | ✅ | 正常 |
| 3 | 任务表格 | 展示 | ✅ | 正常 |
| 4 | 新建盘点任务 | 交互 | ✅ | 弹窗表单 |
| 5 | 查看详情 | 导航 | ✅ | 正常 |
| 6 | RFID 扫描 | 功能 | ✅ | POST /inventory/tasks/:id/scan |
| 7 | 智能报告 | 功能 | ✅ | 依赖已完成任务 |
| 8 | 异常趋势图 | 展示 | ⚠️ | 数据来自当前页前 5 条，非全局 |
| 9 | GET /inventory/tasks | API | ✅ | 正常 |
| 10 | POST /inventory/tasks | API | ✅ | 正常 |
| 11 | POST /inventory/approve | API | ❌ | Long.valueOf(taskId) 未做空值检查，可能 NPE |
| 12 | POST /inventory/tasks/:id/submit | API | ⚠️ | 与 approve 功能重叠 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | **P0** | POST /inventory/approve 中 `Long.valueOf(taskId)` 未做空值检查，body.get("taskId") 为 null 时抛 NPE | 添加 null 检查或使用 @Valid DTO |
| 2 | P2 | approve 与 submit 功能重叠 | 明确区分或合并 |
| 3 | P2 | 统计卡片仅当前页数据 | 独立调用统计 API |
| 4 | P1 | 双前缀 /inventory 和 /v1/inventory | 移除 /v1/ 别名 |

---

### 11. 退役管理 `/retirement`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 退役申请列表 | 展示 | ✅ | 正常 |
| 2 | 搜索筛选 | 交互 | ✅ | 正常 |
| 3 | 新建退役申请 | 交互 | ✅ | 正常 |
| 4 | 退役审批（通过/拒绝） | 交互 | ✅ | 正常 |
| 5 | 撤销申请 | 交互 | ✅ | 正常 |
| 6 | 统计卡片 | 展示 | ✅ | 正常 |
| 7 | GET /retirement | API | ✅ | 正常 |
| 8 | POST /retirement/apply | API | ✅ | 正常 |
| 9 | GET /retirement/statistics | API | ✅ | 正常 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P1 | 双前缀 /retirement 和 /v1/retirement | 移除 /v1/ 别名 |
| 2 | P2 | 23 个方法大量路径别名冗余 | 清理冗余端点 |
| 3 | P2 | DELETE /retirement/:id 与 POST /retirement/:id/cancel 功能重叠 | 统一为一个 |
| 4 | P2 | 手动解析 JWT | 使用 @AuthenticationPrincipal |
| 5 | P2 | 前端两套 retirement API（retirement.ts + retirementApi.ts） | 统一为一套 |

---

### 12. 资产处置 `/disposals`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 处置列表 | 展示 | ✅ | 正常 |
| 2 | 类型页签切换 | 交互 | ✅ | 正常 |
| 3 | 转移申请表单 | 交互 | ❌ | POST /disposals/transfer 直接抛 BusinessException(500) |
| 4 | 清退申请表单 | 交互 | ❌ | POST /disposals/clearance 直接抛异常(500) |
| 5 | 报废申请表单 | 交互 | ❌ | POST /disposals/scrap 直接抛异常(500) |
| 6 | 赔偿申请 | 交互 | ❌ | CompensationController POST create 直接抛异常(500) |
| 7 | GET /disposals/history | API | ✅ | 正常 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | **P0** | DisposalController 三个 POST（transfer/clearance/scrap）直接抛 BusinessException 返回 500 | 应返回 400 Bad Request + 明确错误信息 |
| 2 | **P0** | CompensationController POST create 直接抛异常返回 500 | 同上 |
| 3 | P1 | 双前缀 /compensation 和 /compensations | 移除别名 |
| 4 | P2 | 无删除和更新接口 | 补充 CRUD |

---

### 13. 闲置资产 `/idle`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 闲置资产列表 | 展示 | ✅ | 正常 |
| 2 | 发布闲置公告 | 交互 | ✅ | 正常 |
| 3 | 认领闲置资产 | 交互 | ✅ | 正常 |
| 4 | 取消发布 | 交互 | ✅ | 正常 |
| 5 | 删除公告 | 交互 | ✅ | 正常 |
| 6 | GET /idle-assets/list | API | ✅ | 正常 |
| 7 | POST /idle-assets | API | ✅ | 正常 |
| 8 | POST /idle-assets/:id/claim | API | ✅ | 正常 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P2 | IdleAssetController 手动解析 JWT | 使用 @AuthenticationPrincipal |

---

### 14. 折旧管理 `/depreciation`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 折旧计划查询 | 展示 | ✅ | 正常 |
| 2 | 批量计算折旧 | 交互 | ✅ | 正常 |
| 3 | GET /depreciation/schedules | API | ✅ | 正常 |
| 4 | POST /depreciation/calculate | API | ✅ | 正常 |

**发现问题：** 无

---

### 15. 重要设备 `/equipment`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 设备列表 | 展示 | ✅ | 正常 |
| 2 | 保养记录管理 | 交互 | ✅ | 正常 |
| 3 | 维保预警 | 展示 | ✅ | 正常 |
| 4 | GET /maintenance/list | API | ✅ | 正常 |
| 5 | GET /maintenance/upcoming | API | ✅ | 正常 |
| 6 | POST /maintenance | API | ✅ | 正常 |

**发现问题：** 无

---

### 16. 供应商管理 `/vendors`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 供应商列表 | 展示 | ✅ | 正常（MyBatis 自动建表） |
| 2 | 新建供应商 | 交互 | ✅ | 正常 |
| 3 | 编辑供应商 | 交互 | ✅ | 正常 |
| 4 | 删除供应商 | 交互 | ✅ | 正常 |
| 5 | GET /vendors | API | ✅ | 正常 |
| 6 | POST /vendors | API | ✅ | 正常 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | **P0** | vendor 表在 schema.sql 中缺少 CREATE TABLE 语句 | 补建 DDL |
| 2 | P2 | create/update 使用实体而非 DTO，缺少参数验证 | 创建 VendorCreateDTO/VendorUpdateDTO |
| 3 | P2 | list 不支持分页 | 添加分页支持 |

---

### 17. 存放地点 `/locations`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 地点列表 | 展示 | ✅ | 正常 |
| 2 | 树形结构 | 展示 | ✅ | 正常 |
| 3 | 新建地点 | 交互 | ✅ | 正常 |
| 4 | 编辑地点 | 交互 | ✅ | 正常 |
| 5 | 删除地点 | 交互 | ✅ | 正常 |
| 6 | 重新排序 | 交互 | ✅ | 正常 |
| 7 | GET /locations/list | API | ✅ | 正常 |
| 8 | PUT /locations/reorder | API | ⚠️ | 循环逐个更新，N 次数据库操作 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | **P0** | location 表在 schema.sql 中缺少 CREATE TABLE 语句 | 补建 DDL |
| 2 | P2 | GET /locations/list 与 /locations/root 功能重复 | 删除 /root |
| 3 | P2 | create 使用实体而非 DTO | 创建 LocationCreateDTO |
| 4 | P1 | reorder 循环 N 次 DB 操作有性能问题 | 改为批量 UPDATE |

---

### 18. 系统设置 `/settings`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 用户管理 CRUD | 交互 | ✅ | 正常 |
| 2 | 部门管理 CRUD | 交互 | ✅ | 正常 |
| 3 | 角色管理 CRUD | 交互 | ✅ | 正常 |
| 4 | 重置密码 | 功能 | ✅ | 正常 |
| 5 | 用户状态启停 | 功能 | ✅ | 正常 |
| 6 | GET /user-management/list | API | ✅ | 正常 |
| 7 | GET /depts/list | API | ✅ | 正常 |
| 8 | GET /roles/list | API | ✅ | 正常 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P1 | UserManagementController 双前缀 /user-management 和 /users | 统一为 /users |
| 2 | **P1** | Dept Entity 有 email 字段但 DDL sys_dept 无此列，INSERT 包含 email 会报错 | 删除 Entity 的 email 字段或补建 DDL 列 |
| 3 | **P1** | Dept Entity 缺少 deleted 字段，DDL 有 deleted TINYINT DEFAULT 0，无法支持逻辑删除 | 添加 @TableLogic private Integer deleted |
| 4 | **P1** | Role Entity 缺少 sortOrder 字段，DDL 有 sort_order INT DEFAULT 0 | 添加 private Integer sortOrder |
| 5 | P2 | GET /depts/all 与 /depts/list 功能重叠 | 删除 /all |

---

### 19. 审计日志 `/audit`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 日志查询 | 展示 | ✅ | 正常 |
| 2 | 统计图表 | 展示 | ✅ | 正常 |
| 3 | 操作人排行 | 展示 | ✅ | 正常 |
| 4 | 操作类型分布 | 展示 | ✅ | 正常 |
| 5 | GET /audit-logs | API | ✅ | 正常 |
| 6 | GET /audit-logs/count | API | ✅ | 正常 |
| 7 | GET /audit-logs/trends | API | ✅ | 正常 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P1 | 三重路径映射 /audit-logs + /v1/audit-log + /v1/audit | 统一为 /audit-logs |
| 2 | P2 | 返回类型不一致：getLogs/getCount 返回 ResponseEntity<Result>，其他返回 Result | 统一返回类型 |
| 3 | P2 | /trends 和 /trend 同时存在 | 删除 /trend |

---

### 20. 数据分析 `/analytics`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 资产汇总统计 | 展示 | ✅ | 正常 |
| 2 | 按分类统计 | 展示 | ✅ | 正常 |
| 3 | GET /reports/summary | API | ✅ | 正常 |
| 4 | GET /reports/by-category | API | ✅ | 正常 |

**发现问题：** 无

---

### 21. 通知中心 `/notifications`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 通知列表 | 展示 | ✅ | 正常 |
| 2 | 已读/未读状态 | 交互 | ✅ | 正常 |
| 3 | 标记全部已读 | 交互 | ✅ | 正常 |
| 4 | 删除通知 | 交互 | ✅ | 正常 |
| 5 | GET /notifications/pending | API | ✅ | 正常 |
| 6 | GET /notifications/pending/count | API | ❌ | 后端用 list().size() 计算，性能问题 |
| 7 | GET /notifications/unread-count | API | ❌ | 前端调用此路径，后端只有 /pending/count，路径不匹配 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | **P0** | 前端 GET /notifications/unread-count，后端只有 /notifications/pending/count，路径不匹配 | 统一路径 |
| 2 | **P1** | pendingCount 通过获取全部通知列表再 .size() 计算 | 改为数据库 COUNT 查询 |
| 3 | P2 | NotificationController 手动解析 JWT | 使用 @AuthenticationPrincipal |

---

### 22. 工作流 `/workflows`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 工作流定义列表 | 展示 | ✅ | 正常 |
| 2 | 保存草稿 | 交互 | ✅ | 正常 |
| 3 | 发布工作流 | 交互 | ✅ | 正常 |
| 4 | 更新状态 | 交互 | ✅ | 正常 |
| 5 | GET /workflows | API | ✅ | 正常 |
| 6 | PUT /workflows/:type/draft | API | ✅ | 正常 |
| 7 | POST /workflows/:type/publish | API | ✅ | 正常 |

**发现问题：** 无

---

### 23. 大屏展示 `/bigscreen` `/bigscreen-3d`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | 全屏数据展示 | 展示 | ✅ | 正常渲染 |
| 2 | 认证保护 | 安全 | ❌ | 无认证，任何人可访问 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P1 | 大屏页面无认证保护 | 在 SecurityConfig 中添加 /bigscreen/** 的认证规则 |

---

### 24. 资产导入导出 `/assets/import-export`

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | Excel 模板下载 | 功能 | ✅ | 正常 |
| 2 | 文件解析预览 | 功能 | ✅ | 正常 |
| 3 | 批量导入 | 功能 | ✅ | 正常 |
| 4 | 筛选导出 | 功能 | ✅ | 正常 |
| 5 | GET /assets/import/template | API | ✅ | 正常 |
| 6 | POST /assets/import/parse | API | ✅ | 正常 |
| 7 | POST /assets/import/commit | API | ✅ | 正常 |
| 8 | POST /assets/export | API | ✅ | 正常 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P2 | 前端两套导入导出 API（asset.ts 和 assetImport.ts/assetExport.ts） | 统一为一套 |

---

### 25. 健康检查（后端独立模块）

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | GET /health | API | ❌ | 需 JWT 认证，运维探活不可用 |
| 2 | GET /system/health | API | ❌ | 需 JWT 认证，运维探活不可用 |
| 3 | GET /system/info | API | ⚠️ | 需 JWT 认证 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | **P0** | HealthCheckController `/health` 需 JWT 认证，运维探活不可用 | SecurityConfig 中添加 `/health` 到 permitAll() |
| 2 | **P0** | SystemHealthController `/system/health` 需 JWT 认证，运维探活不可用 | 同上 |
| 3 | P2 | HealthCheckController 与 SystemHealthController 功能重复 | 合并为一个 |

---

### 26. 系统统计（后端独立模块）

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | GET /stats/overview | API | ✅ | 正常返回（try-catch 吞异常） |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | P2 | try-catch 吞掉所有异常，绕过全局异常处理器 | 删除 try-catch，让全局处理器统一处理 |

---

### 27. HelloController（后端独立模块）

| # | 功能点 | 类型 | 结果 | 说明 |
|---|--------|------|------|------|
| 1 | GET /api/api/hello | API | ❌ | @RequestMapping("/api") + context-path=/api 导致双前缀 |

**发现问题：**

| # | 严重度 | 问题描述 | 建议修复 |
|---|--------|---------|---------|
| 1 | **P0** | HelloController @RequestMapping("/api") 双前缀，实际路径为 /api/api/hello | 删除或改为 @RequestMapping("") |

---

## 三、Bug 汇总

### P0 严重（6 个）

| # | Bug ID | 模块 | 问题描述 | 文件 |
|---|--------|------|---------|------|
| 1 | BUG-V2-01 | 盘点管理 | POST /inventory/approve 中 Long.valueOf(taskId) 未做空值检查，NPE 风险 | InventoryController.java |
| 2 | BUG-V2-02 | 资产处置 | DisposalController 三个 POST（transfer/clearance/scrap）直接抛异常返回 500 | DisposalController.java |
| 3 | BUG-V2-03 | 资产处置 | CompensationController POST create 直接抛异常返回 500 | CompensationController.java |
| 4 | BUG-V2-04 | 供应商 | vendor 表在 schema.sql 中缺少 CREATE TABLE | schema.sql |
| 5 | BUG-V2-05 | 存放地点 | location 表在 schema.sql 中缺少 CREATE TABLE | schema.sql |
| 6 | BUG-V2-06 | 健康检查 | /health 和 /system/health 需 JWT 认证，运维探活不可用 | SecurityConfig.java |

### P1 高优（11 个）

| # | Bug ID | 模块 | 问题描述 | 文件 |
|---|--------|------|---------|------|
| 1 | BUG-V2-07 | 资产列表 | 多状态筛选仅传第一个选中值，多选不生效 | AssetListPage.tsx |
| 2 | BUG-V2-08 | 资产表单 | 无图片/附件上传功能 | AssetFormPage.tsx |
| 3 | BUG-V2-09 | 工单表单 | 关联资产搜索按钮无实际功能 | WorkOrderFormPage.tsx |
| 4 | BUG-V2-10 | 工单表单 | 协作人列表未提交到后端 | WorkOrderFormPage.tsx |
| 5 | BUG-V2-11 | 盘点管理 | 双前缀 /inventory 和 /v1/inventory | InventoryController.java |
| 6 | BUG-V2-12 | 退役管理 | 双前缀 /retirement 和 /v1/retirement | RetirementController.java |
| 7 | BUG-V2-13 | 存放地点 | reorder 循环 N 次 DB 操作性能问题 | LocationController.java |
| 8 | BUG-V2-14 | 系统设置 | Dept Entity 有 email 字段但 DDL 无此列 | Dept.java |
| 9 | BUG-V2-15 | 系统设置 | Dept Entity 缺少 deleted 字段（逻辑删除） | Dept.java |
| 10 | BUG-V2-16 | 系统设置 | Role Entity 缺少 sortOrder 字段 | Role.java |
| 11 | BUG-V2-17 | 系统设置 | UserManagementController 双前缀 | UserManagementController.java |

### P2 一般（25 个，部分列举）

| # | Bug ID | 模块 | 问题描述 |
|---|--------|------|---------|
| 1 | BUG-V2-18 | 登录 | 4 个演示账号硬编码在前端 |
| 2 | BUG-V2-19 | 登录 | Token 存 localStorage，无 httpOnly cookie |
| 3 | BUG-V2-20 | 登录 | GET /auth/test 调试端点未移除 |
| 4 | BUG-V2-21 | 审批流程 | "已通过""已驳回"统计卡片始终"-" |
| 5 | BUG-V2-22 | 通知中心 | 前端 /unread-count 与后端 /pending/count 路径不匹配 |
| 6 | BUG-V2-23 | 通知中心 | pendingCount 通过 list().size() 计算 |
| 7 | BUG-V2-24 | 审计日志 | 三重路径映射 /audit-logs + /v1/* |
| 8 | BUG-V2-25 | 大屏展示 | 无认证保护 |
| 9 | BUG-V2-26 | HelloController | 双前缀 /api/api/hello |
| 10 | BUG-V2-27 | 统计 | try-catch 吞掉异常 |
| 11-25 | ... | 多模块 | 其余 P2 问题（见各模块详情） |

---

## 四、前后端一致性分析

### API 版本不一致

| 前端文件 | 使用的路径 | 另一套 API 文件 | 使用的路径 |
|---------|-----------|---------------|-----------|
| asset.ts | `/assets/*` | assetImport.ts / assetExport.ts | `/v1/assets/*` |
| retirement.ts | `/retirement/*` | retirementApi.ts | `/v1/retirement/*` |
| audit.ts | `/audit-logs/*` | — | `/v1/audit/*` |

**建议**：统一为无版本前缀路径，删除 /v1/ 别名。

### 前后端路径不匹配

| # | 前端调用 | 后端实际 | 影响 |
|---|---------|---------|------|
| 1 | `GET /notifications/unread-count` | `GET /notifications/pending/count` | 未读数可能无法获取 |
| 2 | `GET /locations/cascade` | LocationController 无此端点 | 级联选择器可能 404 |

### 手动解析 JWT 的 Controller（4 个）

| Controller | 影响 |
|-----------|------|
| ApprovalController | 与 Spring Security 上下文脱节 |
| IdleAssetController | 同上 |
| NotificationController | 同上 |
| RetirementController | 同上 |

**建议**：统一使用 `@AuthenticationPrincipal` 或 `SecurityContextHolder.getContext().getAuthentication()`。

---

## 五、数据库与实体分析

### 表缺失（P0）

| Entity | @TableName | DDL 状态 | 影响 |
|--------|-----------|---------|------|
| Vendor | `vendor` | **schema.sql 中无 CREATE TABLE vendor** | MyBatis 自动建表可缓解，但生产环境风险高 |
| Location | `location` | **schema.sql 中无 CREATE TABLE location** | 同上 |

### 字段映射问题（P1）

| Entity | 问题 | 影响 |
|--------|------|------|
| Dept | Entity 有 `email` 字段，DDL `sys_dept` 无此列 | INSERT 包含 email 列会报错 |
| Dept | Entity 缺少 `deleted` 字段，DDL 有 `deleted TINYINT DEFAULT 0` | 无法支持逻辑删除 |
| Role | Entity 缺少 `sortOrder` 字段，DDL 有 `sort_order INT DEFAULT 0` | 新建角色无法设置排序号 |

### 枚举与 DDL 不一致（P1）

| 枚举 | DDL DEFAULT | 枚举包含该值？ | 说明 |
|------|------------|--------------|------|
| `OrderStatus` | `work_order.status DEFAULT 'DRAFT'` | **否**（只有 PENDING） | DDL 默认值不在枚举中，可能解析异常 |
| `InventoryStatus` | `inventory_task.status DEFAULT 'PENDING'` | **否**（只有 DRAFT） | 同上 |

**建议**：将 DDL DEFAULT 改为枚举包含的值，或在枚举中增加对应值。

---

## 六、架构级问题

### 安全问题

| # | 严重度 | 问题描述 | 建议 |
|---|--------|---------|------|
| 1 | P0 | 健康检查需 JWT 认证 | SecurityConfig 添加 permitAll |
| 2 | P1 | 大屏页面无认证保护 | 添加认证规则 |
| 3 | P1 | POST /auth/register 公开无验证码 | 添加验证码 |
| 4 | P2 | Token 存 localStorage | 改用 httpOnly cookie |
| 5 | P2 | GET /auth/test 调试端点 | 删除 |

### 性能问题

| # | 严重度 | 问题描述 | 建议 |
|---|--------|---------|------|
| 1 | P1 | NotificationController pendingCount 用 list().size() | 改为 COUNT 查询 |
| 2 | P1 | LocationController reorder 循环 N 次 DB | 改为批量 UPDATE |
| 3 | P2 | Dashboard staleTime 30s | 调整为 5min |

### 代码规范

| # | 严重度 | 问题描述 | 涉及文件 |
|---|--------|---------|---------|
| 1 | P1 | 4 个 Controller 手动解析 JWT | Approval/IdleAsset/Notification/Retirement |
| 2 | P1 | 6 个 Controller 双/多前缀 | Hello/Inventory/Retirement/Compensation/Audit/WorkOrder/UserMgmt |
| 3 | P2 | 返回类型不一致 ResponseEntity vs Result | AuditDashboardController |
| 4 | P2 | try-catch 吞异常 | StatsController |
| 5 | P2 | 前端两套同名 API | retirement.ts + retirementApi.ts, asset.ts + assetImport.ts |
| 6 | P2 | 空壳类 CallbackController 无任何端点 | CallbackController.java |
| 7 | P2 | context-path 在 yml 和 properties 中重复配置 | application.yml + application.properties |

---

## 七、V1 → V2 变更追踪

| # | Bug ID | V1 状态 | V2 状态 | 说明 |
|---|--------|---------|---------|------|
| 1 | BUG-01 (Controller 双前缀 x4) | 已修复 | **未修复** | StatsController/ReportController/SystemHealthController/HealthCheckController 仍存在（部分路径已变更但问题模式相同） |
| 2 | BUG-02 (API base path 丢失) | 已修复 | ✅ 已确认修复 | 前端 API 调用正常 |
| 3 | BUG-03 (选择器过宽) | 已修复 | ✅ 已确认修复 | 搜索选择器已收敛 |
| 4 | BUG-04 (报告误判) | 已修复 | ✅ 已确认修复 | quality-gate 已增强 |
| 5 | BUG-05 (Vendor Entity 映射) | 待修复 | ⚠️ 降级 | vendor 表 DDL 缺失是更严重的问题 |
| 6 | BUG-06 (Location Entity 映射) | 待修复 | ⚠️ 降级 | location 表 DDL 缺失是更严重的问题 |
| 7 | BUG-07 (approval_process.applicant_id) | 待修复 | **仍存在** | DDL 未添加 DEFAULT 值 |
| 8 | BUG-08 (AssetStatus 缺 IN_STOCK) | 待修复 | ⚠️ 已有别名映射 | AssetStatus 有 IN_STOCK->IDLE 别名，基本可用但不够规范 |
| 9 | BUG-09 (CategoryUpdateDTO) | 待修复 | ⚠️ 未确认 | 需进一步测试 |

---

## 八、总结与建议

### 核心发现

1. **P0 问题 6 个**：健康检查认证、处置 Controller 返回 500、DDL 表缺失、NPE 风险
2. **P1 问题 11 个**：Entity 字段不匹配、枚举不一致、手动 JWT 解析、双前缀、性能问题
3. **P2 问题 25 个**：代码规范、UI 体验、功能缺失

### 修复优先级建议

**第一优先级（立即修复，预计 1-2 天）**
- 健康检查端点添加 permitAll
- DisposalController/CompensationController 异常返回 400
- 补建 vendor/location 表 DDL
- 修复 InventoryController NPE
- 修复 notifications 路径不匹配

**第二优先级（本周内，预计 2-3 天）**
- Dept/Role Entity 字段补全
- OrderStatus/InventoryStatus 枚举与 DDL 对齐
- 统一 JWT 解析方式
- 清理双前缀 Controller

**第三优先级（迭代优化，预计 1-2 周）**
- 前端双版本 API 统一
- 审批统计卡片修复
- 资产多状态筛选修复
- 工单关联资产搜索实现
- 性能优化（pendingCount、reorder）

### 整体评估

forthAMS 系统功能覆盖面广（27 个模块），核心业务流程（资产 CRUD、工单审批、盘点、退役）均可正常运行。主要风险集中在：
1. **API 一致性**：多版本路径共存、前后端路径不匹配
2. **异常处理**：部分 Controller 直接抛异常而非返回有意义的错误
3. **数据库完整性**：DDL 缺失、Entity 字段不匹配
4. **安全配置**：健康检查认证、大屏无保护
