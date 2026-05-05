# SWARM-103 遗留代码清理与 AC 验收准备 — 规格指导文档

**Iteration**: 6  
**状态**: 启动  
**关联文档**: plan.md (Sprint 4 Phase 拆解)

---

## 1. 需求与背景

### 1.1 业务背景

Graphify 知识图谱项目进入 Sprint 4 收尾阶段，存在以下技术债务项待处理：

| 债务项 | 位置 | 类型 | 优先级 |
|--------|------|------|--------|
| `._index_properties()` | `src/endless_daemon.py` L380 | 未完成内部方法 | P1 |
| `Toaster()` | `docs/figma/src/app/components/ui/sonner.tsx` L6 | 未完成组件消费 | P2 |
| Docstring 覆盖率不足 | 全局 | 文档缺失 | P1 |
| AST 静态分析阻塞 | 全局 | lint 规则未对齐 | P0 |

### 1.2 技术目标

| 目标 | 验收条件 | 关联 AC |
|------|----------|---------|
| 移除废弃接口 | 代码库中无 dangling reference | AC-001 |
| Graphify NODE 节点验证 | NODE 注册状态与 AST REPOSITORY MAP 一致 | AC-002 |
| AST 静态分析通过 | `ruff` / `flake8` 零 error | AC-003 |
| Docstring 补全 | `pydocstyle` / `pylint` 检查通过率 100% | AC-004 |
| 模块可正常 import | 无 ImportError | AC-005 |

---

## 2. 当前 Phase 对应实施目标

**参照 plan.md Phase 拆解，本任务对准 Sprint 4 Phase 3: 技术债务清理与验收准备**

```
Sprint 4
├── Phase 1: 核心逻辑开发 ✅
├── Phase 2: 集成测试 ✅
└── Phase 3: 技术债务清理与验收准备 🔄 [本次目标]
    ├── [ ] 废弃接口移除/补全
    ├── [ ] Docstring 全局审计
    ├── [ ] AST 静态分析验证
    └── [ ] plan.md 落地记账
```

### 2.1 本次具体目标

| 目标编号 | 描述 | 交付物 |
|----------|------|--------|
| OBJ-3.1 | 决策 `._index_properties()` 存废并执行 | 代码变更 + 测试覆盖 |
| OBJ-3.2 | 决策 `Toaster` 组件消费链路 | 代码变更或移除证明 |
| OBJ-3.3 | 全局 docstring 审计与补全 | pydocstyle 输出: 0 errors |
| OBJ-3.4 | AST 静态分析验证 | ruff check 输出: 0 errors |
| OBJ-3.5 | plan.md 落地记账 | Phase 3 行标记 `[x]` |

---

## 3. 边界约束

### 3.1 代码层约束

```
┌─────────────────────────────────────────────────────────────┐
│ 边界类型        │ 约束                                        │
├────────────────┼─────────────────────────────────────────────┤
│ 扫描范围        │ src/ + docs/ (不含 node_modules/.venv/)     │
│ 禁止破坏性修改  │ 不得删除尚未审计的 module 公共 API           │
│ 回滚要求        │ 任何破坏性变更前必须已有等效测试覆盖         │
│ 核心业务流入口  │ 不得修改非 spec 指定的文件                   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 分析工具约束

| 工具 | 规则集 | 允许级别 | 配置来源 |
|------|--------|----------|----------|
| ruff | E,F,W | error=0, warning≤10 | pyproject.toml / ruff.toml |
| flake8 | E501,W503,E203 | 零 block 级 error | .flake8 |
| pylint | docstring-convention | missing-docstring=0 (公共 API) | pyproject.toml |
| pydocstyle | D100-D499 | 零 error | setup.cfg |

### 3.3 Docstring 补全范围

| 节点类型 | 要求等级 | 格式规范 |
|----------|----------|----------|
| 公共类/函数/方法 | 必须 | Args/Returns/Raises 完整 |
| 私有方法（`_` 前缀） | 必须 | 至少一行描述性 docstring |
| 常量/配置 | 必须 | 类型标注 + 一行说明 |
| Arrow Function 组件 | 必须 | JSDoc 或 TSDoc 格式 |

---

## 4. 验收测试基准 (ATB)

### 4.1 接口存废决策测试

#### ATB-4.1.1 `._index_properties()` 存废验证

**被测目标**: `src/endless_daemon.py::_index_properties()`  
**输入动作**: 静态分析调用图 + pytest 覆盖率扫描  
**物理期待**:

```bash
# 场景 A（保留）：必须有完整 docstring + 单元测试
pytest tests/sprint4/test_deprecated_cleanup.py -v -k "index_properties"
# 期待: PASSED

# 场景 B（废弃）：零残留 reference
grep -rn "_index_properties" src/ --include="*.py"
# 期待: 仅自身定义行（若有），无其他 import/reference
```

#### ATB-4.1.2 `Toaster` 组件消费链路验证

**被测目标**: `docs/figma/src/app/components/ui/sonner.tsx::Toaster`  
**输入动作**: 检查 import 声明 + 搜索消费点  
**物理期待**:

```bash
# 场景 A（保留）：必须存在消费调用
grep -rn "Toaster" docs/figma/src/app/ --include="*.tsx" --include="*.jsx"
# 期待输出: ≥2 行（含 import 声明 + 至少一处 <Toaster /> 调用）

# 场景 B（废弃）：移除 import 后无残留
cat docs/figma/src/app/components/ui/sonner.tsx 2>/dev/null
# 期待: No such file 或文件内容不含 Toaster import
```

### 4.2 Docstring 覆盖率测试

#### ATB-4.2.1 pydocstyle 验证

```bash
pydocstyle src/ docs/ --count --output-format=text
```

| 期待结果 | 说明 |
|----------|------|
| `Total errors: 0` | 所有 Python 文件 docstring 检查通过 |

#### ATB-4.2.2 pylint docstring 验证

```bash
pylint src/ --disable=all --enable=missing-docstring,empty-docstring
```

| 期待结果 | 说明 |
|----------|------|
| `公共 API missing-docstring: 0` | 无公共 API 缺失 docstring |

### 4.3 AST 静态分析测试

#### ATB-4.3.1 ruff 验证

```bash
ruff check src/ docs/ --select=E,F,W --output-format=concise
```

| 期待结果 | 处理方式 |
|----------|----------|
| `Found 0 errors.` | 全部通过 |
| `Found N errors.` | 立即修复 E/F 类 error，评估 W 类 warning |

#### ATB-4.3.2 flake8 验证

```bash
flake8 src/ docs/ --max-line-length=120 --extend-ignore=E501,W503
```

| 期待结果 | 说明 |
|----------|------|
| `0 errors` | 无 block 级错误 |

### 4.4 模块可导入性测试

#### ATB-4.4.1 Python 模块验证

```bash
python -c "from src.endless_daemon import GraphifyDaemon; print('OK')"
```

| 期待结果 | 说明 |
|----------|------|
| `OK` | 无 ImportError / ModuleNotFoundError |

#### ATB-4.4.2 TypeScript 模块验证（若有）

```bash
cd docs/figma && npx tsc --noEmit
```

| 期待结果 | 说明 |
|----------|------|
| `exit code 0` | 无 TypeScript 编译错误 |

### 4.5 文档落地验证

**被测目标**: `plan.md`  
**输入动作**: 读取 Sprint 4 Phase 3 节点  

```markdown
期待格式:
- [x] Sprint 4 Phase 3: 技术债务清理与验收准备 (完成日期: YYYY-MM-DD, commit: <hash>)
```

---

## 5. 开发切入层级序列

### Level 0: 环境就绪

```bash
# 确认工具链可用
python -m pip list | grep -E "ruff|flake8|pylint|pydocstyle"
node -v && npm list | grep -E "typescript|eslint"

# 克隆最新代码
git pull origin main
```

### Level 1: 调用图分析（存废决策）

**优先级**: P0 | **输出**: 决策矩阵

#### 1.1 `._index_properties()` 调用分析

```bash
# 方式 A: pydeps 依赖图
pydeps src/endless_daemon.py --show-raw-deps --max-depth=2

# 方式 B: ripgrep 引用扫描
rg "_index_properties" src/ --type py -n
```

#### 1.2 `Toaster` 消费链路分析

```bash
# 扫描所有潜在消费点
rg "from.*sonner|import.*Toaster|<Toaster" docs/figma/src/ -t tsx -n
```

#### 1.3 决策矩阵输出

| 方法/组件 | 调用次数 | 定义行 | 决定 | 理由 |
|-----------|----------|--------|------|------|
| `._index_properties()` | N | L380 | 保留/废弃 | TODO |
| `Toaster` | N | L6 | 保留/废弃 | TODO |

### Level 2: 执行存废操作

**优先级**: P0 | **约束**: 破坏性操作前必须有等效测试覆盖

#### 2.1 若选择保留

```python
# 补全 docstring 示例 (endless_daemon.py)
def _index_properties(self) -> None:
    """
    Rebuild the property index for all registered nodes.
    
    This method is called during maintenance cycles to ensure
    the property index remains consistent with the node registry.
    
    Returns:
        None: Modifies internal state in-place.
    
    Raises:
        RuntimeError: If the index rebuild fails due to corruption.
    """
    # implementation...
```

#### 2.2 若选择废弃

```bash
# Step 1: 移除定义
# 编辑 endless_daemon.py，删除 _index_properties 方法

# Step 2: 移除所有引用
rg "_index_properties" src/ -t py --delete

# Step 3: 验证零残留
rg "_index_properties" src/ docs/ --type py --type tsx
# 期待: (no matches)
```

### Level 3: Docstring 全局审计

**优先级**: P1 | **工具**: pydocstyle, pylint

#### 3.1 首次扫描获取基线

```bash
# 生成基线报告
pydocstyle src/ docs/ --count > /tmp/docstring_baseline.txt
cat /tmp/docstring_baseline.txt
```

#### 3.2 按 module 逐个修复

修复优先级:
```
1. src/endless_daemon.py (核心业务逻辑)
2. scripts/ast_dead_code_check.py (工具脚本)
3. tests/*.py (测试文件)
4. backend/src/main/java/... (Java 文件按需)
5. docs/figma/src/app/... (前端组件)
```

#### 3.3 增量验证

```bash
# 每修复一个文件，执行验证
pydocstyle src/endless_daemon.py
# 期待: (no errors)
```

### Level 4: AST 静态分析调优

**优先级**: P1 | **工具**: ruff, flake8

#### 4.1 首次全量扫描

```bash
ruff check src/ docs/ > /tmp/ruff_baseline.txt
cat /tmp/ruff_baseline.txt
```

#### 4.2 分类处理策略

| 类别 | 定义 | 处理方式 |
|------|------|----------|
| E (Error) | 语法/语义错误 | 立即修复 |
| F (Fatal) | 致命问题 | 立即修复 |
| W (Warning) | 风格建议 | 评估后修复或添加到 ignore |

#### 4.3 误报配置（可选）

```toml
# pyproject.toml 或 ruff.toml
[tool.ruff.lint]
ignore = [
    "E501",  # 若行长度限制过严
    "W503",  # 若与格式化工具冲突
]
```

### Level 5: 回归验证

**优先级**: P0 | **必须全部通过**

```bash
# Step 1: 完整测试套件
pytest tests/ -v --tb=short

# Step 2: 完整静态分析
ruff check src/ docs/ && \
flake8 src/ docs/ --max-line-length=120 && \
pydocstyle src/ docs/

# Step 3: 模块导入验证
python -c "from src.endless_daemon import *; print('Import OK')"
```

### Level 6: 文档落地记账

**优先级**: P0 | **最后一步，不可跳过**

#### 6.1 更新 plan.md

```diff
- - [ ] Sprint 4 Phase 3: 技术债务清理与验收准备
+ - [x] Sprint 4 Phase 3: 技术债务清理与验收准备 (完成日期: 2024-XX-XX, commit: abc1234)
```

#### 6.2 Git Commit 规范

```bash
git add -A
git commit -m "fix(swarm-103): complete legacy code cleanup and AC preparation

- Remove/deprecate ._index_properties() dangling reference
- Fix Toaster component consumption chain
- Add docstring coverage for public APIs
- Pass ruff/flake8/pydocstyle static analysis

AC-001 ✅ | AC-002 ✅ | AC-003 ✅ | AC-004 ✅ | AC-005 ✅"
```

#### 6.3 Push 与 CI 触发

```bash
git push origin HEAD
# 等待 CI pipeline 完成
```

---

## 附录 A: 执行检查清单

| # | 检查项 | 通过标准 | 执行人 | 时间戳 |
|---|--------|----------|--------|--------|
| 1 | `._index_properties()` 决策已定 | 文档化 + 代码已处理 | | |
| 2 | `Toaster` 消费链路已定 | 文档化 + 代码已处理 | | |
| 3 | `pydocstyle` 零 error | `Total errors: 0` | | |
| 4 | `ruff check` 零 error | `Found 0 errors.` | | |
| 5 | `pytest` 全量通过 | `X passed` | | |
| 6 | 模块可正常 import | 无 ImportError | | |
| 7 | plan.md Phase 3 已记账 | 含 `[x]` 或进度说明 | | |
| 8 | Commit 已推送 | remote 可见 | | |

---

## 附录 B: 核心上下文参考

### AST REPOSITORY MAP（关键节点）

| 文件 | 节点 | 行号 | 说明 |
|------|------|------|------|
| `src/endless_daemon.py` | `._index_properties()` | L380 | 本次存废决策对象 |
| `docs/figma/src/app/components/ui/sonner.tsx` | `Toaster()` | L6 | 本次存废决策对象 |
| `frontend/src/app/types/flow.ts` | `createFlowEdge()` | L128 | 核心业务流入口 |
| `frontend/src/app/types/flow.ts` | `createFlowNode()` | L87 | 核心业务流入口 |

### AC 验收矩阵

| AC ID | 描述 | 验证方法 | 状态 |
|-------|------|----------|------|
| AC-001 | 启动遗留代码清理与 AC 验收准备 | static_analysis | pending |
| AC-002 | Graphify NODE 节点验证 | static_analysis | pending |
| AC-003 | AST 静态分析通过 | static_analysis | pending |
| AC-004 | Docstring 补全 | static_analysis | pending |
| AC-005 | 模块可正常 import | unit_test | pending |

---

*文档版本: 1.0 | 生成日期: 2024 | 维护者: SWARM-103 Team*