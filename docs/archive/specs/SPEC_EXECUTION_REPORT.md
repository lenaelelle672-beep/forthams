# SWARM-502 规格执行报告

## 任务概述
**用户故事**: [SWARM-502] 资产报废/退役流程 - 用户现在可以对资产发起报废申请、审批链通过后完成退役并自动生成历史记录

**迭代**: 1

**状态**: approved (AC-001~AC-005 全部审核通过，待实施)

---

## 候选修改文件（5个）

| 文件路径 | 相关度 | 行数 | 核心定位 |
|----------|--------|------|----------|
| `frontend/tests/unit/retirementService.test.ts` | 4 | 1008 | 单元测试覆盖 |
| `frontend/src/store/retirementStore.ts` | 4 | 1091 | 状态管理核心 |
| `frontend/tests/e2e/retirement_flow.spec.ts` | 3 | 1602 | E2E流程测试 |
| `frontend/src/composables/useApprovalPermission.ts` | 3 | 339 | 审批权限Hook |
| `tests/e2e/retirement_user_journey.spec.ts` | 3 | 673 | 用户旅程E2E |

---

## 精准定位函数

### 1. `frontend/tests/e2e/retirement_flow.spec.ts` → `function loginUser` (L79)
```typescript
async function loginUser(
  page: Page,
  credentials: TestCredentials
): Promise<AuthContext> {
  await page.goto(`${TEST_BASE_URL}/login`);
  await page.fill('[data-testid="username-input"]', credentials.username);
  await page.fill('[data-testid="password-input"]', credentials.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(`${TEST_BASE_URL}/dashboard`);
  return { userId: 'user-001', username: credentials.username, role: 'ASSET_MANAGER', token: 'mock-jwt-token' };
}
```

### 2. `tests/e2e/retirement_user_journey.spec.ts` → `function loginUser` (L60)
```typescript
async function loginUser(
  page: Page,
  credentials: TestCredentials
): Promise<AuthContext> {
  await page.goto(`${TEST_BASE_URL}/login`);
  await page.fill('[data-testid="username-input"]', credentials.username);
  await page.fill('[data-testid="password-input"]', credentials.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(`${TEST_BASE_URL}/dashboard`);
  return { userId: 'user-001', username: credentials.username, role: UserRole.ASSET_MANAGER, token: 'mock-jwt-token' };
}
```

---

## 边界约束

### 范围内 ✅
- 单资产报废申请与审批
- 可配置的多级审批链（支持会签/或签）
- 审批通过后自动更新资产状态为"已退役"
- 自动生成包含操作人、时间、原因的变更历史
- 退役资产的软删除（可查询、不可操作）

### 范围外 ❌
- 批量报废（单次仅支持单资产）
- 物理资产回收调度
- 资产折旧计算
- 与财务系统对接
- 资产维修/保养流程

### 数据约束
- 资产状态枚举：`active` / `pending_retirement` / `retired` / `scrapped`
- 审批状态枚举：`pending` / `approved` / `rejected`
- 历史记录保留期限：无限制（不可删除）

---

## 验收测试基准 (ATB)

### ATB-1: 报废申请创建
| 测试编号 | 物理测试期待 |
|----------|--------------|
| ATB-1.1 | `POST /api/v1/assets/{id}/retirement` 创建报废申请，期望返回 `201` + `application_id` |
| ATB-1.2 | 资产状态为 `pending_retirement`，数据库 `asset.status = 'pending_retirement'` |
| ATB-1.3 | 已退役资产再次申请返回 `409 Conflict` |
| ATB-1.4 | UI 点击"发起报废"按钮，弹窗表单完整展示 |

### ATB-2: 审批链流转
| 测试编号 | 物理测试期待 |
|----------|--------------|
| ATB-2.1 | `GET /api/v1/retirement/{app_id}` 返回审批节点列表，节点顺序正确 |
| ATB-2.2 | `POST /api/v1/retirement/{app_id}/approve` 一级审批通过，下游节点激活 |
| ATB-2.3 | `POST /api/v1/retirement/{app_id}/reject` 任意节点拒绝，状态置 `rejected`，资产恢复 `active` |
| ATB-2.4 | UI 审批人可查看待审批列表，点击进入详情页执行审批操作 |
| ATB-2.5 | 会签模式下需全部通过才流转 |

### ATB-3: 退役状态自动更新
| 测试编号 | 物理测试期待 |
|----------|--------------|
| ATB-3.1 | 最终审批通过后，`asset.status` 自动变更为 `retired` |
| ATB-3.2 | `retired` 资产在列表查询中默认不展示（软过滤） |
| ATB-3.3 | 带 `?include_retired=true` 参数可查询退役资产 |

### ATB-4: 历史记录自动生成
| 测试编号 | 物理测试期待 |
|----------|--------------|
| ATB-4.1 | 退役完成后查询 `GET /api/v1/assets/{id}/history`，返回包含 `retirement` 类型的变更记录 |
| ATB-4.2 | 历史记录包含 `action`, `operator_id`, `timestamp`, `reason`, `approval_id` |
| ATB-4.3 | 历史记录不可通过 API 删除（返回 `405`） |

### ATB-5: 异常流程
| 测试编号 | 物理测试期待 |
|----------|--------------|
| ATB-5.1 | 重复提交已存在的报废申请返回 `409` |
| ATB-5.2 | 越权审批（非审批人）返回 `403` |
| ATB-5.3 | 审批超时场景（可配置）自动提醒或降级 |
| ATB-5.4 | 网络异常时 UI 提示错误信息，申请不丢失 |

---

## 开发切入层级序列

### Layer 0: 数据模型层
1. 扩展 Asset 模型 - 新增字段: retirement_eligible (bool)
2. 新建 RetirementApplication 表
3. 新建 ApprovalNode 表
4. 新建 AssetHistory 表

### Layer 1: 服务层 (Service)
- `retirement_service.py` - create_retirement_request, approve_application, reject_application, finalize_retirement
- `approval_chain_service.py` - get_approval_chain, evaluate_transition, notify_next_approvers
- `asset_history_service.py` - log_retirement, get_asset_history

### Layer 2: API 路由层
- `POST /api/v1/assets/{id}/retirement` - 发起报废
- `GET /api/v1/retirement/{app_id}` - 查询申请详情
- `POST /api/v1/retirement/{app_id}/approve` - 审批通过
- `POST /api/v1/retirement/{app_id}/reject` - 审批拒绝
- `GET /api/v1/assets/{id}/history` - 变更历史

### Layer 3: 业务规则层
- `retirement_eligibility.py` - can_retire(asset) -> (bool, reason)
- `approval_policy.py` - get_policy(category) -> ApprovalPolicy

### Layer 4: 前端/UI 层
- RetirementRequestPage.vue - 申请表单
- RetirementApprovalPage.vue - 审批工作台
- RetirementDetailPage.vue - 申请详情
- RetiredAssetListPage.vue - 退役资产查询

---

## 关键依赖链路
```
submit_scrap_request → ApprovalChain → execute_approval_node → 
_update_asset_status → _record_status_history → send_notification
```

---

## AC 验证状态

| AC ID | 验证方法 | 状态 |
|-------|----------|------|
| AC-001 | unit_test | pending |
| AC-002 | unit_test | pending |
| AC-003 | static_analysis | pending |
| AC-004 | static_analysis | pending |
| AC-005 | unit_test | pending |

---

## 执行计划

### Phase 1: 基础流程搭建
- [ ] P1.1: 资产报废申请功能
- [ ] P1.2: 基础审批链配置
- [ ] P1.3: 资产退役状态变更
- [ ] P1.4: 历史记录自动生成

### Phase 2: 增强与集成
- [ ] P2.1: 审批状态通知
- [ ] P2.2: 退役资产查询与恢复
- [ ] P2.3: 报表导出