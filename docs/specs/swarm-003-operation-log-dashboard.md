# SWARM-003 操作日志仪表板 - 规格指导文档

## 版本信息

| 字段 | 值 |
|------|-----|
| 任务编号 | SWARM-003 |
| 迭代版本 | Iteration 1 |
| 文档状态 | Active |
| 制定日期 | 2025-01-23 |
| 核心问题 | [Graphify 知识图谱] No matching nodes found. |

---

## 1. 需求与背景

### 1.1 业务需求

随着 Graphify 知识图谱系统运行时间的增长，系统产生大量操作日志与审计数据。现阶段这些数据以结构化记录形式存储，但缺乏直观的可视化呈现手段，导致运维人员与安全审计人员难以快速把握以下关键信息：

- **操作频率趋势**：识别异常高频操作模式
- **风险事件分布**：定位高风险操作类型与时间窗口
- **用户行为画像**：审计特定用户的操作轨迹
- **系统健康状态**：通过操作日志反推系统稳定性

### 1.2 核心问题分析

```
当前症状: [Graphify 知识图谱] No matching nodes found.
影响范围: 前端知识图谱组件无法渲染审计日志节点
根因假设: 
  1. useAuditLog hook 返回的数据格式与 Graphify 节点生成器预期不匹配
  2. auditableFieldMap.ts 配置的字段映射不完整，导致节点属性缺失
  3. convertAuditLogsToGraphifyNodes 函数对空数组/undefined 输入处理异常
```

### 1.3 核心目标

构建独立的 **操作日志仪表板 (Operation Log Dashboard)**，实现审计数据的可视化与趋势分析能力，同时修复 Graphify 知识图谱节点匹配问题。

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

参照 plan.md 的 Phase 拆解，**SWARM-003 Iteration 1** 对准 **Phase 1: 核心仪表板框架与基础可视化**。

### 2.2 Phase 1 交付范围

| 序号 | 交付物 | 描述 | 状态 |
|------|--------|------|------|
| P1-01 | 修复 Graphify 节点生成逻辑 | `convertAuditLogsToGraphifyNodes` 函数空值处理修复 | ⏳ pending |
| P1-02 | 完善审计字段映射配置 | `auditableFieldMap.ts` 补充缺失的字段映射 | ⏳ pending |
| P1-03 | 知识图谱组件优化 | `GraphifyKnowledgeGraph.tsx` 添加加载与错误状态处理 | ⏳ pending |
| P1-04 | 样式文件更新 | `audit-highlight.css` 添加知识图谱相关样式 | ⏳ pending |
| P1-05 | 单元测试覆盖 | `convertAuditLogsToGraphifyNodes.test.ts` 完整测试用例 | ⏳ pending |

---

## 3. 边界约束

### 3.1 技术边界

| 约束项 | 具体限制 |
|--------|----------|
| 数据源依赖 | 仅对接 Graphify 现有审计日志数据结构 |
| 运行时依赖 | React 18+, TypeScript 5.x, ECharts 5.x |
| 浏览器兼容性 | Chrome 90+, Firefox 90+, Safari 14+ |

### 3.2 功能边界

| 边界类型 | 说明 |
|----------|------|
| **不包含** | 日志的增删改操作（仅读） |
| **不包含** | 日志全文检索（Elasticsearch 集成） |
| **不包含** | 告警触发与通知推送 |
| **不包含** | 跨租户数据隔离（当前为单租户场景） |

### 3.3 安全边界

- 仪表板访问需通过既有的身份认证中间件
- 敏感字段（如用户密码变更详情）需脱敏后展示
- API 响应禁止包含原始 SQL 语句

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-001: Graphify 节点生成验证 (单元测试)

**验证方法**: `pytest` 单元测试  
**状态**: pending  
**关键性**: Critical

```python
# tests/unit/audit/test_graphify_nodes.py

class TestConvertAuditLogsToGraphifyNodes:
    """
    ATB-001: 验证 convertAuditLogsToGraphifyNodes 函数正确性
    
    测试场景覆盖:
    1. 正常审计日志数组转换为 Graphify 节点
    2. 空数组输入应返回资产根节点（当 assetId 有效时）
    3. undefined/null 输入应返回空数组或资产根节点
    4. 大数据集（100+ 条）的批量转换性能
    5. 节点属性完整性验证
    """
    
    def test_convert_with_valid_audit_logs(self, sample_audit_logs, expected_nodes):
        """ATB-001: 验证有效审计日志正确转换为 Graphify 节点"""
        result = convertAuditLogsToGraphifyNodes(sample_audit_logs, "asset-001")
        
        assert len(result) > 0
        assert all(hasattr(node, 'id') for node in result)
        assert all(hasattr(node, 'type') for node in result)
        assert all(hasattr(node, 'label') for node in result)
    
    def test_convert_empty_array_returns_asset_root_node(self, asset_id):
        """ATB-001: 空数组应返回资产根节点（不是空数组）"""
        result = convertAuditLogsToGraphifyNodes([], asset_id)
        
        # ATB-BC-001: 即使 auditLogs 为空，也应返回资产根节点
        assert len(result) == 1
        assert result[0].id == f"asset-{asset_id}"
        assert result[0].type == "asset"
    
    def test_convert_null_input_returns_empty_or_root(self, asset_id):
        """ATB-001: null/undefined 输入应防御性处理"""
        # 测试 undefined
        result_undefined = convertAuditLogsToGraphifyNodes(undefined, asset_id)
        assert isinstance(result_undefined, list)
        
        # 测试 null
        result_null = convertAuditLogsToGraphifyNodes(None, asset_id)
        assert isinstance(result_null, list)
    
    def test_node_properties_completeness(self, sample_audit_logs):
        """ATB-001: 验证生成的节点包含所有必需属性"""
        result = convertAuditLogsToGraphifyNodes(sample_audit_logs, "asset-001")
        
        for node in result:
            assert node.id is not None
            assert node.type in ['asset', 'operation', 'user', 'field']
            assert node.label is not None
            assert hasattr(node, 'x') and hasattr(node, 'y')
```

### 4.2 ATB-002: AST 静态检查 (代码质量验证)

**验证方法**: `静态分析`  
**状态**: pending  
**关键性**: Critical

```python
# tests/test_ast_analyzer.py

def test_graphify_related_files_syntax_valid():
    """
    ATB-002: 验证所有 Graphify 相关文件的 AST 解析不报错
    
    目标文件:
    - frontend/src/hooks/useAuditLog.ts
    - frontend/src/components/audit/GraphifyKnowledgeGraph.tsx
    - frontend/src/pages/AssetDetailPage/config/auditableFieldMap.ts
    """
    files_to_check = [
        "frontend/src/hooks/useAuditLog.ts",
        "frontend/src/components/audit/GraphifyKnowledgeGraph.tsx",
        "frontend/src/pages/AssetDetailPage/config/auditableFieldMap.ts",
        "frontend/src/styles/audit-highlight.css",
    ]
    
    for file_path in files_to_check:
        result = ast.parse_file(file_path)
        assert result.success, f"AST parse failed for {file_path}: {result.error}"
        assert result.error_count == 0, f"Syntax errors in {file_path}: {result.errors}"
```

### 4.3 ATB-003: Docstring 文档注释验证

**验证方法**: `静态分析`  
**状态**: pending  
**关键性**: Non-critical

```python
# tests/test_docstring_coverage.py

def test_modified_functions_have_docstrings():
    """
    ATB-003: 所有修改的函数必须包含 docstring 文档注释
    
    检查的函数:
    - convertAuditLogsToGraphifyNodes (useAuditLog.ts)
    - validateGraphifyNodes (useAuditLog.ts)
    - validateGraphifyNodesDetailed (useAuditLog.ts)
    - GraphifyKnowledgeGraph 组件 (GraphifyKnowledgeGraph.tsx)
    """
    target_functions = [
        ("frontend/src/hooks/useAuditLog.ts", "convertAuditLogsToGraphifyNodes"),
        ("frontend/src/hooks/useAuditLog.ts", "validateGraphifyNodes"),
        ("frontend/src/hooks/useAuditLog.ts", "validateGraphifyNodesDetailed"),
        ("frontend/src/components/audit/GraphifyKnowledgeGraph.tsx", "GraphifyKnowledgeGraph"),
    ]
    
    for file_path, function_name in target_functions:
        func_def = ast.find_function(file_path, function_name)
        assert func_def is not None, f"Function {function_name} not found in {file_path}"
        assert func_def.docstring is not None, f"Missing docstring for {function_name}"
        assert len(func_def.docstring) >= 20, f"Docstring too short for {function_name}"
```

### 4.4 ATB-004: 模块 Import 验证

**验证方法**: `单元测试`  
**状态**: pending  
**关键性**: Critical

```python
# tests/test_import_validation.py

def test_useauditlog_imports_valid():
    """
    ATB-004: 变更后的 useAuditLog 模块可被正常 import
    
    验证:
    1. 模块导出所有必需的函数
    2. 导入时不会抛出 ImportError
    3. 类型定义完整
    """
    # 模拟导入测试
    module_path = "frontend/src/hooks/useAuditLog.ts"
    
    # 检查导出列表
    exports = extract_named_exports(module_path)
    required_exports = [
        "convertAuditLogsToGraphifyNodes",
        "validateGraphifyNodes", 
        "validateGraphifyNodesDetailed",
        "useAuditLog",  # React hook
    ]
    
    for export_name in required_exports:
        assert export_name in exports, f"Missing export: {export_name}"

def test_auditable_field_map_imports_valid():
    """ATB-004: auditableFieldMap 模块导入验证"""
    module_path = "frontend/src/pages/AssetDetailPage/config/auditableFieldMap.ts"
    
    # 验证文件可被解析
    result = parse_typescript(module_path)
    assert result.success, f"Parse failed: {result.error}"
    
    # 验证导出的配置对象结构
    config = load_module(module_path)
    assert hasattr(config, 'fieldMappings')
    assert hasattr(config, 'operationTypes')
```

---

## 5. 开发切入层级序列

### 5.1 层级架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (展示层)                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  GraphifyKnowledgeGraph.tsx                     │   │
│  │  - 知识图谱可视化组件                             │   │
│  │  - 节点渲染、边连接、交互事件                      │   │
│  │  - 加载状态、错误状态、空状态处理                   │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                    Hook Layer (钩子层)                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  useAuditLog.ts                                 │   │
│  │  - convertAuditLogsToGraphifyNodes()            │   │
│  │  - validateGraphifyNodes()                      │   │
│  │  - 节点生成与验证逻辑                             │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                    Config Layer (配置层)                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  auditableFieldMap.ts                           │   │
│  │  - 字段映射配置                                  │   │
│  │  - 操作类型定义                                  │   │
│  │  - 风险等级映射                                  │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                    Style Layer (样式层)                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  audit-highlight.css                            │   │
│  │  - 知识图谱节点样式                              │   │
│  │  - 交互高亮效果                                  │   │
│  │  - 动画过渡效果                                  │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                    Test Layer (测试层)                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  convertAuditLogsToGraphifyNodes.test.ts        │   │
│  │  - 单元测试覆盖                                  │   │
│  │  - 边界条件测试                                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 5.2 修复序列（按依赖顺序）

| 阶段 | 层级 | 任务项 | 依赖关系 |
|------|------|--------|----------|
| **Step 1** | Config | 审查并完善 `auditableFieldMap.ts` 字段映射配置 | 无 |
| **Step 2** | Hook | 修复 `convertAuditLogsToGraphifyNodes` 空值处理逻辑 | Step 1 |
| **Step 3** | Hook | 完善 `validateGraphifyNodes` 验证函数 | Step 2 |
| **Step 4** | Hook | 添加 `validateGraphifyNodesDetailed` 详细验证 | Step 3 |
| **Step 5** | UI | 优化 `GraphifyKnowledgeGraph.tsx` 组件状态处理 | Step 4 |
| **Step 6** | Style | 更新 `audit-highlight.css` 添加知识图谱样式 | Step 5 |
| **Step 7** | Test | 编写 `convertAuditLogsToGraphifyNodes.test.ts` 完整测试 | Step 2 |

### 5.3 核心问题修复方案

#### 5.3.1 节点匹配问题根因分析

```typescript
// 当前问题代码 (useAuditLog.ts L75-94)
export function convertAuditLogsToGraphifyNodes(
  auditLogs: AuditLogEntry[] | undefined | null,
  assetId: string,
  options: ConvertOptions = {}
): GraphifyNode[] {
  // 问题1: 空数组直接返回 []，导致知识图谱无节点可渲染
  if (!auditLogs || auditLogs.length === 0) {
    return [];  // ❌ 应该返回资产根节点
  }
  // ... 后续逻辑
}
```

#### 5.3.2 修复方案

```typescript
// 修复后代码
export function convertAuditLogsToGraphifyNodes(
  auditLogs: AuditLogEntry[] | undefined | null,
  assetId: string,
  options: ConvertOptions = {}
): GraphifyNode[] {
  // ATB-BC-001: 防御性检查 - 处理空数组和 undefined 输入
  if (!auditLogs || auditLogs.length === 0) {
    // ✅ 即使 auditLogs 为空，也应返回资产根节点
    if (assetId && assetId.trim() !== '') {
      return [{
        id: `asset-${assetId}`,
        type: 'asset',
        label: '资产',
        x: options.centerX ?? 400,
        y: options.centerY ?? 300,
        properties: { assetId }
      }];
    }
    return [];
  }
  
  // 后续正常转换逻辑...
  const nodes: GraphifyNode[] = [];
  const centerX = options.centerX ?? 400;
  const centerY = options.centerY ?? 300;
  
  // 添加资产根节点
  nodes.push({
    id: `asset-${assetId}`,
    type: 'asset',
    label: '资产',
    x: centerX,
    y: centerY,
    properties: { assetId }
  });
  
  // 转换审计日志为操作节点...
  // ...
  
  return nodes;
}
```

### 5.4 auditableFieldMap.ts 审查清单

```typescript
// 必须包含的字段映射
export const auditableFieldMap = {
  // 基础字段
  assetId: { type: 'string', label: '资产ID' },
  assetName: { type: 'string', label: '资产名称' },
  assetCode: { type: 'string', label: '资产编码' },
  
  // 操作类型
  operationTypes: {
    CREATE: { label: '创建', riskLevel: 'LOW' },
    UPDATE: { label: '更新', riskLevel: 'MEDIUM' },
    DELETE: { label: '删除', riskLevel: 'HIGH' },
    APPROVE: { label: '审批', riskLevel: 'MEDIUM' },
    REJECT: { label: '驳回', riskLevel: 'MEDIUM' },
    TRANSFER: { label: '转移', riskLevel: 'HIGH' },
    DISPOSE: { label: '处置', riskLevel: 'CRITICAL' },
  },
  
  // Graphify 节点属性映射
  nodeMapping: {
    userId: 'user',
    operationType: 'operation',
    timestamp: 'time',
    resourceId: 'resource',
  },
  
  // ✅ 确保包含 Graphify 所需的属性
  graphifyProperties: {
    id: 'id',
    type: 'nodeType',
    label: 'displayName',
    x: 'positionX',
    y: 'positionY',
  }
};
```

---

## 6. 附录

### 6.1 关键文件清单

| 文件路径 | 修改类型 | 优先级 | 负责人 |
|----------|----------|--------|--------|
| `frontend/src/hooks/useAuditLog.ts` | 修改 | P0 - Critical | - |
| `frontend/src/pages/AssetDetailPage/config/auditableFieldMap.ts` | 修改 | P0 - Critical | - |
| `frontend/src/components/audit/GraphifyKnowledgeGraph.tsx` | 修改 | P1 - High | - |
| `frontend/src/styles/audit-highlight.css` | 修改 | P2 - Medium | - |
| `frontend/tests/unit/audit/convertAuditLogsToGraphifyNodes.test.ts` | 修改 | P0 - Critical | - |

### 6.2 类型定义参考

```typescript
// GraphifyNode 类型定义
interface GraphifyNode {
  id: string;           // 节点唯一标识
  type: 'asset' | 'operation' | 'user' | 'field' | 'risk';
  label: string;        // 显示标签
  x: number;            // X 坐标
  y: number;            // Y 坐标
  properties: Record<string, unknown>;
}

// AuditLogEntry 类型定义
interface AuditLogEntry {
  id: string;
  userId: string;
  operationType: string;
  resourceType: string;
  resourceId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  changes?: FieldChange[];
}

// FieldChange 类型定义
interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}
```

### 6.3 测试执行命令

```bash
# 运行 Graphify 节点生成单元测试
cd frontend
npm run test -- --testPathPattern="convertAuditLogsToGraphifyNodes"

# 运行 AST 静态检查
cd tests
python -m pytest test_ast_analyzer.py -v

# 运行 Docstring 覆盖率检查
python -m pytest test_docstring_coverage.py -v

# 运行 Import 验证
python -m pytest test_import_validation.py -v
```

---

*本规格文档为 SWARM-003 Iteration 1 的唯一执行基准，所有开发与测试活动须严格对齐本文档定义的范围与验收标准。*

**文档维护记录**:

| 日期 | 版本 | 修改内容 | 作者 |
|------|------|----------|------|
| 2025-01-23 | 1.0 | 初始版本创建 | - |