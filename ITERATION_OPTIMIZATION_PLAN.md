# forthAMS 迭代优化计划 (Iteration Optimization Plan)

> 基于代码级深度调研，对比 IBM Maximo / SAP EAM / Fiix / UpKeep / EZOfficeInventory 等成熟 EAM 平台。
> 最后更新: 2026-06-03

---

## 一、现状评估总结

### 1.1 已完善模块（可投产）

| 模块 | 后端深度 | 前端深度 | 评估 |
|------|---------|---------|------|
| 资产 CRUD + 分类树 + 资产模型 | 完整 | 完整 | 可用 |
| 工单基础审批流（创建->提交->审批->执行->完成） | 完整 | 完整 | 可用但浅 |
| 报废退役（多步审批 + 统计） | 完整 | 完整 | 可用 |
| 折旧计算（直线法 + 双倍余额递减法） | 完整 | 完整 | 可用 |
| 盘点任务（RFID + 智能报告） | 完整 | 完整 | 差异处理断裂 |
| 维护保养计划（多触发类型 + 自动生成） | 完整 | 完整 | 缺 Checklist |
| GIS 地图 + 平面图 + 能耗管理 | 完整 | 完整 | 可用 |
| 软件资产管理 + 合规扫描 | 完整 | 完整 | 可用 |
| 审计日志仪表板 | 完整 | 完整 | 可用 |
| 可视化工作流引擎 | 完整 | 完整 | 可用 |
| 多渠道通知系统 | 完整 | 完整 | 可用 |
| 资产调拨（审批流 + 状态机） | 完整 | 完整 | 可用 |
| 采购订单全生命周期 | 完整 | 完整 | 可用 |
| 合同管理 | 完整 | 完整 | 可用 |
| 系统管理（用户/角色/菜单/部门/岗位） | 完整 | 完整 | 可用 |

### 1.2 存在明确缺陷的模块

| 模块 | 问题描述 | 严重程度 |
|------|---------|---------|
| **工单 SLA** | `slaDeadline`/`slaStatus` 字段标记为 `@TableField(exist=false)` 不持久化；前端用硬编码阈值做客户端计算，无服务端支撑 | 高 |
| **工单执行跟踪** | EXECUTING 状态是一个不透明状态，无工时登记、无进度百分比、无步骤 Checklist、无现场照片 | 高 |
| **工单成本** | 仅有 `estimatedCost`/`actualCost` 两个手动填写字段，无工时x费率、无备件成本、无外协成本分项 | 中 |
| **工单状态机不一致** | `WorkOrderStateMachine.java` 定义了 `APPROVING_LEVEL_1`/`APPROVING_LEVEL_2` 状态，但 `WorkOrderService.operateWorkOrder()` 使用简单 switch-case 未集成状态机 | 中 |
| **盘点差异处理** | 前端 UI 完整（差异确认/批量确认/提交），但后端 `POST /inventory/tasks/{id}/submit` 仅变更状态为 SUBMITTED，无自动调账逻辑 | 高 |
| **资产时间线** | 审计日志 Timeline 可用，但 `AssetLifecycleTimeline.tsx` 组件调用 `/retirement/timeline/{assetId}` 可能无对应后端端点 | 低 |
| **工单附件** | 前端类型定义 `attachments?: string[]` 但后端 WorkOrder 实体无此字段，无数据库列，无上传逻辑 | 中 |

### 1.3 完全缺失的模块

| 模块 | 对标平台 | 当前状态 |
|------|---------|---------|
| 资产入库验收流程 | IBM Maximo 收货->质检->入库->生成资产卡片 | 采购订单有 receive 按钮，但仅为状态翻转，不创建资产记录 |
| 资产领用/归还 | Fiix/UpKeep 领用->审批->签收->归还 | `asset_usage_log` 表有 CHECKOUT/CHECKIN action 定义但无业务代码写入 |
| 资产借用管理 | EZOfficeInventory 借用->审批->借出->到期提醒->归还 | 前端类型有 `BORROWED` 枚举值但未使用 |
| 资产主附属关系 | IBM Maximo 设备 BOM 树 | Asset 实体无 parentId，数据库无此列 |
| 资产图片/附件库 | 成熟平台多图+CAD | `sys_attachment` 表存在但未关联资产 |
| 备品备件管理 | Fiix 备件库存+工单领用 | 零代码 |
| 故障代码体系 | SAP PM 三级故障编码 | 零代码 |
| 维修验收 | 成熟平台独立验收环节 | 零代码，EXECUTING->COMPLETED 直接跳转 |
| 维修挂起/恢复 | MaintainX 挂起+超时提醒 | OrderStatus 枚举无 HOLD 状态 |
| MTBF/MTTR 可靠性指标 | IBM Maximo | 零代码 |
| 保险管理 | Infor EAM | 零代码 |
| 检验/年检管理 | IBM Maximo | 零代码 |
| 预算管理 | 成熟平台年度预算编制 | 零代码 |
| TCO 全生命周期成本 | SAP EAM | 零代码 |
| 资产减值/重估 | SAP | 零代码 |
| 循环盘点 / ABC 分类 | 成熟平台自动排期 | 零代码 |
| 评论/协作系统 | MaintainX 评论+@mention | 零代码 |
| 自定义报表构建器 | IBM Maximo 拖拽式设计器 | 按钮显示"即将上线" toast |
| 定时报表推送 | 成熟平台 cron+邮件 | 零代码 |
| PDF 导出 | 普遍支持 | 前后端均无 PDF 库 |
| API 文档门户 | OpenAPI/Swagger | 无 springdoc 依赖 |
| 移动端路由 | H5/PWA | 4 个 Mobile 页面已开发但未注册路由 |
| 供应商门户 | SAP Ariba | VendorPortal 页面已开发但未注册路由 |
| 深色模式 | 普遍支持 | `.dark` CSS 变量已定义但无切换代码 |
| 国际化 (i18n) | 中英多语 | 1 个 zh-CN locale 文件但无 i18next 初始化 |
| IoT 传感器接入 | IBM Maximo MQTT | 零代码 |
| 预测性维护 | Fiix | 零代码 |

---

## 二、PHASE 分阶段实施计划

---

### Phase 1: 修复现有模块缺陷（加固地基）

**目标**: 在增加新功能前，先修复已有模块的业务断裂点和架构不一致问题。

#### Task 1.1: 工单 SLA 持久化与服务端计算

**问题**: `WorkOrder.java` 的 `slaDeadline`/`slaStatus` 标记为 `@TableField(exist=false)`，前端用硬编码阈值做客户端计算。

**改造方案**:

- 后端:
  - 移除 `@TableField(exist=false)`，在 `work_order` 表增加 `sla_deadline DATETIME` 和 `sla_status VARCHAR(32)` 列（Flyway migration）
  - 新建 `SlaConfig` 实体（`sla_config` 表）：`id`, `priority`, `responseHours`, `resolveHours`, `tenantId`
  - 在 `WorkOrderService.createWorkOrder()` 中根据优先级查询 `SlaConfig` 计算 `slaDeadline`
  - 新建 `@Scheduled` 定时任务 `SlaMonitorTask`，每小时扫描即将超时和已超时的工单，更新 `slaStatus` 并发送通知
- 前端:
  - `WorkOrderDetailPage.tsx` 移除客户端 SLA 计算逻辑，改为读取后端 `slaDeadline`/`slaStatus`
  - `WorkOrderListPage.tsx` 增加 SLA 状态筛选（NORMAL/WARNING/BREACHED）
  - 系统设置页增加 SLA 配置 Tab（按优先级设置响应/解决时限）

**涉及文件**:
- `backend/src/main/java/com/ams/entity/WorkOrder.java` -- 移除 `@TableField(exist=false)`
- `backend/src/main/java/com/ams/service/WorkOrderService.java` -- 增加 SLA 计算逻辑
- `backend/src/main/resources/migration/` -- 新增 migration SQL
- 新建: `backend/src/main/java/com/ams/entity/SlaConfig.java`
- 新建: `backend/src/main/java/com/ams/service/SlaMonitorTask.java`
- 新建: `backend/src/main/java/com/ams/controller/SlaConfigController.java`
- `frontend/src/pages/workorder/WorkOrderDetailPage.tsx` -- 移除客户端计算

**复杂度**: 中

---

#### Task 1.2: 工单状态机统一

**问题**: `WorkOrderStateMachine.java` 与 `WorkOrderService.operateWorkOrder()` 是两套独立逻辑，状态机定义了 `APPROVING_LEVEL_1`/`APPROVING_LEVEL_2` 但 Service 未使用。

**改造方案**:

- 统一使用 `WorkOrderStateMachine` 作为唯一状态转换入口
- `WorkOrderService.operateWorkOrder()` 改为委托给状态机
- OrderStatus 枚举中确认是否需要 `APPROVING_LEVEL_1`/`APPROVING_LEVEL_2` 或直接简化为 `APPROVING`
- 确保状态转换测试覆盖全部路径

**涉及文件**:
- `backend/src/main/java/com/ams/state/WorkOrderStateMachine.java`
- `backend/src/main/java/com/ams/service/WorkOrderService.java`
- `backend/src/main/java/com/ams/enums/OrderStatus.java`

**复杂度**: 中（需全面回归测试）

---

#### Task 1.3: 盘点差异处理闭环

**问题**: 前端 UI 完整（差异确认/批量确认/提交核准），但后端 `submit` 仅变更状态，无自动调账逻辑。

**改造方案**:

- 后端:
  - `InventoryService.submitTask()` 增强：提交后进入 `PENDING_APPROVAL` 状态
  - 新增 `InventoryService.approveTask(taskId)`：审批通过后自动执行调账
  - 调账逻辑：
    - 盘盈（surplus）：根据盘点明细中的资产信息，自动创建 Asset 记录（状态为 IDLE）
    - 盘亏（deficit）：将对应 Asset 状态变更为 LOST，记录变更日志
    - 损坏（damaged）：将对应 Asset 状态变更为 MAINTENANCE
  - `InventoryComparisonResultDTO.java` 已有结构定义，补充填充和持久化逻辑
- 前端:
  - `InventoryDetailPage.tsx` 增加审批通过后的调账结果展示（成功/失败明细）
  - `DifferenceSummaryPanel.tsx` 增加调账预览（审批前可预览将要执行的变更）

**涉及文件**:
- `backend/src/main/java/com/ams/service/InventoryService.java` -- 核心调账逻辑
- `backend/src/main/java/com/ams/controller/InventoryController.java` -- approve 端点
- `backend/src/main/java/com/ams/dto/InventoryComparisonResultDTO.java` -- 填充逻辑
- `frontend/src/pages/inventory/InventoryDetailPage.tsx` -- 结果展示
- `frontend/src/components/inventory/DifferenceSummaryPanel.tsx` -- 调账预览

**复杂度**: 中高

---

#### Task 1.4: 工单附件支持

**问题**: 前端类型定义 `attachments?: string[]` 但后端完全缺失。

**改造方案**:

- 后端:
  - `work_order` 表增加 `attachments TEXT`（JSON 数组存储文件路径）或通过 `sys_attachment` 表关联
  - `WorkOrder` 实体增加 attachments 字段或关联查询
  - `WorkOrderService.createWorkOrder()` / `updateWorkOrder()` 处理附件保存
- 前端:
  - `WorkOrderFormPage.tsx` 增加文件上传组件（拖拽+选择，限制文件类型/大小）
  - `WorkOrderDetailPage.tsx` 增加附件列表展示和下载

**涉及文件**:
- `backend/src/main/java/com/ams/entity/WorkOrder.java`
- `backend/src/main/java/com/ams/service/WorkOrderService.java`
- `frontend/src/pages/workorder/WorkOrderFormPage.tsx`
- `frontend/src/pages/workorder/WorkOrderDetailPage.tsx`

**复杂度**: 低中

---

#### Task 1.5: 激活已有未注册路由

**问题**: 4 个 Mobile 页面和 VendorPortal 页面已完整开发但未注册到 Router。

**改造方案**:

- 前端:
  - `router/index.tsx` 增加移动端路由组:
    ```
    /m              -> MobileLayout -> MobileDashboardPage
    /m/assets       -> MobileLayout -> MobileAssetListPage
    /m/scan         -> MobileLayout -> MobileScanPage
    /m/profile      -> MobileLayout -> MobileProfilePage（待创建或复用）
    ```
  - `router/index.tsx` 增加供应商门户路由:
    ```
    /vendor-portal  -> VendorPortalPage（独立 layout，不带侧边栏）
    ```
  - 增加 UA 检测：移动端浏览器自动重定向到 `/m`
  - 配置 PWA manifest（`public/manifest.json`），支持添加到主屏幕

**涉及文件**:
- `frontend/src/router/index.tsx` -- 增加路由定义
- 新建: `frontend/public/manifest.json`

**复杂度**: 低

---

### Phase 2: 资产流转闭环（核心业务补全）

**目标**: 打通"采购入库 -> 领用签收 -> 调拨转移 -> 借用归还 -> 报废处置"完整链路。

#### Task 2.1: 资产入库验收模块

**需求**: 采购订单收货后，进入入库验收流程（质检 -> 验收结论 -> 签字 -> 自动创建资产卡片）。

**后端新建**:
- 实体: `IntakeOrder`（`intake_order` 表）
  - 字段: `id`, `intakeNo`(自动生成), `purchaseOrderId`(关联采购单), `tenantId`, `status`(PENDING/INSPECTING/ACCEPTED/REJECTED), `inspectorId`, `inspectorName`, `inspectDate`, `conclusion`(PASS/CONDITIONAL_PASS/FAIL), `conclusionNote`, `signerId`, `signerName`, `signDate`, `createTime`, `updateTime`
- 实体: `IntakeCheckItem`（`intake_check_item` 表）
  - 字段: `id`, `intakeOrderId`, `itemName`, `checkResult`(PASS/FAIL/NA), `note`, `sortOrder`
- 实体: `IntakeAsset`（`intake_asset` 表）-- 验收通过后自动创建的资产记录
  - 字段: `id`, `intakeOrderId`, `assetName`, `categoryId`, `model`, `brand`, `serialNo`, `originalValue`, `quantity`, `status`(待生成/已生成), `generatedAssetId`
- Controller: `IntakeOrderController`（`/intake-orders`）
  - `GET /` -- 分页列表
  - `GET /{id}` -- 详情
  - `POST /` -- 创建（关联采购订单）
  - `POST /{id}/inspect` -- 提交质检结果
  - `POST /{id}/accept` -- 确认验收（自动创建 Asset 记录）
  - `POST /{id}/reject` -- 驳回
- Service: `IntakeOrderService`
  - `acceptIntake()`: 事务内遍历 IntakeAsset 列表，逐个创建 Asset 记录，更新 AssetCategory 计数，生成 AssetChangeLog，更新 PurchaseOrder 状态

**前端新建**:
- `pages/intake/IntakeListPage.tsx` -- 入库验收列表（状态筛选、KPI 统计）
- `pages/intake/IntakeFormPage.tsx` -- 创建验收单（关联采购订单、选择质检项）
- `pages/intake/IntakeDetailPage.tsx` -- 验收详情（质检项勾选、结论填写、资产预览、签字确认）
- `api/intake.ts` -- API 封装
- `types/intake.ts` -- 类型定义

**路由**: `/intake`, `/intake/new`, `/intake/:id`

**复杂度**: 高

---

#### Task 2.2: 资产领用/归还模块

**需求**: 用户申请领用资产 -> 审批 -> 签收确认 -> 使用中 -> 归还申请 -> 归还验收。

**后端新建**:
- 实体: `AssetAssignment`（`asset_assignment` 表）
  - 字段: `id`, `assignmentNo`, `tenantId`, `assetId`, `assigneeId`, `assigneeName`, `assigneeDeptId`, `assignmentType`(CHECKOUT/TRANSFER), `status`(PENDING/APPROVED/CHECKED_OUT/RETURN_PENDING/RETURNED/REJECTED), `approvedById`, `approvedByName`, `approveDate`, `checkoutDate`, `expectedReturnDate`, `actualReturnDate`, `returnCondition`(GOOD/DAMAGED/LOST), `returnNote`, `createTime`, `updateTime`
- Controller: `AssetAssignmentController`（`/assignments`）
  - `GET /` -- 分页列表（支持按状态/人员/部门筛选）
  - `GET /{id}` -- 详情
  - `POST /` -- 创建领用申请
  - `POST /batch` -- 批量领用
  - `POST /{id}/approve` -- 审批通过
  - `POST /{id}/reject` -- 审批驳回
  - `POST /{id}/checkout` -- 签收确认（更新 Asset.status = IN_USE, Asset.userId = assigneeId）
  - `POST /{id}/return-request` -- 发起归还
  - `POST /{id}/return-confirm` -- 归还验收（更新 Asset.status = IDLE, Asset.userId = null）
- Service: `AssetAssignmentService` -- 与审批流程联动

**前端新建**:
- `pages/assignment/AssignmentListPage.tsx` -- 领用管理列表（Tab: 待审批/已领出/已归还/全部）
- `pages/assignment/AssignmentFormPage.tsx` -- 领用申请表单（资产选择器 + 审批流选择）
- `pages/assignment/AssignmentDetailPage.tsx` -- 详情（含签收扫码、归还验收）
- `api/assignment.ts`
- `types/assignment.ts`

**路由**: `/assignments`, `/assignments/new`, `/assignments/:id`

**复杂度**: 高

---

#### Task 2.3: 资产借用管理

**需求**: 外部人员/部门借用资产 -> 审批 -> 借出登记 -> 到期提醒 -> 归还验收 -> 逾期告警。

**后端新建**:
- 实体: `AssetBorrow`（`asset_borrow` 表）
  - 字段: `id`, `borrowNo`, `tenantId`, `assetId`, `borrowerName`, `borrowerPhone`, `borrowerCompany`, `borrowerDeptId`, `purpose`, `status`(PENDING/APPROVED/BORROWED/OVERDUE/RETURNED/REJECTED), `borrowDate`, `expectedReturnDate`, `actualReturnDate`, `reminderSentCount`, `condition`(GOOD/DAMAGED/LOST), `deposit`(押金), `createTime`, `updateTime`
- Controller: `AssetBorrowController`（`/borrows`）
- Service: `AssetBorrowService`
  - `@Scheduled` 定时任务：每日扫描即将到期（3天内）和已逾期的借用记录，发送提醒/告警通知

**前端新建**:
- `pages/borrow/BorrowListPage.tsx` -- 借用管理列表（Tab: 待审批/借出中/已逾期/已归还）
- `pages/borrow/BorrowFormPage.tsx` -- 借用申请表单
- `pages/borrow/BorrowDetailPage.tsx` -- 借用详情（含归还操作、续借操作）

**路由**: `/borrows`, `/borrows/new`, `/borrows/:id`

**复杂度**: 中

---

#### Task 2.4: 资产主附属关系

**需求**: 支持设备 BOM 树（如：服务器 -> 硬盘/内存/网卡），配件关联。

**后端改造**:
- `asset` 表增加 `parent_asset_id BIGINT NULL`（Flyway migration）
- `Asset` 实体增加 `parentAssetId` 字段
- `AssetController` 增加:
  - `GET /assets/{id}/children` -- 获取子资产列表
  - `GET /assets/{id}/tree` -- 获取资产 BOM 树
  - `PUT /assets/{id}/parent` -- 设置父资产关系
- `AssetService` 增加树形查询和循环引用校验

**前端改造**:
- `AssetDetailPage.tsx` 增加 "关联资产" Tab：
  - 树形展示子资产
  - 添加子资产（选择器）
  - 解除关联操作
  - 面包屑导航显示父资产链路

**复杂度**: 中

---

#### Task 2.5: 资产图片/附件库

**需求**: 资产支持多图上传、排序、标注，附件版本管理。

**后端改造**:
- 激活 `SysAttachment` 实体与资产的关联:
  - `FileController` 增加 `POST /files/upload-asset-attachment` 端点
  - 返回: `{ fileId, fileName, filePath, fileSize, fileType, thumbnailUrl }`
- 新建 `AssetAttachmentService`:
  - 支持上传、排序、删除、标注（标注内容存 `remark` 字段）
  - 限制: 单资产最多 20 张图片 + 10 个附件，单文件最大 10MB

**前端改造**:
- `AssetFormPage.tsx` 增加图片上传区（拖拽 + 预览 + 排序）
- `AssetDetailPage.tsx` 增加图片画廊（Lightbox 效果）和附件列表
- 新建 `components/asset/AssetGallery.tsx` -- 图片画廊组件
- 新建 `components/asset/AttachmentList.tsx` -- 附件列表组件

**复杂度**: 中

---

### Phase 3: 维修管理深化

**目标**: 从"记录维修"升级到"管理维修全过程"，达到 Fiix/UpKeep 级别。

#### Task 3.1: 维修执行跟踪

**需求**: 工单执行阶段增加工时登记、进度、步骤 Checklist、现场照片。

**后端新建**:
- 实体: `WorkOrderTimeLog`（`work_order_time_log` 表）
  - 字段: `id`, `workOrderId`, `userId`, `userName`, `startTime`, `endTime`, `durationMinutes`, `description`, `createTime`
- 实体: `WorkOrderStep`（`work_order_step` 表）
  - 字段: `id`, `workOrderId`, `stepName`, `stepOrder`, `isCompleted`, `completedBy`, `completedAt`, `note`
- Controller 端点:
  - `POST /workorders/{id}/time-logs` -- 登记工时
  - `GET /workorders/{id}/time-logs` -- 查询工时记录
  - `POST /workorders/{id}/steps` -- 创建步骤 Checklist
  - `PUT /workorders/{id}/steps/{stepId}/complete` -- 完成步骤
  - `GET /workorders/{id}/progress` -- 计算进度百分比（已完成步骤/总步骤）

**前端改造**:
- `WorkOrderDetailPage.tsx` 增加 "执行跟踪" Tab:
  - 工时登记表单 + 工时列表
  - 步骤 Checklist（可勾选完成）
  - 进度条
  - 现场照片上传区

**复杂度**: 中高

---

#### Task 3.2: 维修验收流程

**需求**: 工单完成后增加独立验收环节。

**后端改造**:
- `OrderStatus` 枚举增加 `PENDING_ACCEPTANCE`（待验收）和 `ACCEPTANCE_REJECTED`（验收不合格）
- 状态机增加: `COMPLETED -> PENDING_ACCEPTANCE -> ACCEPTED` / `COMPLETED -> PENDING_ACCEPTANCE -> ACCEPTANCE_REJECTED -> EXECUTING`（返工）
- `WorkOrderService` 增加:
  - `submitForAcceptance(workOrderId)` -- 提交验收
  - `acceptWorkOrder(workOrderId, verifierId, checklist)` -- 验收通过
  - `rejectAcceptance(workOrderId, reason)` -- 验收不合格，返回 EXECUTING

**前端新建**:
- `pages/workorder/WorkOrderAcceptancePage.tsx` -- 维修验收页面
  - 验收 Checklist 勾选
  - 验收结论（合格/不合格/有条件通过）
  - 不合格自动创建返工工单

**路由**: `/workorders/:id/acceptance`

**复杂度**: 中

---

#### Task 3.3: 维修挂起/恢复

**需求**: 工单执行中可挂起（等待配件/等待外部支持），设置挂起时限。

**后端改造**:
- `OrderStatus` 枚举增加 `ON_HOLD`
- 实体: `WorkOrderHoldRecord`（`work_order_hold_record` 表）
  - 字段: `id`, `workOrderId`, `holdReason`, `holdBy`, `holdAt`, `expectedResumeAt`, `actualResumeAt`, `resumeNote`
- `WorkOrderService` 增加:
  - `holdWorkOrder(id, reason, expectedResumeAt)` -- 挂起
  - `resumeWorkOrder(id, note)` -- 恢复
- `@Scheduled` 定时任务: 扫描 `expectedResumeAt` 已过的挂起工单，发送提醒

**前端改造**:
- `WorkOrderDetailPage.tsx` 增加"挂起"按钮和挂起对话框
- `WorkOrderListPage.tsx` 增加"挂起中"状态筛选 Tab

**复杂度**: 低

---

#### Task 3.4: 故障代码体系

**需求**: 三级故障编码（故障现象 -> 故障原因 -> 解决措施），按设备类型配置。

**后端新建**:
- 实体: `FaultCode`（`fault_code` 表）
  - 字段: `id`, `code`(如 F001-001-001), `faultPhenomenon`, `faultCause`, `solution`, `parentId`, `level`(1/2/3), `categoryIds`(适用设备类型), `tenantId`, `status`, `sortOrder`
- Controller: `FaultCodeController`（`/fault-codes`）-- CRUD + 树形查询
- `WorkOrder` 实体增加 `faultCodeId` 字段，`WorkOrderService.completeWorkOrder()` 要求必填故障代码

**前端新建**:
- `pages/fault-code/FaultCodePage.tsx` -- 故障代码管理页（树形 + CRUD）
- `WorkOrderFormPage.tsx` / `WorkOrderDetailPage.tsx` 增加故障代码选择器（级联下拉）

**复杂度**: 中

---

#### Task 3.5: MTBF/MTTR 可靠性分析

**需求**: 基于维修记录自动计算 MTBF、MTTR、故障率、可用性。

**后端新建**:
- Service: `ReliabilityAnalyticsService`
  - `calculateMTBF(assetId, period)` -- 平均故障间隔 = 总运行时间 / 故障次数
  - `calculateMTTR(assetId, period)` -- 平均修复时间 = 总维修时间 / 维修次数
  - `calculateAvailability(assetId, period)` -- 可用性 = 运行时间 / (运行时间 + 维修时间)
  - `getReliabilityTrend(assetId, months)` -- 按月趋势
  - `getReliabilityRanking(category, topN)` -- 按类别排名
- Controller: `ReliabilityController`（`/reliability`）
  - `GET /overview` -- 总览
  - `GET /asset/{id}` -- 单资产可靠性
  - `GET /trend` -- 趋势
  - `GET /ranking` -- 排名

**前端新建**:
- `pages/analytics/reliability/ReliabilityPage.tsx` -- 可靠性分析仪表板
  - KPI 卡片: MTBF、MTTR、可用性、故障率
  - 趋势折线图
  - Top 10 故障设备排名
  - 按部门/类别的对比柱状图

**路由**: `/analytics/reliability`

**复杂度**: 中

---

#### Task 3.6: 备品备件管理

**需求**: 备件台账、安全库存告警、工单领用自动扣减、采购建议。

**后端新建**:
- 实体: `SparePart`（`spare_part` 表）
  - 字段: `id`, `partNo`, `partName`, `specification`, `categoryId`, `currentStock`, `safetyStock`, `unit`, `unitPrice`, `locationId`(存放位置), `vendorId`, `status`, `tenantId`
- 实体: `SparePartUsage`（`spare_part_usage` 表）
  - 字段: `id`, `sparePartId`, `workOrderId`, `quantity`, `usageDate`, `userId`, `note`
- Controller: `SparePartController`（`/spare-parts`）-- CRUD + 库存查询 + 领用记录
- Service: `SparePartService`
  - `consumePart(partId, workOrderId, quantity)` -- 领用扣减，库存低于安全库存时告警
  - `getLowStockAlerts()` -- 低库存告警
  - `getPurchaseSuggestions()` -- 基于消耗率生成采购建议

**前端新建**:
- `pages/spare-part/SparePartListPage.tsx` -- 备件管理列表（库存预警标记）
- `pages/spare-part/SparePartDetailPage.tsx` -- 备件详情（库存变动历史、关联工单）
- `WorkOrderDetailPage.tsx` "执行跟踪" Tab 增加"领用备件"操作

**路由**: `/spare-parts`, `/spare-parts/:id`

**复杂度**: 高

---

### Phase 4: 财务管理增强

**目标**: 补齐财务维度，让 CFO/财务部门能从系统获取决策数据。

#### Task 4.1: 全生命周期成本 (TCO) 视图

**后端新建**:
- Service: `TcoService`
  - `calculateTco(assetId)` -- 聚合: `purchaseCost` + `sum(maintenanceCost)` + `sum(workOrderActualCost)` + `sum(energyCost)` + `sum(insurancePremium)` - `currentValue`(残值)
  - `getTcoByDepartment(deptId)` -- 按部门汇总
  - `getTcoByCategory(categoryId)` -- 按类别汇总
  - `getTcoTrend(assetId, months)` -- 按月累计趋势
- Controller: `TcoController`（`/tco`）

**前端新建**:
- `AssetDetailPage.tsx` 增加 "TCO" Tab:
  - 成本构成饼图（采购/维修/保养/能耗/保险）
  - 累计成本趋势折线图
  - 与同类资产对比
- `pages/analytics/tco/TcoPage.tsx` -- TCO 分析总览页

**复杂度**: 中

---

#### Task 4.2: 资产预算管理

**后端新建**:
- 实体: `Budget`（`budget` 表）
  - 字段: `id`, `budgetYear`, `tenantId`, `deptId`, `categoryId`(可选), `budgetType`(PURCHASE/MAINTENANCE/OPERATION), `totalAmount`, `usedAmount`, `committedAmount`(已批未付), `status`(DRAFT/APPROVED/CLOSED), `approvedBy`, `createTime`
- Controller: `BudgetController`（`/budgets`）-- CRUD + 执行率查询
- Service: `BudgetService`
  - 当创建采购订单/工单时，检查预算余额并自动增加 `committedAmount`/`usedAmount`
  - 超支时发送通知给预算负责人

**前端新建**:
- `pages/budget/BudgetListPage.tsx` -- 预算列表（按年度/部门/类型筛选）
- `pages/budget/BudgetFormPage.tsx` -- 预算编制表单
- `pages/budget/BudgetDetailPage.tsx` -- 预算详情（执行率进度条、支出明细）

**复杂度**: 高

---

#### Task 4.3: 保险管理

**后端新建**:
- 实体: `Insurance`（`insurance` 表）
  - 字段: `id`, `policyNo`, `insuranceName`, `insuranceType`(PROPERTY/LIABILITY/VEHICLE), `assetIds`(JSON 数组), `insurer`, `premium`, `coverage`, `deductible`, `startDate`, `endDate`, `status`, `tenantId`
- 实体: `InsuranceClaim`（`insurance_claim` 表）-- 理赔记录
- Controller: `InsuranceController`（`/insurances`）
- `@Scheduled` 定时任务: 到期前 30/15/7 天提醒

**前端新建**:
- `pages/insurance/InsuranceListPage.tsx` -- 保险管理列表
- `pages/insurance/InsuranceFormPage.tsx` -- 保单登记表单
- `pages/insurance/InsuranceDetailPage.tsx` -- 保单详情 + 理赔记录

**复杂度**: 低

---

#### Task 4.4: 折旧方法扩展

**改造方案**:
- 后端:
  - `DepreciationMethodEnum` 增加 `SYD`(年数总和法) 和 `UOP`(工作量法)
  - `DepreciationService` 增加对应计算公式
  - UOP 需要额外字段: `Asset.totalExpectedUnits`(总预期工作量), `Asset.actualUnits`(实际工作量)
- 前端:
  - `DepreciationListPage.tsx` 增加方法筛选
  - 资产表单增加折旧方法选择（下拉）
  - 折旧对比报表（同一资产不同方法的对比表）

**复杂度**: 中

---

#### Task 4.5: 资产减值/重估

**后端新建**:
- 实体: `AssetRevaluation`（`asset_revaluation` 表）
  - 字段: `id`, `assetId`, `revaluationType`(IMPAIRMENT/REVALUATION), `previousValue`, `newValue`, `reason`, `evidence`(附件), `status`(PENDING/APPROVED/REJECTED), `approvedBy`, `createTime`
- Controller: `AssetRevaluationController`（`/revaluations`）
- Service: 审批通过后自动更新 `Asset.currentValue`

**前端新建**:
- `pages/revaluation/RevaluationListPage.tsx`
- `pages/revaluation/RevaluationFormPage.tsx`

**复杂度**: 中

---

### Phase 5: 盘点深化 + 合规管理

**目标**: 满足企业合规审计和法定检验要求。

#### Task 5.1: 循环盘点 / ABC 分类

**后端新建**:
- 实体: `CycleCountRule`（`cycle_count_rule` 表）
  - 字段: `id`, `classification`(A/B/C), `frequency`(MONTHLY/QUARTERLY/YEARLY), `categoryIds`, `minValue`, `maxValue`, `tenantId`
- Service: `CycleCountService`
  - `@Scheduled` 按规则自动生成 InventoryTask
  - 分类规则: A 类（价值 > 10万或关键设备）月盘，B 类（1-10万）季盘，C 类（< 1万）年盘

**前端新建**:
- `pages/inventory/CycleCountConfigPage.tsx` -- 循环盘点规则配置

**复杂度**: 中

---

#### Task 5.2: 检验/年检管理

**后端新建**:
- 实体: `Inspection`（`inspection` 表）
  - 字段: `id`, `inspectionNo`, `assetId`, `inspectionType`(ANNUAL/PERIODIC/SPECIAL), `inspectionDate`, `nextInspectionDate`, `inspectionAgency`, `inspectorName`, `result`(PASS/FAIL/CONDITIONAL), `certificateNo`, `certificateExpiry`, `reportAttachment`, `cost`, `tenantId`
- Controller: `InspectionController`（`/inspections`）
- `@Scheduled` 定时任务: 到期前 30/15/7 天提醒

**前端新建**:
- `pages/inspection/InspectionListPage.tsx` -- 检验管理列表（到期预警标记）
- `pages/inspection/InspectionFormPage.tsx` -- 检验记录表单
- `pages/inspection/InspectionDetailPage.tsx` -- 检验详情 + 历史

**复杂度**: 中

---

#### Task 5.3: 安全检查表

**后端新建**:
- 实体: `SafetyChecklistTemplate`（`safety_checklist_template` 表）
  - 字段: `id`, `templateName`, `categoryIds`(适用设备类型), `tenantId`, `status`
- 实体: `SafetyChecklistItem`（`safety_checklist_item` 表）
  - 字段: `id`, `templateId`, `itemName`, `itemType`(PASS_FAIL/READING/PHOTO/TEXT), `sortOrder`, `required`
- 实体: `SafetyChecklistExecution`（`safety_checklist_execution` 表）
  - 字段: `id`, `templateId`, `assetId`, `executorId`, `executeDate`, `status`(IN_PROGRESS/COMPLETED), `overallResult`
- 实体: `SafetyChecklistResult`（`safety_checklist_result` 表）
  - 字段: `id`, `executionId`, `itemId`, `result`, `reading`, `photoUrl`, `note`
- Service: 不合规项自动生成整改工单

**前端新建**:
- `pages/safety/SafetyChecklistConfigPage.tsx` -- 检查表模板配置
- `pages/safety/SafetyChecklistExecutePage.tsx` -- 执行检查（逐项填写/拍照）
- `pages/safety/SafetyChecklistHistoryPage.tsx` -- 检查历史

**复杂度**: 中高

---

#### Task 5.4: 风险评估矩阵

**后端新建**:
- 实体: `RiskAssessment`（`risk_assessment` 表）
  - 字段: `id`, `assetId`, `probability`(1-5), `impact`(1-5), `riskLevel`(自动计算: LOW/MEDIUM/HIGH/CRITICAL), `mitigationMeasures`, `reviewDate`, `assessorId`, `tenantId`
- Controller: `RiskAssessmentController`（`/risk-assessments`）
- Service: 风险热力图数据聚合（按部门/位置/类别）

**前端新建**:
- `pages/risk/RiskMatrixPage.tsx` -- 5x5 风险矩阵 + 热力图
- `pages/risk/RiskAssessmentFormPage.tsx` -- 风险评估表单

**复杂度**: 中

---

### Phase 6: 用户体验与平台能力

**目标**: 提升系统易用性、可扩展性和开放度。

#### Task 6.1: 工单评论/协作系统

**后端新建**:
- 实体: `BusinessComment`（`business_comment` 表）
  - 字段: `id`, `businessType`(ASSET/WORK_ORDER/RETIREMENT/INSPECTION), `businessId`, `userId`, `userName`, `content`(支持 @mention 标记), `parentCommentId`(回复), `createTime`, `updateTime`
- Controller: `BusinessCommentController`（`/comments`）
- Service: 解析 content 中的 `@username` 标记，触发通知

**前端新建**:
- `components/comment/CommentSection.tsx` -- 通用评论组件
- `components/comment/MentionInput.tsx` -- @mention 输入框
- 集成到: `WorkOrderDetailPage`, `AssetDetailPage`, `RetirementDetailPage`

**复杂度**: 中

---

#### Task 6.2: 资产完整履历时间线

**后端新建**:
- Service: `AssetHistoryService`
  - `getFullHistory(assetId)` -- 聚合以下来源的事件:
    - `asset_change_log` -- 状态变更
    - `work_order` -- 维修工单
    - `maintenance_record` -- 保养记录
    - `asset_assignment` -- 领用/归还
    - `asset_borrow` -- 借用记录
    - `inspection` -- 检验记录
    - `retirement_application` -- 报废申请
    - `inventory_detail` -- 盘点记录
    - `intake_order` -- 入库验收
  - 返回统一的 `AssetHistoryEvent[]`，每条包含: `eventType`, `eventTime`, `title`, `description`, `operatorName`, `refId`, `refType`

**前端改造**:
- `AssetDetailPage.tsx` 增加 "完整履历" Tab -- 时间线视图，按时间倒序
- 支持按事件类型筛选（维修/保养/领用/检验/...）
- 每条事件可点击跳转到对应详情页

**复杂度**: 中

---

#### Task 6.3: 资产健康评分

**后端新建**:
- Service: `AssetHealthService`
  - 评分维度（权重可配）:
    - 年龄评分 (20%): 基于 purchaseDate 和 warrantyPeriod
    - 维修频率 (25%): 近 12 个月维修次数
    - 故障率 (20%): 近 12 个月故障次数 / 运行天数
    - 利用率 (20%): 基于 utilization_snapshot
    - 折旧进度 (15%): currentValue / originalValue
  - 输出: 0-100 分，映射到 HEALTHY(>80)/WARNING(50-80)/CRITICAL(<50)
- Controller: `AssetHealthController`（`/asset-health`）

**前端新建**:
- `AssetListPage.tsx` 增加健康评分列（红/黄/绿灯）
- `pages/analytics/health/AssetHealthPage.tsx` -- 健康评分仪表板
  - 评分分布图
  - 不健康资产 Top 20
  - 趋势变化

**复杂度**: 中

---

#### Task 6.4: 深色模式

**现状**: `.dark` CSS 变量已在 `theme.css` 中定义完整（约 35 行 oklch 色值），但无切换机制。

**改造方案**:
- 新建 `hooks/useTheme.ts` -- 主题读写 hook
  - 读取 `localStorage.theme-config`
  - `toggleDarkMode()` -- 切换 `<html class="dark">`
  - `prefers-color-scheme` 媒体查询跟随系统
- `layouts/SidebarLayout.tsx` 顶栏增加主题切换按钮（Sun/Moon 图标）
- 确保所有页面组件使用 CSS 变量而非硬编码颜色（需排查 `bg-white`/`bg-gray-50` 等硬编码）

**复杂度**: 中（CSS 变量已就绪，主要工作在排查硬编码颜色）

---

#### Task 6.5: PDF 报表导出

**后端改造**:
- `pom.xml` 增加 `springdoc-openapi`（顺带解决 API 文档需求）和 `itext7` 或 `flying-saucer` 依赖
- 新建 `PdfExportService`:
  - `exportReport(reportData, template)` -- 基于 Thymeleaf HTML 模板渲染 + FlyingSaucer 转 PDF
  - 支持中英文、页眉页脚、表格、图表（图表先转图片）
- Controller 端点: `POST /reports/{type}/export-pdf`

**前端改造**:
- 所有报表页面增加"导出 PDF"按钮
- 盘点报告、验收单增加 PDF 下载

**复杂度**: 中

---

#### Task 6.6: 自定义报表构建器

**现状**: `ReportPage.tsx` 的"创建报表"按钮显示"即将上线" toast。

**后端新建**:
- 实体: `SavedReport`（`saved_report` 表）
  - 字段: `id`, `reportName`, `reportType`(ASSET/MAINTENANCE/FINANCIAL/INVENTORY), `configJson`(JSON: 字段选择、分组、排序、过滤条件、图表类型), `isPublic`, `createdBy`, `tenantId`
- Controller: `SavedReportController`（`/saved-reports`）-- CRUD + 执行
- Service: `DynamicReportService` -- 根据 configJson 动态构建查询并返回数据

**前端新建**:
- `pages/report-builder/ReportBuilderPage.tsx` -- 拖拽式报表设计器
  - 左侧: 可用字段列表（按实体分组）
  - 中间: 拖拽配置区（字段选择、分组、排序）
  - 右侧: 预览区（表格/图表实时预览）
  - 底部: 保存/发布/导出操作
- 使用 `react-dnd` 实现拖拽
- 使用 Recharts 渲染图表预览

**复杂度**: 高

---

#### Task 6.7: 定时报表 + 邮件推送

**后端新建**:
- 实体: `ScheduledReport`（`scheduled_report` 表）
  - 字段: `id`, `savedReportId`, `cronExpr`(如 `0 0 8 * * MON`), `recipientEmails`(JSON 数组), `format`(PDF/EXCEL), `status`(ACTIVE/PAUSED), `lastRunAt`, `nextRunAt`, `tenantId`
- Service: `ScheduledReportService` + `@Scheduled` 扫描执行
- 执行流程: 读取 SavedReport -> 执行查询 -> 生成 PDF/Excel -> 发送邮件

**前端新建**:
- `pages/report/ScheduledReportConfigPage.tsx` -- 定时报表配置页面

**复杂度**: 中

---

#### Task 6.8: API 文档门户

**改造方案**:
- `pom.xml` 增加 `springdoc-openapi-starter-webmvc-ui`
- `application.yml` 配置:
  ```yaml
  springdoc:
    api-docs:
      path: /api-docs
    swagger-ui:
      path: /swagger-ui.html
  ```
- `SecurityConfig.java` 增加 `/api-docs/**`, `/swagger-ui/**` 白名单
- 为所有 Controller 添加 `@Operation`/`@Tag` 注解（可渐进式补充）

**复杂度**: 低（基础配置低，注解可渐进补充）

---

## 三、优先级排序与依赖关系

```
Phase 1 (修复缺陷) ──────> Phase 2 (资产流转) ──────> Phase 3 (维修深化)
       │                          │                          │
       │                          v                          v
       │                   Phase 4 (财务增强)         Phase 5 (合规管理)
       │                          │                          │
       v                          v                          v
Phase 6 (平台能力) ────── 贯穿所有阶段，按需穿插 ──────────────────
```

| 优先级 | Phase | 推荐起始 | 核心理由 |
|--------|-------|---------|---------|
| **P0** | Phase 1 修复缺陷 | 立即 | 现有功能存在断裂（SLA 不持久化、盘点无调账、状态机不一致），影响用户信任 |
| **P0** | Phase 1.5 激活路由 | 立即 | Mobile/VendorPortal 代码已完成，注册路由即可用，成本极低 |
| **P1** | Phase 2 资产流转 | Phase 1 完成后 | 入库验收->领用->借用 是日常高频操作，缺失则系统无法投产 |
| **P1** | Phase 3 维修深化 | 与 Phase 2 并行 | 维修执行跟踪+备品备件是 EAM 第二大核心场景 |
| **P2** | Phase 4 财务增强 | Phase 2 完成后 | TCO/预算/保险影响采购决策，但可等基础流程跑通后深化 |
| **P2** | Phase 5 合规管理 | 与 Phase 4 并行 | 年检/安全检查是合规刚需，但部分依赖 Phase 2 的资产数据基础 |
| **P3** | Phase 6 平台能力 | 贯穿全程 | 评论/时间线/健康评分/深色模式/PDF 等可按需穿插 |

---

## 四、技术债务（附带修复建议）

| 债务项 | 描述 | 建议 |
|--------|------|------|
| `src/app/` 遗留目录 | ~200+ 文件是旧版实现，与 `src/pages/` 并存 | 确认无引用后删除，减少维护混淆 |
| 两套设计系统并存 | 部分页面用 antd（licenses/manufacturers/asset-models/SAM），其余用自定义 Tailwind | 逐步迁移 antd 页面到自定义组件 |
| `retirementApi.ts` 与 `retirement.ts` 重复 | 两个 API 文件指向同一后端 | 合并为一个 |
| `ReportPage.tsx` 与 `ReportsPage.tsx` 重复 | 两个报表页面，前者功能为 placeholder | 保留 `ReportsPage.tsx`，删除 `ReportPage.tsx` |
| `WorkOrderStateMachine` 未集成 | 定义了双级审批状态但 Service 未使用 | Phase 1.2 统一 |

---

## 五、不在本计划范围内

以下功能属于架构级或外部依赖，建议单独规划:

- IoT 传感器接入（需要 MQTT broker 基础设施）
- 预测性维护（需要足够的历史数据积累 + ML 模型）
- ERP/财务系统对接（需要外部系统 API）
- 移动端原生 App（当前 H5/PWA 足够）
- 国际化 i18n（工作量大但技术难度低，可独立排期）
