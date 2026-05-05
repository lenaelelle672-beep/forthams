# SWARM-502 资产报废/退役流程 - 规格指导文档

**版本**: 1.0  
**任务标识**: SWARM-502  
**功能名称**: 资产报废/退役流程  
**所属迭代**: Iteration 1  
**文档状态**: 规格评审中  
**生成日期**: 2025-01-26

---

## 1. 需求与背景

### 1.1 业务背景

资产全生命周期管理中，退役/报废是关键的终结阶段。当前系统缺乏标准化的资产退役申请与审批流程，导致以下问题：

| 问题类型 | 具体表现 | 业务影响 |
|---------|---------|---------|
| 流程缺失 | 资产退役缺乏统一入口，状态管理混乱 | 资产状态不准确 |
| 审批不透明 | 审批链路不透明，无法追溯决策过程 | 责任难以界定 |
| 记录分散 | 退役记录分散，难以形成完整的资产台账 | 历史数据难以查询 |

### 1.2 功能目标

本次迭代 (Phase 1) 需实现以下核心能力：

| 功能模块 | 描述 | 类型 | 优先级 |
|---------|------|------|--------|
| RetirementRequest Entity | 资产退役申请数据模型定义 | 后端 | P0 |
| 退役申请提交页面 | 用户提交资产退役申请 | 前端 | P0 |
| 基础审批链路 | 单级审批流程配置与执行 | 全栈 | P0 |
| 审批历史记录 | 完整审批流程追溯 | 全栈 | P1 |

### 1.3 关键业务规则

```
┌─────────────────────────────────────────────────────────────────┐
│                        业务规则约束                              │
├─────────────────────────────────────────────────────────────────┤
│  R-001: 申请主体      已入账且在用的资产方可发起退役申请          │
│  R-002: 状态约束      退役中资产不可再次发起新申请                │
│  R-003: 审批权限      审批人必须是 ROLE_APPROVER 角色            │
│  R-004: 不可逆性      已审批通过的退役申请不可撤销               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 1 范围定义

```
Phase 1: 基础退役流程搭建 (v1.0)
│
├── 后端基础能力
│   ├── RetirementRequest Entity 定义
│   ├── RetirementStatus 枚举 (PENDING/APPROVED/REJECTED)
│   ├── RetirementRequestRepository
│   ├── RetirementRequestService (CRUD + 状态流转)
│   └── RetirementController (REST API)
│
├── 前端基础页面
│   ├── 退役申请表单页 (/asset/retirement/apply)
│   ├── 退役申请列表页 (/asset/retirement/list)
│   └── 审批处理页 (/asset/retirement/approve)
│
├── 审批链路 (单级审批)
│   ├── 审批配置表 (ApprovalConfig)
│   └── 审批节点执行器
│
└── 历史记录
    ├── 审批历史查询 API
    └── 审批时间线组件
```

### 2.2 Phase 1 完成标准

| 序号 | 完成标准 | 验证方式 | 状态 |
|-----|---------|---------|------|
| 1 | 后端 API 覆盖全部退役流程接口 | 集成测试 | ⬜ 待验证 |
| 2 | 前端页面完成 UI 渲染与交互 | E2E 测试 | ⬜ 待验证 |
| 3 | 单级审批链路可正常流转 | 手动验收 | ⬜ 待验证 |
| 4 | 审批历史可追溯查询 | API 验证 | ⬜ 待验证 |
| 5 | 单元测试覆盖率 ≥ 80% | 覆盖率报告 | ⬜ 待验证 |

---

## 3. 边界约束

### 3.1 技术边界

| 约束项 | 具体要求 | 备注 |
|-------|---------|------|
| 后端技术栈 | Spring Boot 3.x / Python FastAPI | 依据现有架构 |
| 前端技术栈 | Vue 3 + TypeScript | 统一前端框架 |
| 数据库 | MySQL 8.0+ | 继承现有数据源 |
| 认证方式 | JWT Token | 继承现有体系 |
| API 风格 | RESTful | 统一接口规范 |
| 文件上传 | 不在本次范围 | 预留扩展点 |

### 3.2 功能边界

| 分类 | 包含功能 | 不包含功能 |
|------|---------|----------|
| 申请范围 | ✅ 单资产退役申请 | ❌ 批量退役 |
| 审批范围 | ✅ 单级审批流程 | ❌ 多级审批链 |
| 追踪范围 | ✅ 审批历史查询 | ❌ 财务凭证对接 |
| 附件范围 | ❌ 附件上传 | 暂不支持 |

### 3.3 数据边界

| 约束类型 | 限制值 | 超限处理 |
|---------|-------|---------|
| 单次申请资产数 | 1 | 提示"仅支持单资产申请" |
| 申请描述最大长度 | 500 字符 | 前端截断 + 提示 |
| 审批历史保留策略 | 永久 | 不可删除 |
| 附件支持 | 暂不支持 | N/A |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端单元测试

#### 4.1.1 Entity 层测试

```java
// RetirementRequestEntityTest.java
@DisplayName("RetirementRequest Entity 字段验证")
@Test
void testEntityFields() {
    // GIVEN: 构建 RetirementRequest 实体，字段赋值
    // WHEN: 执行 JPA persist
    // THEN: 数据库记录与预期一致，ID 自增
    assertThat(entity.getId()).isNotNull();
    assertThat(entity.getStatus()).isEqualTo(RetirementStatus.PENDING);
}
```

| 测试用例 ID | 测试场景 | 物理期待 | 测试类型 |
|------------|---------|---------|---------|
| UT-ER-001 | 创建退役申请实体 | 状态默认为 PENDING，创建时间自动填充 | 单元测试 |
| UT-ER-002 | 实体字段长度校验 | 描述超 500 字符抛出 ConstraintViolationException | 单元测试 |
| UT-ER-003 | 关联资产查询 | 通过 assetId 可正确关联查询 | 单元测试 |

#### 4.1.2 Service 层测试

```python
# src/services/retirement_service.py - 状态流转测试
def test_status_transition():
    """
    测试退役申请状态流转逻辑
    
    GIVEN: 创建状态为 PENDING 的申请
    WHEN: 调用 approve_application() 方法
    THEN: 状态变更为 APPROVED，审批时间更新
    """
    pass  # 实现测试逻辑
```

| 测试用例 ID | 测试场景 | 物理期待 | 测试类型 |
|------------|---------|---------|---------|
| UT-SV-001 | 提交退役申请 | 返回申请 ID，状态为 PENDING | 单元测试 |
| UT-SV-002 | 审批通过 | 状态 PENDING → APPROVED，审批时间戳更新 | 单元测试 |
| UT-SV-003 | 审批拒绝 | 状态 PENDING → REJECTED，记录拒绝原因 | 单元测试 |
| UT-SV-004 | 非法状态流转 | APPROVED 状态不可再次审批，抛 IllegalStateException | 单元测试 |
| UT-SV-005 | 查询申请列表 | 按用户 ID 返回其所有申请，分页正常 | 单元测试 |
| UT-SV-006 | 查询审批历史 | 返回完整的审批时间线 | 单元测试 |

#### 4.1.3 Controller 层测试

| 测试用例 ID | 测试场景 | HTTP 期待 |
|------------|---------|----------|
| UT-CT-001 | 提交申请 | POST 201 Created |
| UT-CT-002 | 资产已退役再次申请 | POST 409 Conflict |
| UT-CT-003 | 资产不存在 | POST 404 Not Found |
| UT-CT-004 | 审批通过 | POST /approve 200 OK |
| UT-CT-005 | 无权限审批 | POST /approve 403 Forbidden |
| UT-CT-006 | 查询申请列表 | GET 200 OK，分页参数生效 |
| UT-CT-007 | 查询审批历史 | GET 200 OK，历史数据完整 |

### 4.2 前端集成测试 (Playwright)

```typescript
// tests/e2e/retirement_flow.spec.ts
test.describe('资产退役申请流程', () => {
  test('用户可提交退役申请', async ({ page }) => {
    // 物理测试期待: 完整用户操作链路
    // 1. 登录 → 2. 导航到申请页 → 3. 选择资产 → 4. 填写原因 → 5. 提交
    // 预期: 出现成功提示，页面跳转至列表页
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
```

| 测试用例 ID | 测试场景 | Playwright 期待 | 修改文件 |
|------------|---------|-----------------|---------|
| E2E-001 | 提交退役申请 | 填写资产 ID + 原因 → 提交 → 弹窗提示"提交成功" | retirement_flow.spec.ts |
| E2E-002 | 申请列表展示 | 登录后进入列表页 → 显示申请记录，含状态标签 | retirement_flow.spec.ts |
| E2E-003 | 审批操作 | 审批人登录 → 进入审批页 → 点击"通过" → 状态更新 | retirement_flow.spec.ts |
| E2E-004 | 审批历史时间线 | 进入历史页 → 显示审批节点、时间、操作人 | retirement_flow.spec.ts |
| E2E-005 | 无效申请拦截 | 未选择资产 → 提交按钮禁用 | retirement_flow.spec.ts |
| E2E-006 | 重复申请拦截 | 资产已退役 → 申请入口隐藏/禁用 | retirement_flow.spec.ts |

### 4.3 数据库集成测试

| 测试用例 ID | 测试场景 | 物理期待 |
|------------|---------|---------|
| DB-001 | 数据持久化 | retirement_request 表数据正确落库 |
| DB-002 | 关联查询 | 通过 asset_id 可关联查询资产信息 |
| DB-003 | 审批历史记录 | approval_history 表记录完整 |

---

## 5. 开发切入层级序列

### 5.1 开发顺序依赖图

```
[1] 数据库层
    │
    ├─→ [2] Entity 定义
    │       │
    │       └─→ [3] Repository
    │               │
    │               └─→ [4] Service (业务逻辑)
    │                       │
    │                       └─→ [5] Controller (REST API)
    │                               │
    │                               └─→ [6] 前端页面
    │                                       │
    │                                       └─→ [7] E2E 测试联调
```

### 5.2 详细实施步骤

#### Phase 1 - Step 1: 数据库层

| 序号 | 任务 | 交付物 | 时长 | 状态 |
|-----|------|-------|------|------|
| 1.1 | 设计 retirement_request 表结构 | DDL 脚本 | 0.5d | ⬜ 待实施 |
| 1.2 | 设计 approval_history 表结构 | DDL 脚本 | 0.5d | ⬜ 待实施 |

**DDL 示例**:

```sql
CREATE TABLE retirement_request (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id BIGINT NOT NULL,
    applicant_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reason VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_asset_id (asset_id),
    INDEX idx_applicant_id (applicant_id),
    INDEX idx_status (status),
    FOREIGN KEY (asset_id) REFERENCES asset(id)
);

CREATE TABLE approval_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    request_id BIGINT NOT NULL,
    approver_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL,
    comment VARCHAR(500),
    acted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES retirement_request(id)
);
```

#### Phase 1 - Step 2: Entity 定义

| 序号 | 任务 | 交付物 | 状态 |
|-----|------|-------|------|
| 2.1 | 定义 RetirementRequest Entity | `RetirementRequest.java` / `models/asset_retirement.py` | ⬜ 待实施 |
| 2.2 | 定义 RetirementStatus 枚举 | `RetirementStatus.java` / `models/enums.py` | ⬜ 待实施 |
| 2.3 | 定义 ApprovalHistory Entity | `ApprovalHistory.java` / `models/retirement_history.py` | ⬜ 待实施 |

#### Phase 1 - Step 3: Repository

| 序号 | 任务 | 交付物 | 状态 |
|-----|------|-------|------|
| 3.1 | 定义 RetirementRequestRepository | `RetirementRequestRepository.java` / `repositories/retirement_repository.py` | ⬜ 待实施 |

#### Phase 1 - Step 4: Service

| 序号 | 任务 | 交付物 | 关键方法 | 状态 |
|-----|------|-------|---------|------|
| 4.1 | 实现 RetirementRequestService | `RetirementRequestService.java` / `services/retirement_service.py` | `submit()`, `approve()`, `reject()`, `list()` | ⬜ 待实施 |
| 4.2 | 实现 ApprovalHistoryService | `ApprovalHistoryService.java` / `services/status_history_service.py` | `record()`, `get_history()` | ⬜ 待实施 |

#### Phase 1 - Step 5: Controller / Router

| 序号 | 任务 | 交付物 | API 端点 | 状态 |
|-----|------|-------|---------|------|
| 5.1 | 实现 RetirementController | `RetirementController.java` / `api/routers/retirement_router.py` | POST `/api/v1/retirements` | ⬜ 待实施 |
| 5.2 | 实现 ApprovalController | `ApprovalController.java` | POST `/api/v1/retirements/{id}/approve` | ⬜ 待实施 |

#### Phase 1 - Step 6: 前端页面

| 序号 | 任务 | 交付物 | 路由 | 状态 |
|-----|------|-------|------|------|
| 6.1 | 退役申请表单页 | `RetirementApply.vue` | `/asset/retirement/apply` | ⬜ 待实施 |
| 6.2 | 退役申请列表页 | `RetirementList.vue` | `/asset/retirement/list` | ⬜ 待实施 |
| 6.3 | 审批处理页 | `RetirementApprove.vue` | `/asset/retirement/approve/:id` | ⬜ 待实施 |
| 6.4 | 审批历史时间线 | `ApprovalTimeline.vue` | 组件复用 | ⬜ 待实施 |
| 6.5 | 状态管理 | `retirementStore.ts` | Pinia Store | ⬜ 待实施 |

#### Phase 1 - Step 7: E2E 测试联调

| 序号 | 任务 | 交付物 | 状态 |
|-----|------|-------|------|
| 7.1 | 后端接口联调 | Postman/Newman 脚本 | ⬜ 待实施 |
| 7.2 | 前端 E2E 测试 | Playwright 测试用例 | ⬜ 待实施 |
| 7.3 | 缺陷修复与回归 | 测试报告 | ⬜ 待实施 |

---

## 6. API 接口清单

### 6.1 REST API 定义

| 方法 | 端点 | 描述 | 请求体 | 响应状态 |
|------|------|------|--------|---------|
| POST | `/api/v1/retirements` | 提交退役申请 | `RetirementApplicationDTO` | 201 Created |
| GET | `/api/v1/retirements` | 查询申请列表 | Query: `page`, `size`, `status` | 200 OK |
| GET | `/api/v1/retirements/{id}` | 查询申请详情 | Path: `id` | 200 OK |
| POST | `/api/v1/retirements/{id}/approve` | 审批通过 | `ApprovalActionDTO` | 200 OK |
| POST | `/api/v1/retirements/{id}/reject` | 审批拒绝 | `ApprovalActionDTO` | 200 OK |
| GET | `/api/v1/retirements/{id}/history` | 查询审批历史 | Path: `id` | 200 OK |

### 6.2 请求/响应模型

```typescript
// frontend/src/types/retirement.types.ts

interface RetirementApplication {
  id: string;
  assetId: string;
  applicantId: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}

interface ApprovalHistory {
  id: string;
  requestId: string;
  approverId: string;
  approverName: string;
  action: 'APPROVE' | 'REJECT';
  comment?: string;
  actedAt: Date;
}
```

---

## 7. 状态机定义

### 7.1 退役申请状态流转

```
    ┌──────────────────────────────────────────────┐
    │                                              │
    │    ┌─────────┐                              │
    │    │ PENDING │                              │
    │    └────┬────┘                              │
    │         │                                   │
    │    ┌────┴────┐                              │
    │    │         │                              │
    │    ▼         ▼                              │
    │ ┌──────┐  ┌────────┐                        │
    │ │APPR- │  │REJECTED│                        │
    │ │OVED  │  └────────┘                        │
    │ └──────┘                                    │
    │                                              │
    └──────────────────────────────────────────────┘
```

### 7.2 状态常量定义

| 状态值 | 含义 | 可执行操作 |
|-------|------|-----------|
| PENDING | 待审批 | APPROVE, REJECT |
| APPROVED | 已通过 | (终态) |
| REJECTED | 已拒绝 | (终态) |

---

## 8. 角色权限矩阵

| 角色 | 提交申请 | 审批 | 查看历史 |
|------|:--------:|:----:|:--------:|
| USER | ✅ | ❌ | ✅ (本人) |
| APPROVER | ❌ | ✅ | ✅ (全部) |
| ADMIN | ✅ | ✅ | ✅ (全部) |

---

## 9. 交付物清单

| 序号 | 文件路径 | 描述 | 类型 | 状态 |
|-----|---------|------|------|------|
| 1 | `backend/src/main/java/com/ams/entity/RetirementRequest.java` | 退役申请实体 | 后端 | ⬜ |
| 2 | `backend/src/main/java/com/ams/service/RetirementService.java` | 退役服务 | 后端 | ⬜ |
| 3 | `backend/src/main/java/com/ams/controller/RetirementController.java` | 退役控制器 | 后端 | ⬜ |
| 4 | `src/services/retirement_service.py` | 退役服务 (FastAPI) | 后端 | ⬜ |
| 5 | `src/api/routers/retirement_router.py` | 退役路由 | 后端 | ⬜ |
| 6 | `src/models/asset_retirement.py` | 数据模型 | 后端 | ⬜ |
| 7 | `frontend/src/pages/Retirement/RetirementApply.vue` | 申请表单页 | 前端 | ⬜ |
| 8 | `frontend/src/pages/Retirement/RetirementList.vue` | 申请列表页 | 前端 | ⬜ |
| 9 | `frontend/src/pages/Retirement/RetirementApprove.vue` | 审批处理页 | 前端 | ⬜ |
| 10 | `frontend/src/store/retirementStore.ts` | 状态管理 | 前端 | ⬜ |
| 11 | `frontend/src/types/retirement.types.ts` | 类型定义 | 前端 | ⬜ |
| 12 | `frontend/tests/unit/retirementService.test.ts` | 服务单元测试 | 测试 | ⬜ |
| 13 | `frontend/tests/e2e/retirement_flow.spec.ts` | E2E 测试 | 测试 | ⬜ |
| 14 | `tests/e2e/retirement_user_journey.spec.ts` | 用户旅程测试 | 测试 | ⬜ |
| 15 | `src/api/middleware/audit_logger.py` | 审计日志中间件 | 中间件 | ⬜ |

---

## 10. 风险与依赖

### 10.1 技术风险

| 风险 ID | 风险描述 | 影响程度 | 缓解措施 |
|--------|---------|---------|---------|
| RISK-001 | 状态机复杂度超出预期 | 中 | 预留 2d buffer |
| RISK-002 | 前端状态管理集成难度 | 中 | 提前沟通 Store 接口 |
| RISK-003 | E2E 测试环境不稳定 | 低 | 使用稳定的测试账号 |

### 10.2 依赖关系

| 依赖项 | 类型 | 说明 |
|-------|------|------|
| 资产服务 AssetService | 内部服务 | 获取资产信息 |
| 用户服务 UserService | 内部服务 | 获取用户信息 |
| 通知服务 NotificationService | 内部服务 | 审批结果通知 |
| 审计日志中间件 | 基础设施 | 记录操作审计 |

---

## 11. 附录

### 11.1 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 退役 | Retirement | 资产退出使用状态 |
| 报废 | Scrap | 资产完全销毁处理 |
| 审批链路 | Approval Chain | 多级审批节点序列 |

### 11.2 参考文档

| 文档名称 | 路径 | 说明 |
|---------|------|------|
| 资产模型设计 | `backend/src/main/java/com/ams/entity/Asset.java` | 资产实体定义 |
| 状态机设计 | `src/state_machine/retirement_state_machine.py` | 状态流转定义 |
| 审批服务 | `src/services/approval_service.py` | 审批服务参考 |

---

**文档结束**

| 修订历史 | 版本 | 日期 | 作者 | 变更说明 |
|---------|------|------|------|---------|
| 初始版本 | 1.0 | 2025-01-26 | SE | 初始创建 |