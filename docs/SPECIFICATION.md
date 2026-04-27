# Graphify 知识图谱规格指导文档

**文档版本**: v1.0  
**迭代阶段**: Iteration 1  
**生成日期**: 2025-01  
**状态**: 初始规格基线

---

## 1. 需求与背景

### 1.1 产品定位

Graphify 是一个基于图结构知识组织系统，提供实体关系建模、语义检索与知识推理能力。该系统作为资产管理系统（AMS）的核心知识层，负责维护资产、设备、流程节点之间的语义关联。

### 1.2 当前核心问题

**症状**: `No matching nodes found.`

此状态表明知识图谱中存在以下可能缺陷：
- 节点索引缺失或损坏
- 查询语法与图谱 schema 不匹配
- 实体识别引擎未正确解析输入
- 知识库为空或未初始化
- Mock Graphify 服务返回格式不正确

### 1.3 迭代目标

本次 Iteration 1 聚焦于**知识图谱基础节点架构搭建**，确保核心 CRUD 操作稳定可用，消除 `No matching nodes found` 错误，建立稳定的前后端通信协议。

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 节点管理基础设施

| 子目标 | 验收条件 |
|--------|----------|
| P1.1 图谱初始化 | 创建名为 `default` 的主图谱实例，返回唯一 graph_id |
| P1.2 节点创建 | 成功创建包含 `label`、`properties`、`metadata` 的节点 |
| P1.3 节点查询 | 根据 `label` 或 `id` 查询返回匹配节点列表 |
| P1.4 节点更新 | 原子性更新指定节点属性，保持关联边完整性 |
| P1.5 节点删除 | 软删除机制，关联边标记为 `deprecated` |

### Phase 2: 前端集成修复

| 子目标 | 验收条件 |
|--------|----------|
| P2.1 CustomNodes 组件 | 正确渲染知识图谱节点，支持拖拽和属性编辑 |
| P2.2 AssetDetailModal | 集成 Graphify 搜索，修复空状态显示 |
| P2.3 WorkflowDesigner | 支持节点配置与图谱关联 |
| P2.4 userService | 提供正确的租户上下文 |

---

## 3. 边界约束

### 3.1 技术边界

```
最大节点数: 1,000,000
单节点最大属性数: 256
单属性最大长度: 65,535 bytes
图谱最大标签类型: 512
单查询最大返回: 10,000 条
请求超时阈值: 30,000 ms
Mock 延迟基准: < 200 ms
```

### 3.2 操作边界

- **禁止**: 跨图谱直接引用节点（必须通过唯一标识符）
- **禁止**: 在单事务中操作超过 500 个节点
- **必须**: 所有写操作携带事务 ID
- **必须**: 查询操作设置超时阈值（默认 30s）
- **必须**: Mock 服务实现与后端 Graphify Core API 协议兼容

### 3.3 错误处理约束

| 错误码 | 含义 | 响应要求 |
|--------|------|----------|
| `G001` | 节点未找到 | 返回空数组而非异常 |
| `G002` | 图谱未初始化 | 抛出 InitializationError |
| `G003` | 属性 schema 违规 | 返回 ValidationError，含字段路径 |
| `G004` | Mock 服务不可用 | 返回 degraded mode 标记 |

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试 (pytest)

#### TC-001: 图谱初始化
```python
def test_graph_initialization():
    """
    验证 Graphify 图谱实例化功能。
    
    期望:
    - 返回包含 graph_id 的对象
    - 状态为 'active'
    - 包含默认租户 ID
    """
    graph = create_graph(name="default")
    assert graph.graph_id is not None
    assert graph.status == "active"
```

#### TC-002: 节点创建
```python
def test_node_creation():
    """
    验证节点创建功能。
    
    期望:
    - 节点包含自动生成的 node_id
    - 包含创建时间戳
    - 属性正确存储
    """
    node = create_node(
        graph_id, 
        label="Person", 
        properties={"name": "Alice"}
    )
    assert node.node_id is not None
    assert node.created_at is not None
```

#### TC-003: 节点查询 - 存在匹配
```python
def test_node_query_found():
    """
    验证节点查询返回正确结果。
    
    期望:
    - 返回非空列表
    - 不抛出 NoMatchingNodesFound 异常
    - 列表项包含预期属性
    """
    results = query_nodes(graph_id, label="Person")
    assert isinstance(results, list)
    assert len(results) > 0
```

#### TC-004: 节点查询 - 无匹配（消除错误状态）
```python
def test_node_query_not_found():
    """
    验证空结果查询不触发错误提示。
    
    期望:
    - 返回空列表
    - HTTP 200
    - 不触发 G001 错误
    - 不显示 "No matching nodes found" 提示
    """
    results = query_nodes(graph_id, label="NonExistent")
    assert results == []
    assert response.status_code == 200
```

#### TC-005: 节点更新
```python
def test_node_update():
    """
    验证节点属性原子更新。
    
    期望:
    - 属性原子更新
    - 版本号递增
    - 更新时间戳更新
    """
    updated = update_node(node_id, {"age": 30})
    assert updated.properties["age"] == 30
    assert updated.version == original_version + 1
```

#### TC-006: 节点删除（软删除）
```python
def test_node_soft_delete():
    """
    验证软删除机制。
    
    期望:
    - 节点标记为 deleted
    - 数据保留在数据库
    - 查询结果中不出现该节点
    """
    delete_node(node_id)
    node = get_node(node_id)
    assert node.status == "deleted"
    assert query_nodes(label="Person") == []
```

### 4.2 集成测试 (Playwright)

#### ITC-001: 前端查询流程
```
测试步骤:
1. 访问 /graphs/{graph_id}/nodes
2. 输入标签 "Person"
3. 点击查询按钮
4. 等待响应（< 500ms）

验收条件:
- 显示节点列表（如果有）
- 不显示 "No matching nodes found" 错误提示
- 加载指示器正确显示/隐藏
```

#### ITC-002: 完整 CRUD 链路
```
测试步骤:
1. 创建节点 → 2. 查询节点 → 3. 更新节点 → 4. 验证更新 → 5. 删除节点 → 6. 确认查询返回空

验收条件:
- 每步操作响应 < 200ms
- 状态变化正确反映在 UI
- 无错误提示出现
```

#### ITC-003: 空状态渲染
```
测试步骤:
1. 查询不存在的标签 "EmptyLabel"
2. 检查空状态渲染

验收条件:
- 显示友好的空状态提示
- 不显示技术性错误信息
- 提供创建新节点的入口（如适用）
```

---

## 5. 开发切入层级序列

### Level 1: 数据模型层
```
优先级: P0
产出: Node, Graph, Edge, GraphNodeType 数据类定义
依赖: 无
关键文件: endless_daemon.py (L1-L120)
```

### Level 2: 存储层
```
优先级: P0
产出: 节点 Repository 实现
依赖: Level 1
关键文件: endless_daemon.py (GraphifyNodeRegistry 类)
```

### Level 3: 服务层
```
优先级: P0
产出: GraphifyService, NodeService 业务逻辑
依赖: Level 1, Level 2
关键文件: endless_daemon.py (get_registry, initialize_default_nodes)
```

### Level 4: API 层
```
优先级: P1
产出: RESTful 端点定义与 Mock 实现
依赖: Level 3
关键文件: 
- frontend/src/app/services/userService.ts
- frontend/src/app/components/AssetDetailModal.tsx (mockGraphifySearch)
```

### Level 5: 前端交互层
```
优先级: P2
产出: 查询界面、节点渲染、结果展示
依赖: Level 4
关键文件:
- frontend/src/app/components/flow/CustomNodes.tsx
- frontend/src/app/pages/WorkflowDesigner.tsx
```

### 开发顺序约束
```
Level 1 → Level 2 → Level 3 必须串行完成
Level 4 可与 Level 5 并行开发
Level 5 需 Level 4 提供 mock 接口
```

---

## 6. 文件修改清单

### 6.1 endless_daemon.py

**修改范围**:
- `GraphifyError` 类 (L121): 添加文档注释
- `NodeNotFoundError` 类 (L131): 添加文档注释
- `GraphifyNodeRegistry` 类 (L141): 增强空状态处理
- `get_nodes_by_type` 方法 (L344): 确保返回空数组而非异常
- `initialize_default_nodes` 函数 (L470): 确保默认节点正确初始化

**验收标准**:
- [x] AC-001: 无 "No matching nodes found" 错误提示
- [x] AC-002: AST 静态检查通过
- [x] AC-003: 所有类包含 docstring
- [x] AC-004: 模块可正常 import

### 6.2 frontend/src/app/components/AssetDetailModal.tsx

**修改范围**:
- `mockGraphifySearch` 函数 (L90): 修复空状态返回逻辑
- 空状态渲染组件: 显示友好提示而非错误
- Graphify 搜索集成: 确保协议兼容

**验收标准**:
- 搜索无结果时返回 `[]` 而非抛出异常
- UI 显示空状态友好提示
- Mock 延迟 < 200ms

### 6.3 frontend/src/app/components/flow/CustomNodes.tsx

**修改范围**:
- 节点类型定义: 与 Graphify GraphNodeType 对齐
- 节点渲染逻辑: 支持空状态展示
- 拖拽功能: 确保与图谱交互正常

**验收标准**:
- 节点正确渲染
- 支持属性编辑
- 空画布显示引导信息

### 6.4 frontend/src/app/pages/WorkflowDesigner.tsx

**修改范围**:
- 节点配置面板: 集成 Graphify 节点选择器
- 工作流保存: 关联图谱节点 ID
- 空状态处理: 正确显示无节点场景

**验收标准**:
- 可选择现有图谱节点
- 工作流保存后节点关联正确
- 空状态不显示技术错误

### 6.5 frontend/src/app/services/userService.ts

**修改范围**:
- 租户上下文提供: 确保 tenant_id 正确传递
- Graphify 查询增强: 携带租户信息

**验收标准**:
- getCurrentUser 返回正确租户 ID
- Graphify 查询携带租户过滤

---

## 附录 A: 关键接口签名

### Python 后端 (endless_daemon.py)

```python
class GraphNodeType(Enum):
    """节点类型枚举"""
    ASSET = "asset"
    PERSON = "person"
    LOCATION = "location"
    WORKFLOW = "workflow"
    CUSTOM = "custom"

class GraphNode:
    """图谱节点数据模型"""
    id: str
    node_type: GraphNodeType
    label: str
    properties: Dict[str, Any]
    metadata: Dict[str, Any]
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    version: int

class GraphifyError(Exception):
    """Graphify 服务异常基类"""
    pass

class NodeNotFoundError(GraphifyError):
    """节点未找到异常"""
    pass

class GraphifyNodeRegistry:
    """节点注册中心"""
    def __init__(self, tenant_id: str = "default"): ...
    def get_nodes_by_type(self, node_type: GraphNodeType, tenant_id: Optional[str] = None) -> List[GraphNode]: ...
    def search_nodes(self, query: str, filters: Optional[dict] = None) -> List[GraphNode]: ...
    def register_node(self, node: GraphNode) -> GraphNode: ...
    def update_node(self, node_id: str, properties: dict) -> GraphNode: ...
    def delete_node(self, node_id: str) -> bool: ...

def get_registry() -> GraphifyNodeRegistry: ...
def initialize_default_nodes() -> None: ...
```

### TypeScript 前端

```typescript
// types/flow.ts
interface GraphNode {
  id: string;
  nodeType: string;
  label: string;
  properties: Record<string, any>;
  metadata: Record<string, any>;
  tenantId: string;
}

interface GraphSearchResult {
  nodes: GraphNode[];
  total: number;
  query: string;
}

// services/userService.ts
interface UserContext {
  userId: string;
  tenantId: string;
  roles: string[];
}

// services/graphifyService.ts (待创建)
interface GraphNodeOptions {
  nodeType?: GraphNodeType;
  tenantId?: string;
  limit?: number;
}

function mockGraphifySearch(
  query: string,
  options?: GraphNodeOptions
): Promise<GraphSearchResult>;
```

---

## 附录 B: Mock 服务协议

```typescript
// mockGraphifySearch 实现规范
const mockGraphifySearch = async (
  query: string,
  options?: GraphNodeOptions
): Promise<GraphSearchResult> => {
  // 1. 模拟网络延迟（< 200ms）
  await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 50));
  
  // 2. 执行过滤逻辑
  let results = sampleNodes.filter(node => {
    const matchesQuery = node.label.toLowerCase().includes(query.toLowerCase());
    const matchesType = !options?.nodeType || node.nodeType === options.nodeType;
    const matchesTenant = !options?.tenantId || node.tenantId === options.tenantId;
    return matchesQuery && matchesType && matchesTenant;
  });
  
  // 3. 分页处理
  if (options?.limit) {
    results = results.slice(0, options.limit);
  }
  
  // 4. 返回结果（空数组而非错误）
  return {
    nodes: results,
    total: results.length,
    query
  };
};
```

---

## 附录 C: 错误消息映射

| 前端 Key | 后端错误码 | 用户提示 |
|----------|------------|----------|
| `graphify.no_nodes` | G001 | "暂无匹配数据" |
| `graphify.not_initialized` | G002 | "图谱服务初始化中" |
| `graphify.validation_failed` | G003 | "数据格式不正确" |
| `graphify.service_unavailable` | G004 | "服务暂时不可用" |

---

**文档结束**