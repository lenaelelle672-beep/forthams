# Specifications 规格指导文档

**文档编号**: SPEC-US-004-v1.0
**对应任务**: US-004 - Graphify 知识图谱节点匹配问题修复
**迭代版本**: Iteration 1
**生成日期**: 2025-01-14
**状态**: **正式发布**

---

## 1. 需求与背景

### 1.1 问题描述

**核心问题**: Graphify 知识图谱查询返回 "No matching nodes found" 错误，导致工作流设计器和资产详情模块无法正常展示节点数据。

### 1.2 影响范围

| 影响模块 | 严重程度 | 影响描述 |
|---------|---------|---------|
| WorkflowDesigner (工作流设计器) | P1 | 无法加载预设工作流模板，影响审批流程配置 |
| AssetDetailModal (资产详情弹窗) | P2 | 资产关联节点无法展示，影响资产上下文信息呈现 |
| 知识图谱可视化 | P2 | 图谱节点为空，影响资产关系可视化 |

### 1.3 根本原因分析

基于代码审查，发现以下潜在根因：

1. **数据初始化问题**: `initialize_default_nodes()` 函数虽存在，但可能未被调用或注册表未正确初始化
2. **搜索函数返回空值**: `mockGraphifySearch` 和 `get_nodes_by_type` 在无匹配时返回空数组而非友好的提示信息
3. **租户隔离问题**: 多租户场景下节点查询的 `tenant_id` 过滤逻辑可能导致合法节点被过滤
4. **节点类型枚举不一致**: 前端 `GraphNodeType` 与后端 `GraphNodeType` 可能存在枚举值不匹配

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 基础修复 (P0)

| 目标编号 | 目标描述 | 成功标准 | 依赖前置条件 |
|---------|---------|---------|-------------|
| OBJ-P1-001 | 修复后端节点注册表初始化 | `initialize_default_nodes()` 被正确调用，注册表中包含示例数据 | 无 |
| OBJ-P1-002 | 修复前端搜索函数空值处理 | 搜索无结果时返回结构化响应而非 null 或空数组 | OBJ-P1-001 |
| OBJ-P1-003 | 验证跨端节点查询一致性 | 前端 `mockGraphifySearch` 与后端 `get_nodes_by_type` 返回格式一致 | OBJ-P1-002 |

### Phase 2: 增强健壮性 (P1)

| 目标编号 | 目标描述 | 成功标准 | 依赖前置条件 |
|---------|---------|---------|-------------|
| OBJ-P2-001 | 添加空状态处理 UI | 工作流设计器和资产详情弹窗展示友好的空状态提示 | Phase 1 |
| OBJ-P2-002 | 完善错误日志记录 | 节点查询失败时记录详细日志便于问题排查 | OBJ-P1-001 |

---

## 3. 边界约束

### 3.1 功能边界

```
┌─────────────────────────────────────────────────────────────┐
│                        边界定义                              │
├─────────────────────────────────────────────────────────────┤
│  纳入范围:                                                   │
│  ✅ endless_daemon.py 节点注册表初始化                       │
│  ✅ AssetDetailModal.tsx 搜索函数修复                        │
│  ✅ WorkflowDesigner.tsx 空状态处理                         │
│  ✅ CustomNodes.tsx 节点渲染逻辑                             │
│  ✅ userService.ts 租户上下文传递                           │
│                                                             │
│  明确排除:                                                   │
│  ❌ 不修改数据库 Schema                                      │
│  ❌ 不修改非 Graphify 相关业务逻辑                           │
│  ❌ 不涉及 CI/CD 流水线配置                                  │
│  ❌ 不涉及生产环境部署                                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 技术约束

| 约束类型 | 具体要求 | 量化指标 |
|---------|---------|---------|
| 性能约束 | 节点搜索响应时间 | < 200ms |
| 兼容性约束 | 保持与现有 API 接口兼容 | 0 breaking changes |
| 代码质量约束 | 所有函数包含 docstring | 100% 覆盖率 |

### 3.3 数据约束

- **示例数据保留**: `initialize_default_nodes()` 中的示例节点不可删除，作为开发环境验证基准
- **租户隔离**: 默认租户 "default" 的节点对所有未指定租户的查询可见

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试用例

| TC 编号 | 测试描述 | 输入数据 | 预期结果 | 测试类型 |
|--------|---------|---------|---------|---------|
| TC-US004-001 | 测试节点注册表初始化 | 调用 `initialize_default_nodes()` | 返回包含至少 3 个节点的注册表 | Unit |
| TC-US004-002 | 测试按类型查询节点 | `node_type=GraphNodeType.ASSET` | 返回资产类型节点列表 | Unit |
| TC-US004-003 | 测试搜索功能空值处理 | 查询不存在的关键词 | 返回 `GraphSearchResult` 且 `nodes` 为空数组 | Unit |
| TC-US004-004 | 测试租户隔离 | 查询 "other-tenant" 的节点 | 仅返回该租户的节点，不混入 default 租户 | Unit |

### 4.2 集成测试用例

| TC 编号 | 测试描述 | 测试路径 | 预期结果 |
|--------|---------|---------|---------|
| TC-US004-005 | 后端节点注册表 API | GET `/api/graphify/nodes` | 返回 200 且包含节点数据 |
| TC-US004-006 | 前端资产详情弹窗加载 | 打开资产详情弹窗 | 展示资产关联节点，无 "No matching nodes" 提示 |

### 4.3 pytest 测试示例

```python
# tests/test_graphify_nodes.py
"""
Graphify 知识图谱节点查询测试套件

@module test_graphify_nodes
@test_class TestGraphifyNodeRegistry
"""
import pytest
from endless_daemon import (
    GraphifyNodeRegistry,
    GraphNodeType,
    initialize_default_nodes,
    get_registry
)


class TestGraphifyNodeRegistry:
    """Graphify 节点注册表测试类"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """测试前置设置"""
        initialize_default_nodes()
        self.registry = get_registry()
    
    def test_initialize_default_nodes_creates_nodes(self):
        """
        TC-US004-001: 验证节点注册表初始化创建示例节点
        
        @test test_initialize_default_nodes_creates_nodes
        @assert 注册表包含至少 3 个节点
        """
        nodes = self.registry.get_all_nodes()
        assert len(nodes) >= 3, "默认节点初始化失败"
    
    def test_get_nodes_by_type_returns_asset_nodes(self):
        """
        TC-US004-002: 验证按类型查询返回正确节点
        
        @test test_get_nodes_by_type_returns_asset_nodes
        @assert 返回类型为 ASSET 的节点
        """
        asset_nodes = self.registry.get_nodes_by_type(GraphNodeType.ASSET)
        assert len(asset_nodes) > 0, "未找到资产类型节点"
        for node in asset_nodes:
            assert node.node_type == GraphNodeType.ASSET
    
    def test_search_returns_empty_result_gracefully(self):
        """
        TC-US004-003: 验证搜索空值优雅处理
        
        @test test_search_returns_empty_result_gracefully
        @assert 返回空数组而非抛出异常
        """
        results = self.registry.search_nodes("nonexistent_keyword_xyz")
        assert isinstance(results, list), "搜索应返回列表类型"
        assert len(results) == 0, "不存在的关键词应返回空列表"
```

### 4.4 前端测试示例 (Vitest)

```typescript
// frontend/src/test/graphify.test.ts
/**
 * Graphify 前端模块测试
 * @module graphify.test
 * @test_suite GraphifyModule
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { mockGraphifySearch } from '../components/AssetDetailModal';

describe('Graphify 前端搜索测试', () => {
  /**
   * TC-US004-003: 验证搜索空值处理
   * @test 空关键词搜索应返回空数组
   */
  it('TC-US004-003: 空关键词搜索应返回空结果', async () => {
    const result = await mockGraphifySearch('');
    expect(result.nodes).toEqual([]);
  });

  /**
   * TC-US004-006: 集成测试 - 资产详情加载
   * @test 模拟资产详情数据加载
   */
  it('TC-US004-006: 模拟搜索应返回有效结果结构', async () => {
    const result = await mockGraphifySearch('Dell');
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('query');
  });
});
```

### 4.5 ATB 通过标准

| 验收项 | 通过标准 | 检查方法 |
|-------|---------|---------|
| 单元测试覆盖率 | ≥ 80% | pytest --cov |
| 集成测试通过率 | 100% | pytest tests/integration/ |
| E2E 关键路径 | 100% 通过 | Playwright |
| 性能基准 | 搜索响应 < 200ms | Locust load test |
| 代码质量 | 无语法错误 | ESLint + Python flake8 |

---

## 5. 开发切入层级序列

### 5.1 Phase 1: 后端节点注册表修复 (优先级 P0)

| 序号 | 任务项 | 依赖关系 | 预估工时 | 负责人 | 文件 |
|-----|-------|---------|---------|-------|------|
| 1.1 | 修复 `initialize_default_nodes` 调用 | 无 | 1h | 待分配 | endless_daemon.py |
| 1.2 | 添加注册表初始化日志 | 1.1 | 0.5h | 待分配 | endless_daemon.py |
| 1.3 | 验证 `get_nodes_by_type` 租户隔离 | 1.1 | 1h | 待分配 | endless_daemon.py |

### 5.2 Phase 2: 前端搜索函数修复 (优先级 P0)

| 序号 | 任务项 | 依赖关系 | 预估工时 | 负责人 | 文件 |
|-----|-------|---------|---------|-------|
| 2.1 | 修复 `mockGraphifySearch` 空值处理 | Phase 1 | 1h | 待分配 | AssetDetailModal.tsx |
| 2.2 | 添加搜索函数类型定义 | 2.1 | 0.5h | 待分配 | AssetDetailModal.tsx |
| 2.3 | 验证前后端数据结构一致性 | 2.1 | 1h | 待分配 | AssetDetailModal.tsx |

### 5.3 Phase 3: UI 空状态处理 (优先级 P1)

| 序号 | 任务项 | 依赖关系 | 预估工时 | 负责人 | 文件 |
|-----|-------|---------|---------|-------|------|
| 3.1 | WorkflowDesigner 空状态组件 | Phase 2 | 1h | 待分配 | WorkflowDesigner.tsx |
| 3.2 | AssetDetailModal 空状态展示 | Phase 2 | 1h | 待分配 | AssetDetailModal.tsx |
| 3.3 | CustomNodes 降级处理 | Phase 2 | 0.5h | 待分配 | CustomNodes.tsx |

### 5.4 开发流程约束

```
需求确认 (Spec Review)
      ↓
┌─────────────────────────────────────────────────────────────┐
│                    Phase 1: 后端修复                         │
│  endless_daemon.py → initialize_default_nodes()             │
└─────────────────────────────────────────────────────────────┘
      ↓ Gate 1: 后端单元测试通过
┌─────────────────────────────────────────────────────────────┐
│                    Phase 2: 前端修复                         │
│  AssetDetailModal.tsx → mockGraphifySearch                  │
└─────────────────────────────────────────────────────────────┘
      ↓ Gate 2: 前端单元测试通过
┌─────────────────────────────────────────────────────────────┐
│                    Phase 3: UI 增强                          │
│  WorkflowDesigner.tsx + CustomNodes.tsx                     │
└─────────────────────────────────────────────────────────────┘
      ↓ Gate 3: 集成测试通过
           预发布验证 → 生产部署
```

---

## 6. 修改文件清单

| 文件路径 | 修改类型 | 变更描述 | 影响范围 |
|---------|---------|---------|---------|
| `endless_daemon.py` | 增强 | 完善 `initialize_default_nodes` 逻辑，添加详细日志 | 全局 |
| `frontend/src/app/components/AssetDetailModal.tsx` | 修复 | 优化 `mockGraphifySearch` 空值处理 | 资产详情弹窗 |
| `frontend/src/app/pages/WorkflowDesigner.tsx` | 增强 | 添加节点加载空状态 UI | 工作流设计器 |
| `frontend/src/app/components/flow/CustomNodes.tsx` | 增强 | 添加节点缺失时的降级渲染 | 流程节点组件 |
| `frontend/src/app/services/userService.ts` | 增强 | 确保租户上下文正确传递 | 用户认证服务 |

---

## 7. 风险与缓解

| 风险编号 | 风险描述 | 影响等级 | 缓解措施 |
|---------|---------|---------|---------|
| RISK-001 | 修改后端可能影响现有 API 消费者 | 中 | 保持接口签名兼容，添加版本控制 |
| RISK-002 | 前端 mock 函数与后端实现不一致 | 高 | 添加契约测试验证前后端一致性 |
| RISK-003 | 租户隔离逻辑被意外绕过 | 中 | 添加安全代码审查 |

---

## 8. 文档版本历史

| 版本 | 日期 | 作者 | 变更描述 |
|-----|------|-----|---------|
| v1.0 | 2025-01-14 | AI Assistant | 初始版本创建 |

---

**下一步行动**: 
1. 按照 Phase 序列执行代码修改
2. 编写并执行 ATB 测试用例
3. 验证所有 4 个验收标准 (AC-001 ~ AC-004)

**文档审批状态**: 待审批