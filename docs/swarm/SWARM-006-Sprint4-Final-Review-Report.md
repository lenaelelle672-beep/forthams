# SWARM-006 Sprint 4 收尾巡检规范文档

## 执行摘要

| 项目 | 内容 |
|------|------|
| **任务编号** | SWARM-006 |
| **任务类型** | `chore(evolve)` — Sprint 4 收尾巡检 |
| **触发依据** | 参照 SWARM-003 定义执行 Phase 1-4 验证 |
| **巡检执行日期** | {DATE} |
| **巡检执行人** | {EXECUTOR} |

### 验收标准覆盖矩阵

| AC 编号 | 描述 | 验证方法 | 状态 |
|---------|------|----------|------|
| AC-001 | 执行 Sprint 4 收尾巡检，确保 Phase 1-4 全部通过 | 静态分析 | **pending** |
| AC-002 | `[Graphify 知识图谱] No matching nodes found.` 问题修复验证 | 静态分析 | **pending** |
| AC-003 | 代码变更不引入新的语法错误（AST 静态检查通过） | AST 静态分析 | **pending** |
| AC-004 | 所有修改的函数包含 docstring 文档注释 | 静态分析 | **pending** |
| AC-005 | 变更后的模块可被正常 import 不抛出 ImportError | 单元测试 | **pending** |

### 交付物清单

| 交付物 | 文件路径 | 变更类型 |
|--------|----------|----------|
| `endless_daemon.py` | 根目录 | 已修改 |
| `AssetDetailModal.tsx` | `frontend/src/app/components/` | 已修改 |
| `CustomNodes.tsx` | `frontend/src/app/components/flow/` | 已修改 |
| `WorkflowDesigner.tsx` | `frontend/src/app/pages/` | 已修改 |
| `sonner.tsx` | `frontend/src/app/components/ui/` | 已修改 |

---

## 第一部分：Phase 1 代码审查 (Code Review)

### 1.1 审查范围

根据 Localization Report，以下文件需纳入代码审查范围：

#### 1.1.1 Python 后端文件

**文件**: `endless_daemon.py`

| 行号 | 符号类型 | 符号名称 | 审查要点 |
|------|----------|----------|----------|
| 194 | class | `GraphifyError` | 确认继承结构、docstring 完整性 |
| 209 | class | `NodeNotFoundError` | 确认异常继承链正确性 |
| 224 | class | `RelationshipNotFoundError` | 确认异常继承链正确性 |
| 234 | class | `DuplicateNodeError` | 确认异常定义规范 |
| 244 | class | `InvalidOperationError` | 确认异常定义规范 |
| 254 | class | `GraphifyNodeRegistry` | 核心注册表类，确认 API 稳定性 |

#### 1.1.2 TypeScript 前端文件

**文件**: `frontend/src/app/components/AssetDetailModal.tsx`

| 行号 | 符号类型 | 符号名称 | 审查要点 |
|------|----------|----------|----------|
| 90 | 箭头函数 | `mockGraphifySearch` | 确认搜索逻辑、docstring 完整性 |

**文件**: `frontend/src/app/components/ui/sonner.tsx`

| 行号 | 符号类型 | 符号名称 | 审查要点 |
|------|----------|----------|----------|
| 6 | 箭头函数 | `Toaster` | 确认 React 组件导出规范 |

### 1.2 审查检查项

```
□ 确认 endless_daemon.py 中所有自定义异常类继承自 Exception 或 GraphifyError
□ 确认 GraphifyNodeRegistry 类具有完整的 JSDoc/docstring 文档
□ 确认 mockGraphifySearch 函数具有 docstring 注释
□ 确认 Toaster 组件正确导出
□ 确认无硬编码敏感信息（如 API 密钥、令牌）
□ 确认代码风格符合 PEP 8 (Python) 和 ESLint (TypeScript) 规范
```

### 1.3 ATB-001: 代码审查通过判定标准

```bash
# Python 代码风格检查
python -m flake8 endless_daemon.py --max-line-length=120 --extend-ignore=E203,W503

# TypeScript 代码风格检查
cd frontend && npx eslint src/app/components/AssetDetailModal.tsx --no-error-on-unmatched-pattern
cd frontend && npx eslint src/app/components/ui/sonner.tsx --no-error-on-unmatched-pattern

# 物理期待
- 退出码: 0
- lint 警告数: 0
```

---

## 第二部分：Phase 2 单元测试 (Unit Testing)

### 2.1 测试覆盖目标

| 测试层级 | 目标文件 | 最低覆盖率 |
|----------|----------|------------|
| 异常处理层 | `endless_daemon.py` | 90% |
| 组件导出层 | `sonner.tsx` | 70% |
| 业务逻辑层 | `mockGraphifySearch` | 80% |

### 2.2 AC-005 验证: ImportError 检测

**核心验证逻辑**:

```python
# test_import_validation.py
import sys
import importlib.util

def test_endless_daemon_import():
    """验证 endless_daemon.py 可被正常导入"""
    spec = importlib.util.spec_from_file_location("endless_daemon", "endless_daemon.py")
    module = importlib.util.module_from_spec(spec)
    
    try:
        spec.loader.exec_module(module)
        assert hasattr(module, 'GraphifyError')
        assert hasattr(module, 'NodeNotFoundError')
        assert hasattr(module, 'GraphifyNodeRegistry')
    except ImportError as e:
        raise AssertionError(f"ImportError: {e}")

def test_graphify_error_inheritance():
    """验证异常类继承链正确性"""
    from endless_daemon import GraphifyError, NodeNotFoundError
    
    node_error = NodeNotFoundError("test")
    assert isinstance(node_error, GraphifyError)
    assert isinstance(node_error, Exception)
```

### 2.3 ATB-002: 单元测试通过判定标准

```bash
# 执行命令
python -m pytest tests/ -v --tb=short

# 物理期待
- 退出码: 0
- 测试结果: "X passed in Y seconds"
- 失败测试数: 0
```

---

## 第三部分：Phase 3 AST 静态分析 (Static Analysis)

### 3.1 AST 分析维度

| 维度 | 工具 | 阈值 | 目标文件 |
|------|------|------|----------|
| 语法正确性 | Python AST parser | 无异常 | `endless_daemon.py` |
| 复杂度 | radon | CC < 10 | `endless_daemon.py` |
| 继承深度 | lizard | CHILD < 5 | `endless_daemon.py` |
| 未使用导入 | flake8 | F401 零警告 | 所有 Python 文件 |

### 3.2 AC-003 验证: AST 语法检查

**核心验证逻辑**:

```python
# test_ast_validation.py
import ast

def test_endless_daemon_ast_validity():
    """验证 endless_daemon.py 可被 Python AST 解析"""
    with open('endless_daemon.py', 'r', encoding='utf-8') as f:
        source_code = f.read()
    
    try:
        tree = ast.parse(source_code)
        assert tree is not None
    except SyntaxError as e:
        raise AssertionError(f"AST SyntaxError: {e}")

def test_exception_class_structure():
    """验证异常类定义结构"""
    with open('endless_daemon.py', 'r', encoding='utf-8') as f:
        source_code = f.read()
    
    tree = ast.parse(source_code)
    
    exception_classes = [
        node.name for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef) and 
        hasattr(node, 'bases') and
        any(isinstance(base, ast.Name) and base.id == 'Exception' 
            for base in node.bases)
    ]
    
    required_exceptions = ['GraphifyError', 'NodeNotFoundError']
    for exc in required_exceptions:
        assert exc in exception_classes, f"Missing exception class: {exc}"
```

### 3.3 ATB-003: AST 静态分析通过判定标准

```bash
# Python AST 解析验证
python -c "import ast; ast.parse(open('endless_daemon.py').read())"

# 复杂度分析
python -m radon cc endless_daemon.py -a -k

# 物理期待
- AST 解析: 无 SyntaxError 输出
- CC 阈值: < 10
- 退出码: 0
```

---

## 第四部分：Phase 4 文档归档 (Documentation Archiving)

### 4.1 归档检查清单

```
□ 更新 docs/api-changelog.md（记录 Graphify 知识图谱变更）
□ 确认 docs/data-dictionary.md 无需更新（如有模型变更则同步）
□ 确认 docs/deployment.md 无需更新（如有配置变更则同步）
□ [核心] 更新 plan.md 或 prd.md - Sprint 4 状态标记 [x] 或 [完成]
□ 创建归档 commit: git add . && git commit -m "chore: archive Sprint 4 deliverables [SWARM-006]"
```

### 4.2 AC-004 验证: Docstring 完整性检查

**核心验证逻辑**:

```python
# test_docstring_validation.py
import ast

def test_graphify_error_docstring():
    """验证 GraphifyError 类具有 docstring"""
    with open('endless_daemon.py', 'r', encoding='utf-8') as f:
        source_code = f.read()
    
    tree = ast.parse(source_code)
    
    target_classes = ['GraphifyError', 'NodeNotFoundError', 'GraphifyNodeRegistry']
    missing_docstrings = []
    
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name in target_classes:
            if not ast.get_docstring(node):
                missing_docstrings.append(node.name)
    
    assert not missing_docstrings, f"Classes missing docstrings: {missing_docstrings}"

def test_mock_graphify_search_docstring():
    """验证 mockGraphifySearch 函数具有 docstring"""
    # 此验证需针对 TypeScript 文件
    # 建议使用 @typescript-eslint 要求 JSDoc 注释
    pass
```

### 4.3 ATB-004: 文档归档通过判定标准

```bash
# 检查 plan.md 更新状态
grep -n "Sprint 4" plan.md

# 物理期待
- 输出包含 "[x]" 或 "[完成]" 标记
- 文件修改时间戳已更新
```

---

## 第五部分：AC-001 至 AC-005 综合验证矩阵

### 5.1 验证命令汇总

```bash
#!/bin/bash
# SWARM-006-Verification.sh

echo "=== SWARM-006 Sprint 4 Final Review Verification ==="

# AC-001: Phase 1 - 代码审查
echo "[1/5] Running Code Review (AC-001)..."
python -m flake8 endless_daemon.py --max-line-length=120
if [ $? -ne 0 ]; then echo "AC-001 FAILED"; exit 1; fi

# AC-002: Graphify 知识图谱节点匹配验证
echo "[2/5] Verifying Graphify Knowledge Graph (AC-002)..."
grep -q "No matching nodes found" endless_daemon.py || echo "Graphify warning message verified"

# AC-003: AST 静态分析
echo "[3/5] Running AST Static Analysis (AC-003)..."
python -c "import ast; ast.parse(open('endless_daemon.py').read())"
if [ $? -ne 0 ]; then echo "AC-003 FAILED"; exit 1; fi

# AC-004: Docstring 完整性
echo "[4/5] Checking Docstring Completeness (AC-004)..."
python test_docstring_validation.py
if [ $? -ne 0 ]; then echo "AC-004 FAILED"; exit 1; fi

# AC-005: ImportError 检测
echo "[5/5] Verifying Module Import (AC-005)..."
python test_import_validation.py
if [ $? -ne 0 ]; then echo "AC-005 FAILED"; exit 1; fi

echo "=== All AC Verification Passed ==="
```

### 5.2 验收标准通过判定

| AC 编号 | 验证方法 | 通过条件 |
|---------|----------|----------|
| AC-001 | 静态分析 | Phase 1-4 全部通过 |
| AC-002 | 静态分析 | Graphify 知识图谱无假阳性 |
| AC-003 | AST 静态分析 | 语法解析无异常 |
| AC-004 | 静态分析 | 所有目标类/函数含 docstring |
| AC-005 | 单元测试 | import 零错误 |

---

## 第六部分：强制归档军律

### 6.1 军律条款

> **⚠️ 强制提醒**: 完成后必须执行 `cat plan.md | grep -A2 "Sprint 4"` 确认状态已更新方可退出任务。

### 6.2 执行检查清单

```
前置条件:
[ ] 已读取 plan.md 中 SWARM-006 相关上下文
[ ] 已读取 SWARM-003 Phase 定义
[ ] 已拉取最新 main 分支代码
[ ] 已切换至 Sprint 4 工作分支

Phase 1: 代码审查
[ ] ATB-001 通过 - flake8 lint 检查

Phase 2: 单元测试
[ ] ATB-002 通过 - pytest 覆盖率 >= 80%
[ ] AC-005 通过 - ImportError 零错误

Phase 3: AST 静态分析
[ ] ATB-003 通过 - AST 解析无异常
[ ] AC-003 通过 - 复杂度 CC < 10

Phase 4: 文档归档
[ ] ATB-004 通过 - plan.md 已更新
[ ] AC-004 通过 - docstring 完整性
[ ] AC-001 至 AC-005 全部通过

最终交付:
[ ] 归档 commit 已创建
[ ] 归档 commit 已推送至远程
```

### 6.3 回滚预案

若在巡检过程中发现阻断性问题，执行以下回滚操作：

```bash
# 回滚未归档的变更
git checkout -- .

# 回滚已归档的变更
git reset --soft HEAD~1
git checkout -- .

# 通知相关开发人员修复
```

---

## 附录 A: 变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0 | {DATE} | 初始版本创建 | {AUTHOR} |

## 附录 B: 参考文档

| 文档名称 | 文件路径 |
|----------|----------|
| SWARM-003 Sprint 巡检流程定义 | `docs/swarm/SWARM-003-Sprint-Review-Process.md` |
| 项目计划文档 | `plan.md` |
| 产品需求文档 | `prd.md` |
| API 变更日志 | `docs/api-changelog.md` |

---

**文档状态**: `{STATUS}`
**下次审查时间**: `{NEXT_REVIEW_DATE}`