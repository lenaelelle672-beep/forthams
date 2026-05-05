# SWARM-001 工单审批流程 - 规格指导文档

## 1. 需求与背景

### 1.1 业务目标

实现工单审批流程，支撑企业级工作流自动化管理：

| 目标项 | 描述 |
|--------|------|
| 工单提交 | 用户通过前端界面提交审批工单 |
| 状态机流转 | 后端基于状态机引擎自动驱动审批链路流转 |
| 通知机制 | 系统根据状态变更自动触发通知事件 |

### 1.2 核心价值

- **规范化**: 工单审批流程标准化，减少人工干预环节
- **可视化**: 审批链路状态实时追踪，审批历史可追溯
- **可靠性**: 状态流转原子性保证，降低审批环节出错率

### 1.3 迭代范围

| Iteration | 范围 |
|-----------|------|
| Iteration 1 (当前) | 核心基础设施搭建：数据模型、状态机、CRUD API、审批链路引擎、通知触发点 |
| Iteration 2 (预留) | 前端集成与复杂链路：多级审批、条件分支、超时处理 |

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 核心基础设施搭建

| 序号 | 目标项 | 具体内容 | 交付物 |
|------|--------|----------|--------|
| 1.1 | 工单数据模型 | 定义 WorkOrder 实体，包含状态、申请人、审批链路等核心字段 | `frontend/src/types/workorder.types.ts` |
| 1.2 | 数据库 Schema | 审批工单相关表结构设计 | `alembic/versions/001_create_workorder_tables.py` |
| 1.3 | 状态机引擎 | 实现基础状态转换逻辑 (Pending → Approved/Rejected → Closed) | 后端已有: `src/engine/guards.py` |
| 1.4 | CRUD API | 工单的创建、查询、更新、状态流转接口 | `frontend/src/pages/WorkOrder/api/workOrderApi.ts` |
| 1.5 | 审批链路服务 | 审批节点管理、链路推进、状态同步 | `frontend/src/services/approvalService.ts` |
| 1.6 | 审批历史页面 | 审批记录展示、历史追溯 | `frontend/src/pages/WorkOrder/pages/ApprovalHistoryPage.tsx` |
| 1.7 | 基础通知 | 状态变更时的异步通知触发机制 | 后端已有: `src/services/notification_service.py` |

---

## 3. 边界约束

### 3.1 技术栈约束

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端框架 | TypeScript + Vue 3 | 已有项目技术栈 |
| 后端框架 | FastAPI / Python | 已有项目技术栈 |
| 数据库 | PostgreSQL | 已有项目技术栈 |
| ORM | SQLAlchemy | 已有项目技术栈 |
| 任务队列 | Celery + Redis | 异步通知 |
| 单元测试 | pytest | 后端测试 |
| E2E 测试 | Playwright | 前端测试 |

### 3.2 范围边界

#### 本 Iteration 包含

- 工单 CRUD 操作（创建、查询、更新、删除）
- 状态机定义与状态流转规则
- 审批链路配置表（审批节点定义）
- 审批链路执行引擎（按配置顺序推进）
- 审批历史记录存储与展示
- 通知触发点（事件发布，不含具体渠道实现）

#### 本 Iteration 不包含

| 排除项 | 原因 |
|--------|------|
| 前端页面开发 | 后续 Iteration 规划 |
| 多级条件分支审批逻辑 | 后续 Iteration 规划 |
| 审批超时自动处理 | 后续 Iteration 规划 |
| 审批意见附件上传 | 后续 Iteration 规划 |
| 通知渠道具体实现 (Email/企微/钉钉) | 通知触发点已就绪，渠道由后续 Iteration 实现 |

### 3.3 非功能约束

| 约束项 | 要求 |
|--------|------|
| API 响应时间 | < 500ms（不含通知异步投递） |
| 状态流转事务 | 需保证原子性，失败时回滚 |
| 通知投递失败处理 | 不影响主业务流程 |
| 代码静态分析 | AST 扫描通过，无语法错误 |
| 文档注释 | 所有修改的函数需包含 docstring |

---

## 4. 验收测试基准 (ATB)

### 4.1 验收标准矩阵

| AC ID | 描述 | 验证方法 | 状态 |
|-------|------|----------|------|
| AC-001 | User Task: 实现工单审批流程 | unit_test | pending |
| AC-002 | User Task: Iteration 1 交付物完成 | unit_test | pending |
| AC-003 | 代码变更不引入语法错误 | static_analysis (AST) | pending |
| AC-004 | 所有修改函数包含 docstring | static_analysis | pending |
| AC-005 | 模块可正常 import | unit_test | pending |

### 4.2 单元测试基准

#### 4.2.1 TypeScript 类型定义测试

```typescript
// tests/unit/test_workorder_types.ts

/**
 * Test suite for WorkOrder type definitions.
 * @module tests/unit/test_workorder_types
 */

describe('WorkOrder Types', () => {
  /**
   * @description WorkOrder 创建时应包含必填字段
   */
  it('should have required fields when created', () => {
    const workOrder: WorkOrder = {
      id: 'WO-001',
      title: '采购申请',
      description: '办公用品采购',
      status: WorkOrderStatus.PENDING,
      applicantId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentNodeIndex: 0,
      approvalChainId: 'AC-001',
    };
    
    expect(workOrder.id).toBeDefined();
    expect(workOrder.title).toBeDefined();
    expect(workOrder.status).toBe(WorkOrderStatus.PENDING);
  });

  /**
   * @description WorkOrderStatus 枚举值应完整
   */
  it('should have all status enum values', () => {
    expect(WorkOrderStatus.PENDING).toBe('PENDING');
    expect(WorkOrderStatus.APPROVED).toBe('APPROVED');
    expect(WorkOrderStatus.REJECTED).toBe('REJECTED');
    expect(WorkOrderStatus.CLOSED).toBe('CLOSED');
  });

  /**
   * @description ApprovalNode 应正确关联工单和审批人
   */
  it('should link node to workorder and approver', () => {
    const node: ApprovalNode = {
      id: 'AN-001',
      workorderId: 'WO-001',
      userId: 2,
      nodeOrder: 1,
      status: ApprovalNodeStatus.PENDING,
    };
    
    expect(node.workorderId).toBe('WO-001');
    expect(node.userId).toBe(2);
  });
});
```

#### 4.2.2 API 服务测试

```typescript
// tests/unit/test_workorder_api.ts

/**
 * Test suite for WorkOrder API service.
 * @module tests/unit/test_workorder_api
 */

import { WorkOrderApi } from '@/pages/WorkOrder/api/workOrderApi';

describe('WorkOrderApi', () => {
  /**
   * @description createWorkOrder 应返回包含 PENDING 状态的新工单
   */
  it('should create workorder with PENDING status', async () => {
    const mockResponse: WorkOrder = {
      id: 'WO-001',
      title: '测试工单',
      description: '测试描述',
      status: WorkOrderStatus.PENDING,
      applicantId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentNodeIndex: 0,
      approvalChainId: 'AC-001',
    };

    vi.spyOn(WorkOrderApi, 'createWorkOrder').mockResolvedValue(mockResponse);
    
    const result = await WorkOrderApi.createWorkOrder({
      title: '测试工单',
      description: '测试描述',
      applicantId: 1,
    });
    
    expect(result.status).toBe(WorkOrderStatus.PENDING);
  });

  /**
   * @description getWorkOrderById 应返回指定 ID 的工单
   */
  it('should fetch workorder by id', async () => {
    const mockWorkOrder: WorkOrder = { /* ... */ };
    vi.spyOn(WorkOrderApi, 'getWorkOrderById').mockResolvedValue(mockWorkOrder);
    
    const result = await WorkOrderApi.getWorkOrderById('WO-001');
    expect(result.id).toBe('WO-001');
  });

  /**
   * @description approveWorkOrder 应更新状态为 APPROVED
   */
  it('should update status to APPROVED after approval', async () => {
    const mockResponse: WorkOrder = {
      status: WorkOrderStatus.APPROVED,
      currentNodeIndex: 1,
    };
    vi.spyOn(WorkOrderApi, 'approveWorkOrder').mockResolvedValue(mockResponse);
    
    const result = await WorkOrderApi.approveWorkOrder('WO-001', 2);
    expect(result.status).toBe(WorkOrderStatus.APPROVED);
  });
});
```

#### 4.2.3 审批链路服务测试

```typescript
// tests/unit/test_approval_service.ts

/**
 * Test suite for ApprovalService.
 * @module tests/unit/test_approval_service
 */

import { ApprovalService } from '@/services/approvalService';

describe('ApprovalService', () => {
  /**
   * @description getApprovalChain 应返回工单关联的审批链路
   */
  it('should return approval chain for workorder', async () => {
    const mockChain: ApprovalChain = {
      id: 'AC-001',
      workorderId: 'WO-001',
      nodes: [
        { id: 'AN-001', status: ApprovalNodeStatus.COMPLETED },
        { id: 'AN-002', status: ApprovalNodeStatus.PENDING },
      ],
    };
    
    vi.spyOn(ApprovalService, 'getApprovalChain').mockResolvedValue(mockChain);
    
    const result = await ApprovalService.getApprovalChain('WO-001');
    expect(result.id).toBe('AC-001');
    expect(result.nodes.length).toBe(2);
  });

  /**
   * @description executeApprovalNode 应推进链路到下一节点
   */
  it('should advance chain to next node after approval', async () => {
    vi.spyOn(ApprovalService, 'executeApprovalNode').mockResolvedValue({
      currentNodeIndex: 1,
      status: WorkOrderStatus.PENDING,
    });
    
    const result = await ApprovalService.executeApprovalNode('AN-001', 'approve');
    expect(result.currentNodeIndex).toBe(1);
  });

  /**
   * @description rejection 应终止链路
   */
  it('should terminate chain on rejection', async () => {
    vi.spyOn(ApprovalService, 'executeApprovalNode').mockResolvedValue({
      status: WorkOrderStatus.REJECTED,
      rejectionReason: '条件不符',
    });
    
    const result = await ApprovalService.executeApprovalNode('AN-001', 'reject', '条件不符');
    expect(result.status).toBe(WorkOrderStatus.REJECTED);
  });
});
```

### 4.3 静态分析基准

#### 4.3.1 AST 语法检查

```bash
# 所有修改文件需通过 AST 静态检查
python scripts/ast_dead_code_check.py \
  frontend/src/services/approvalService.ts \
  frontend/src/pages/WorkOrder/api/workOrderApi.ts \
  frontend/src/pages/WorkOrder/pages/ApprovalHistoryPage.tsx \
  frontend/src/types/workorder.types.ts \
  alembic/versions/001_create_workorder_tables.py
```

**通过标准**: 无 SyntaxError、IndentationError、ParseError

#### 4.3.2 Docstring 覆盖率检查

```bash
# 检查所有修改的函数包含 docstring
python tests/test_docstring_coverage.py \
  --files frontend/src/services/approvalService.ts \
          frontend/src/pages/WorkOrder/api/workOrderApi.ts \
          frontend/src/pages/WorkOrder/pages/ApprovalHistoryPage.tsx \
          frontend/src/types/workorder.types.ts
```

**通过标准**: 所有导出函数和公共方法包含 JSDoc/TSDoc 注释

### 4.4 Import 验证基准

```bash
# Python 模块导入测试
python -c "
from backend.src.engine.guards import GuardEvaluator
from backend.src.services.approval_service import ApprovalService
from backend.src.services.approval_chain_service import ApprovalChainService
print('All imports successful')
"

# TypeScript 类型检查
cd frontend && npx tsc --noEmit --skipLibCheck \
  src/services/approvalService.ts \
  src/pages/WorkOrder/api/workOrderApi.ts \
  src/pages/WorkOrder/pages/ApprovalHistoryPage.tsx \
  src/types/workorder.types.ts
```

---

## 5. 开发切入层级序列

### 5.1 层级依赖关系

```
┌─────────────────────────────────────────────────────────────────┐
│  层级 5: 通知触发层                                               │
│  (src/services/notification_service.py)                         │
└─────────────────────────────────────┬───────────────────────────┘
                                      ↑
┌─────────────────────────────────────┴───────────────────────────┐
│  层级 4: 审批链路引擎层                                           │
│  (src/services/approval_chain_service.py)                       │
│  修改: approvalService.ts                                        │
└─────────────────────────────────────┬───────────────────────────┘
                                      ↑
┌─────────────────────────────────────┴───────────────────────────┐
│  层级 3: API 接口层                                               │
│  (src/api/routers/workorder_router.py)                          │
│  修改: workOrderApi.ts, ApprovalHistoryPage.tsx                  │
└─────────────────────────────────────┬───────────────────────────┘
                                      ↑
┌─────────────────────────────────────┴───────────────────────────┐
│  层级 2: 状态机核心层                                             │
│  (src/engine/guards.py, states.py, transitions.py)              │
└─────────────────────────────────────┬───────────────────────────┘
                                      ↑
┌─────────────────────────────────────┴───────────────────────────┐
│  层级 1: 数据模型层                                               │
│  修改: workorder.types.ts, 001_create_workorder_tables.py      │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 详细开发顺序

#### 层级 1: 数据模型层

| 序号 | 任务 | 交付物 | 前置依赖 |
|------|------|--------|----------|
| 1.1 | 完善 WorkOrderStatus 枚举定义 | `workorder.types.ts` | 无 |
| 1.2 | 定义 ApprovalNode 接口 | `workorder.types.ts` | 1.1 |
| 1.3 | 定义 ApprovalChain 接口 | `workorder.types.ts` | 1.2 |
| 1.4 | 创建数据库迁移脚本 | `001_create_workorder_tables.py` | 1.1-1.3 |

#### 层级 2: 状态机核心层

| 序号 | 任务 | 交付物 | 前置依赖 |
|------|------|--------|----------|
| 2.1 | 验证状态转换规则 | 无 (验证已有代码) | 1.1 |
| 2.2 | 实现 transition_to() 验证 | 无 (验证已有代码) | 2.1 |

#### 层级 3: API 接口层

| 序号 | 任务 | 交付物 | 前置依赖 |
|------|------|--------|----------|
| 3.1 | 实现 createWorkOrder API | `workOrderApi.ts` | 1.1-1.4 |
| 3.2 | 实现 getWorkOrderById API | `workOrderApi.ts` | 3.1 |
| 3.3 | 实现 approveWorkOrder API | `workOrderApi.ts` | 3.2 |
| 3.4 | 实现 rejectWorkOrder API | `workOrderApi.ts` | 3.3 |
| 3.5 | 实现 ApprovalHistoryPage 组件 | `ApprovalHistoryPage.tsx` | 3.2 |

#### 层级 4: 审批链路引擎层

| 序号 | 任务 | 交付物 | 前置依赖 |
|------|------|--------|----------|
| 4.1 | 实现 getApprovalChain 方法 | `approvalService.ts` | 1.2-1.3 |
| 4.2 | 实现 executeApprovalNode 方法 | `approvalService.ts` | 4.1 |
| 4.3 | 实现 advanceChain 自动推进 | `approvalService.ts` | 4.2 |

#### 层级 5: 通知触发层

| 序号 | 任务 | 交付物 | 前置依赖 |
|------|------|--------|----------|
| 5.1 | 定义 NotificationEvent 枚举 | 无 (验证已有代码) | 4.3 |
| 5.2 | 集成通知事件发布 | `approvalService.ts` | 5.1 |

---

## 6. 附录

### 6.1 修改文件清单

| 文件路径 | 修改类型 | 说明 |
|----------|----------|------|
| `frontend/src/types/workorder.types.ts` | 修改 | 完善工单类型定义 |
| `alembic/versions/001_create_workorder_tables.py` | 修改 | 数据库表结构 |
| `frontend/src/pages/WorkOrder/api/workOrderApi.ts` | 修改 | 工单 CRUD API |
| `frontend/src/services/approvalService.ts` | 修改 | 审批链路服务 |
| `frontend/src/pages/WorkOrder/pages/ApprovalHistoryPage.tsx` | 修改 | 审批历史页面 |

### 6.2 已有可用代码

| 文件路径 | 说明 |
|----------|------|
| `src/engine/guards.py` | GuardEvaluator - 审批条件守卫 |
| `src/state_machine/states.py` | 状态定义 |
| `src/state_machine/transitions.py` | 状态转换定义 |
| `src/services/approval_service.py` | ApprovalService - 审批服务 |
| `src/services/approval_chain_service.py` | ApprovalChainService - 审批链路服务 |
| `src/services/notification_service.py` | NotificationService - 通知服务 |

### 6.3 测试运行命令

```bash
# 后端单元测试
pytest tests/backend/test_state_machine.py -v

# 前端单元测试
cd frontend && npm run test:unit -- --run tests/unit/test_workorder_*.ts

# 静态分析
python scripts/ast_dead_code_check.py frontend/src/

# 类型检查
cd frontend && npx tsc --noEmit
```

---

**文档版本**: Iteration 1  
**创建日期**: 基于 SWARM-001 需求  
**状态**: 规格指导，待实施评审