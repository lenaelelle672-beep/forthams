# SWARM-103 遗留代码清理与 AC 验收准备 — 规格指导文档

**版本**: v2.0  
**迭代**: Sprint 4 收尾验收  
**状态**: 进行中  
**最后更新**: 2024-XX-XX

---

## 1. 需求与背景

### 1.1 业务背景

Sprint 4 进入收尾阶段，代码库中存在以下技术债务亟需清理：

1. **废弃接口残留**: 部分已标记 `@deprecated` 的接口仍活跃在调用链中，增加维护负担
2. **文档缺失**: `_index_properties()` 等核心方法缺少完整 docstring，影响新人 onboarding
3. **静态分析未闭环**: AST 静态分析存在未修复的告警项，阻碍 CI 流水线通过

### 1.2 技术债务来源

根据 Graphify 知识图谱提取结果：

| 节点标识 | 文件路径 | 行号 | 社区分类 | 现状描述 |
|----------|----------|------|----------|----------|
| `_index_properties()` | `src/endless_daemon.py` | L380 | community=1 (核心模块) | 索引节点属性以加快查找，无 docstring |
| `Toaster()` | `docs/figma/src/app/components/ui/sonner.tsx` | L6 | community=38 (UI 组件) | UI 组件，处于孤立状态 |

### 1.3 清理目标

确保代码库满足 Sprint 4 AC（Acceptance Criteria）验收标准：

| AC ID | 验收标准 | 验证方式 | 当前状态 |
|-------|----------|----------|----------|
| AC-001 | 移除废弃接口 | `ruff check --select=PLC,PLE` | ❌ 待修复 |
| AC-002 | 验证 Graphify 知识图谱节点 | AST 静态检查 | ✅ 通过 |
| AC-003 | AST 静态分析零告警 | `mypy` + `ruff` | ✅ 通过 |
| AC-004 | 核心方法 docstring 覆盖率 ≥ 95% | `pydocstyle` | ❌ 待修复 |
| AC-005 | 模块可正常 import 无 ImportError | `pytest` | ❌ 待修复 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解（基于 plan.md）

| Phase ID | 描述 | 依赖关系 | 本次 Spec 覆盖 |
|----------|------|----------|----------------|
| Phase 1 | 废弃接口识别与移除 | 前置 | ✅ |
| Phase 2 | Docstring 补全 | Phase 1 | ✅ |
| Phase 3 | AST 静态分析验证 | Phase 2 | ✅ |
| Phase 4 | AC 验收打包 | Phase 3 | 🔲 下一迭代 |

### 2.2 本次 Spec 核心目标

**完成 Phase 1~3 的完整实施，为 Sprint 4 AC 验收提供可验证的代码基线。**

关键约束：
- 仅清理 `src/` 目录下的 Python 文件
- 核心目标文件：`src/endless_daemon.py`（_index_properties 方法）
- 修复 `tests/fixtures/dead_code_s` 文件的 import 与 docstring 问题

---

## 3. 边界约束

### 3.1 约束清单

| 约束类型 | 约束描述 | 违规处理 |
|----------|----------|----------|
| **范围约束** | 仅清理 `src/` 目录下的 Python 文件和 `tests/` 下的相关 fixture | 禁止修改 `dist/`、`node_modules/` 等生成物 |
| **废弃接口约束** | 移除接口必须满足引用计数 = 0 | 若存在调用者，先重构再移除 |
| **Docstring 约束** | 补全的 docstring 必须符合 PEP 257 风格 | 需包含 Args、Returns、Raises 段落 |
| **静态分析约束** | AST 分析告警必须 100% 修复或显式 `noqa` 标注 | 不得抑制未解决的告警 |
| **回归约束** | 清理操作不得改变业务逻辑 | 清理前后功能测试结果必须一致 |

### 3.2 排除范围

- ❌ 不修改任何 `.pyi` 类型存根文件
- ❌ 不修改 `__init__.py` 中的公开 API 签名
- ❌ 不修改已通过验收的 feature 分支代码
- ❌ 不涉及 CI/CD 流水线配置
- ❌ 不涉及生产环境部署

---

## 4. 验收测试基准 (ATB)

### ATB-1: 废弃接口检测

**测试目标**: 验证 `src/` 目录无残留废弃接口

```bash
# 物理执行命令
ruff check src/ --select=PLC,PLE --ignore=D --output-format=concise
```

**期待结果**: 返回空（exit code 0），无 `undefined-name` 或 `unused-import` 告警

**验证脚本**:

```python
# tests/sprint4/test_deprecated_cleanup.py
def test_no_deprecated_in_src():
    """验证 src/ 目录无废弃接口告警
    
    ATB-1: 废弃接口检测
    期待: exit code 0, stdout 为空
    """
    result = subprocess.run(
        ["ruff", "check", "src/", "--select=PLC,PLE"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"废弃接口告警: {result.stdout}"
    assert "dead_code_s" not in result.stdout
```

---

### ATB-2: Docstring 覆盖率

**测试目标**: 验证核心方法 docstring 完整度

| 文件路径 | 方法名 | 预期 Docstring 状态 |
|----------|--------|---------------------|
| `src/endless_daemon.py` | `_index_properties()` | 存在且符合 PEP 257 |
| `tests/fixtures/dead_code_s` | 全部函数 | 存在 docstring |

**物理验证命令**:

```bash
# Python Docstring 检测
pydocstyle src/endless_daemon.py --count=100

# 覆盖率统计
cat src/endless_daemon.py | grep -c '"""'
```

**验证脚本**:

```python
# tests/sprint4/test_docstring_coverage.py
def test_index_properties_docstring():
    """验证 _index_properties 方法存在完整 docstring
    
    ATB-2: Docstring 覆盖率
    期待: docstring 存在且包含 Args、Returns
    """
    import inspect
    from endless_daemon import _index_properties
    
    docstring = inspect.getdoc(_index_properties)
    assert docstring is not None, "_index_properties 缺少 docstring"
    assert "Args:" in docstring or "args" in docstring.lower()
    assert "Returns:" in docstring or "return" in docstring.lower()
```

---

### ATB-3: AST 静态分析通过

**测试目标**: AST 静态分析零告警

```bash
# Python AST 检查
ruff check src/ --select=F,E --output-format=concise
mypy src/ --strict --no-error-summary
```

**期待结果**:
- `ruff check`: exit code 0
- `mypy`: exit code 0

**验证脚本**:

```python
# tests/sprint4/test_static_analysis.py
def test_ast_analysis_clean():
    """验证 AST 静态分析无告警
    
    ATB-3: AST 静态分析通过
    期待: ruff + mypy 均 exit code 0
    """
    ruff = subprocess.run(
        ["ruff", "check", "src/", "--select=F,E"],
        capture_output=True, text=True
    )
    assert ruff.returncode == 0, f"Ruff 告警: {ruff.stdout}"
    
    mypy = subprocess.run(
        ["mypy", "src/", "--strict"],
        capture_output=True, text=True
    )
    assert mypy.returncode == 0, f"Mypy 告警: {mypy.stdout}"
```

---

### ATB-4: 回归功能测试

**测试目标**: 清理前后业务逻辑一致

```bash
pytest tests/integration/ -v --tb=short -x
```

**期待结果**: 所有测试用例通过（exit code 0），覆盖率较清理前无下降

---

## 5. 开发切入层级序列

### 层级 1: 废弃接口识别与移除（Phase 1）

**目标文件**: `tests/fixtures/dead_code_s`

```
tests/fixtures/dead_code_s/
├── [废弃接口] — 移除
└── [未注释函数] — 补全 docstring
```

**执行步骤**:

1. 扫描 `tests/fixtures/dead_code_s`，识别废弃接口
2. 验证引用计数（引用计数 = 0 方可移除）
3. 执行移除并验证无回归
4. 修复 ImportError 问题

---

### 层级 2: Docstring 补全（Phase 2）

**优先级排序**:

| 优先级 | 文件 | 方法 | 现状 |
|--------|------|------|------|
| P0 | `src/endless_daemon.py` | `_index_properties()` | 无 docstring |
| P1 | `tests/fixtures/dead_code_s` | 全部函数 | 无 docstring |

**执行步骤**:

1. 补全 `src/endless_daemon.py` 中 `_index_properties()` 的 docstring
2. 根据知识图谱元数据补充 Args、Returns 段落
3. 补全 `tests/fixtures/dead_code_s` 中函数的 docstring
4. 运行 `pydocstyle` 验证

---

### 层级 3: AST 静态分析验证（Phase 3）

**执行顺序**:

1. 运行 `ruff check src/ --select=F,E` 定位问题
2. 逐项修复 F（Fatal）/ E（Error）级别告警
3. 运行 `mypy src/ --strict` 定位类型错误
4. 逐项修复类型不匹配问题
5. 验证 `exit code 0`

---

### 层级 4: AC 验收打包（Phase 4）— 下一迭代

**触发条件**: ATB-1~3 全部通过

**执行步骤**:

1. 生成清理报告 `sprint4-cleanup-report.md`
2. 更新 `plan.md` Phase 状态为 `[x]`
3. 提交 PR 并触发 CI 流水线

---

## 6. 附录: 文件修改清单

| 文件路径 | 操作类型 | 变更摘要 |
|----------|----------|----------|
| `src/endless_daemon.py` | Edit | `_index_properties()` 补全 docstring |
| `tests/fixtures/dead_code_s` | Edit | 移除废弃接口、补全 docstring、修复 import |
| `tests/sprint4/test_deprecated_cleanup.py` | Create | 废弃接口检测用例 |
| `tests/sprint4/test_docstring_coverage.py` | Create | Docstring 覆盖率用例 |
| `tests/sprint4/test_static_analysis.py` | Create | AST 静态分析用例 |

---

## 7. 执行检查清单

| # | 检查项 | 验证命令 | 状态 |
|---|--------|----------|------|
| 1 | `_index_properties()` 存在 docstring | `python -c "import inspect; from endless_daemon import _index_properties; print(inspect.getdoc(_index_properties))"` | ⬜ |
| 2 | `ruff check src/` 无告警 | `ruff check src/ --select=F,E` | ⬜ |
| 3 | `mypy src/` 通过 | `mypy src/ --strict` | ⬜ |
| 4 | `tests/fixtures/dead_code_s` import 正常 | `python -c "from tests.fixtures import dead_code_s"` | ⬜ |
| 5 | 全量 pytest 通过 | `pytest tests/sprint4/ -v` | ⬜ |

---

**⚠️ 强制落地指令**: 完成后必须在 `plan.md` 中更新 Phase 状态为 `[x]`，并生成 `sprint4-cleanup-report.md` 验收报告。

---

*本文档由 Agent Builder 自动生成，基于 SWARM-103 任务需求与 Graphify 知识图谱分析结果。*