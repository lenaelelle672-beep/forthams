# SWARM-006 Sprint 4 收尾巡检规范

## 需求与背景

| 项目 | 内容 |
|------|------|
| 任务编号 | SWARM-006 |
| 任务类型 | chore(evolve) - Sprint 收尾巡检 |
| 触发依据 | 参照 SWARM-003 Phase 1-4 定义 |
| 目标 | 完成 Sprint 4 所有交付物的质量验证与归档 |

### 本次巡检聚焦文件

| 文件路径 | 变更类型 | 关联 AC |
|----------|----------|---------|
| `docs/testing/templates/ControllerTestTemplate.java` | 模板规范文档 | AC-001 至 AC-005 |

### 验收标准映射

| 验收标准 | 描述 | 验证方法 |
|----------|------|----------|
| **AC-001** | Sprint 4 收尾巡检按 SWARM-003 Phase 1-4 定义逐项完成，确保 AC-001 至 AC-005 验收标准全部通过 | static_analysis |
| **AC-002** | [Graphify 知识图谱] No matching nodes found. - 知识图谱节点查询异常处理验证 | static_analysis |
| **AC-003** | 代码变更不引入新的语法错误（AST 静态检查通过） | static_analysis |
| **AC-004** | 所有修改的函数包含 docstring 文档注释 | static_analysis |
| **AC-005** | 变更后的模块可被正常 import 不抛出 ImportError | unit_test |

---

## 当前 Phase 对应实施目标

### Phase 1: 代码审查 (Code Review)

| 检查项 | 执行动作 | 判定标准 |
|--------|----------|----------|
| **语法合规** | AST 解析 `ControllerTestTemplate.java` | 无 SyntaxError |
| **导入完整性** | 检查所有 import 语句 | 路径正确、依赖存在 |
| **Docstring 规范** | 验证 Javadoc 注释完整性 | 所有 public 方法含文档注释 |
| **命名规范** | 符合 Java 编码约定 | 类名、方法名、变量名符合 camelCase/PascalCase |

### Phase 2: 单元测试 (Unit Testing)

| 测试覆盖目标 | 最低覆盖率 | 执行命令 |
|--------------|------------|----------|
| **模板结构验证** | 100% | `java -jar jacoco-cli.jar report` 或等效工具 |
| **注解有效性** | 100% | 检查所有 JUnit 注解正确使用 |
| **Mock 对象配置** | 100% | 验证 @Mock, @InjectMocks 配置 |

### Phase 3: AST 静态分析 (Static Analysis)

| 分析维度 | 工具 | 阈值 |
|----------|------|------|
| **圈复杂度** | Checkstyle / PMD | CC < 10 |
| **方法长度** | SonarQube 规则 | 单方法 < 50 行 |
| **依赖健康度** | Maven dependency:analyze | 无未声明依赖 |
| **注释覆盖率** | JaCoCo | 注释覆盖率 >= 80% |

### Phase 4: 文档归档 (Documentation Archiving)

| 文档类型 | 归档位置 | 更新要求 |
|----------|----------|----------|
| **测试模板规范** | `docs/testing/templates/ControllerTestTemplate.java` | **核心交付物** |
| **测试策略文档** | `docs/testing/TESTING_STRATEGY.md` | 关联更新 |
| **进度状态** | `plan.md` / `prd.md` | **必须标记 [x] 完成** |

---

## 边界约束

### 约束条件

1. **禁止跳过验证**：任何 Phase 未通过不得进入下一 Phase
2. **回归阻断**：若发现 AC-001 至 AC-005 任一标准未满足，立即阻断并返回开发修复
3. **原子性提交**：归档操作必须单独 commit，不得与其他功能变更混合
4. **回滚预案**：任何变更前需确保存在可回滚点

### 不可逾越红线

- [ ] **R-001**: 不得在未通过全部 ATB 的情况下关闭 Sprint
- [ ] **R-002**: 不得在未更新 plan.md 的情况下退出本次任务
- [ ] **R-003**: 不得引入新的语法错误或 ImportError

---

## 验收测试基准 (ATB)

### ATB-001: Phase 1 代码审查通过

```bash
# 执行命令 - Java 语法检查
javac -d /tmp/compile_test docs/testing/templates/ControllerTestTemplate.java 2>&1

# 执行命令 - Checkstyle 检查
java -jar checkstyle.jar -c sun_checks.xml docs/testing/templates/ControllerTestTemplate.java

# 执行命令 - Docstring 检查
grep -A 10 "public.*(" docs/testing/templates/ControllerTestTemplate.java | grep -E "^\s*\*\s*@" || echo "Docstring Check: PASS"

# 物理期待
- javac 退出码: 0
- Checkstyle: 无 ERROR (WARN 可接受)
- Docstring: 所有 public 方法包含 Javadoc
```

### ATB-002: Phase 2 单元测试覆盖

```bash
# 执行命令 - Maven 测试
cd backend && mvn test -Dtest=*ControllerTest* -DfailIfNoTests=false

# 执行命令 - 覆盖率报告
mvn jacoco:report
cat target/site/jacoco/index.html | grep -A 5 "ControllerTestTemplate"

# 物理期待
- 测试结果: "BUILD SUCCESS"
- 覆盖率: Total >= 70%
- 失败测试数: 0
```

### ATB-003: Phase 3 AST 静态分析合规

```bash
# 执行命令 - PMD 复杂度检查
mvn pmd:check -Dpmd.targetDirectory=target/pmd

# 执行命令 - Maven 依赖分析
mvn dependency:analyze 2>&1 | grep -E "(Used undeclared|Unused declared)"

# 执行命令 - SpotBugs 检查
mvn spotbugs:check

# 物理期待
- PMD: 无 Blocker/Error
- 依赖分析: 无未声明依赖
- SpotBugs: 0 High priority issues
```

### ATB-004: 文档完整性验证

```bash
# 执行命令 - 文件存在性检查
ls -la docs/testing/templates/ControllerTestTemplate.java

# 执行命令 - 关键内容检查
grep -E "(package|import|@Test|@Before|@After)" docs/testing/templates/ControllerTestTemplate.java | wc -l

# 执行命令 - 强制要求: plan.md 更新检查
grep -E "Sprint 4.*\[x\]|Sprint 4.*\[完成\]" plan.md && echo "plan.md UPDATED" || echo "plan.md NOT UPDATED - BLOCKER!"

# 物理期待
- 文件存在: true
- 关键标记数量: >= 5
- plan.md 状态: 已标记 [x] 或 [完成]
```

### ATB-005: AC-001 至 AC-005 逐项确认

| AC ID | 验证命令 | 物理期待 |
|-------|----------|----------|
| **AC-001** | `mvn verify -DskipTests=false` | BUILD SUCCESS + Phase 1-4 全部通过 |
| **AC-002** | 检查 Graphify 异常处理代码存在 | `try-catch` 或 `@ExceptionHandler` 存在 |
| **AC-003** | `javac docs/testing/templates/ControllerTestTemplate.java` | 退出码: 0, 无错误输出 |
| **AC-004** | `grep -E "/\*\*|\*" docs/testing/templates/ControllerTestTemplate.java \| wc -l` | 注释行数 >= 类数 * 3 |
| **AC-005** | `mvn dependency:resolve -pl .` | 退出码: 0, 所有依赖已解析 |

---

## 开发切入层级序列

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 0: 前置准备                                               │
│  ├── 获取 plan.md 中 SWARM-006 相关上下文                        │
│  ├── 确认 SWARM-003 中 Phase 1-4 具体定义                         │
│  ├── 拉取最新 main 分支代码                                       │
│  └── 切换至 Sprint 4 工作分支                                     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: Phase 1 代码审查                                       │
│  ├── ATB-001 执行                                                │
│  │   ├── javac 语法检查                                           │
│  │   ├── Checkstyle 格式检查                                      │
│  │   └── Docstring 完整性检查                                      │
│  └── [阻断点] 任一失败 → 返回开发修复                              │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Phase 2 单元测试                                       │
│  ├── ATB-002 执行                                                │
│  │   ├── Maven test 执行                                          │
│  │   └── JaCoCo 覆盖率检查                                         │
│  └── [阻断点] 覆盖率 < 70% → 返回开发修复                          │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: Phase 3 AST 静态分析                                    │
│  ├── ATB-003 执行                                                │
│  │   ├── PMD 复杂度分析                                            │
│  │   ├── Maven dependency:analyze                                 │
│  │   └── SpotBugs 安全扫描                                         │
│  └── [阻断点] 任一阈值超标 → 返回开发修复                          │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: Phase 4 文档归档                                        │
│  ├── ATB-004 执行                                                │
│  │   ├── 确认 ControllerTestTemplate.java 存在                     │
│  │   ├── 同步测试策略文档（如有变更）                               │
│  │   └── [核心] 更新 plan.md - Sprint 4 标记 [x]                    │
│  └── 提交归档 commit                                              │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: 最终验收确认                                            │
│  ├── ATB-005 执行 - 逐项验证 AC-001 至 AC-005                      │
│  │   ├── AC-001: Sprint 4 巡检完整性                                │
│  │   ├── AC-002: Graphify 异常处理                                  │
│  │   ├── AC-003: AST 语法合规                                       │
│  │   ├── AC-004: Docstring 覆盖                                     │
│  │   └── AC-005: 模块可导入性                                        │
│  ├── 生成 Sprint 4 总结报告                                       │
│  └── [强制] 确认 plan.md 已更新后退出                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 聚焦文件详细规范

### `docs/testing/templates/ControllerTestTemplate.java` 审查清单

| 检查项 | 规格要求 | 验证方法 |
|--------|----------|----------|
| **包声明** | `package com.ams.testing.templates;` | `grep "^package" file` |
| **JUnit 版本** | JUnit 4 (@Test from org.junit) 或 JUnit 5 (org.junit.jupiter.api.Test) | `grep -E "import.*junit" file` |
| **Mockito 导入** | org.mockito.* | `grep "import org.mockito" file` |
| **Spring 测试注解** | @WebMvcTest, @SpringBootTest (如适用) | `grep -E "@WebMvcTest|@SpringBootTest" file` |
| **Controller 注入** | @Autowired private XxxController controller | `grep "@Autowired" file` |
| **MockBean 配置** | @MockBean private XxxService xxxService | `grep "@MockBean" file` |
| **方法命名规范** | `testShouldXXXWhenYYY()` 格式 | `grep "testShould" file` |
| **Assert 语句** | 每测试方法至少包含一个 assert | `grep "assert" file` |
| **注释覆盖率** | public 方法 Javadoc 注释 | 手动审查 |

---

## 执行检查清单

### LAYER 0 - 前置准备
- [ ] 已读取 plan.md 中 SWARM-006 上下文
- [ ] 已读取 SWARM-003 Phase 定义
- [ ] 代码分支已切换至 Sprint 4 工作分支
- [ ] 已拉取最新远程变更

### LAYER 1 - Phase 1 代码审查
- [ ] ATB-001: javac 语法检查通过
- [ ] ATB-001: Checkstyle 格式检查通过
- [ ] ATB-001: Docstring 完整性检查通过
- [ ] ATB-001: 导入语句有效性验证通过

### LAYER 2 - Phase 2 单元测试
- [ ] ATB-002: Maven test 执行成功
- [ ] ATB-002: JaCoCo 覆盖率 >= 70%
- [ ] ATB-002: 失败测试数 = 0

### LAYER 3 - Phase 3 AST 静态分析
- [ ] ATB-003: PMD 复杂度检查通过
- [ ] ATB-003: Maven dependency:analyze 无未声明依赖
- [ ] ATB-003: SpotBugs 高优先级问题 = 0

### LAYER 4 - Phase 4 文档归档
- [ ] ATB-004: ControllerTestTemplate.java 文件存在
- [ ] ATB-004: 关键内容标记数量 >= 5
- [ ] ATB-004: **plan.md Sprint 4 状态已标记 [x]**
- [ ] ATB-004: 归档 commit 已创建并推送

### LAYER 5 - 最终验收确认
- [ ] ATB-005: AC-001 Sprint 4 巡检完整性验证通过
- [ ] ATB-005: AC-002 Graphify 异常处理代码存在
- [ ] ATB-005: AC-003 AST 语法合规验证通过
- [ ] ATB-005: AC-004 Docstring 覆盖率验证通过
- [ ] ATB-005: AC-005 模块可导入性验证通过
- [ ] Sprint 4 总结报告已生成

---

## 强制提醒

> ⚠️ **完成条件**: 退出任务前必须执行以下命令确认状态：
> 
> ```bash
> cat plan.md | grep -E "Sprint 4.*\[x\]|Sprint 4.*\[完成\]" && echo "✅ CAN EXIT" || echo "❌ BLOCKED - UPDATE plan.md!"
> ```
> 
> **未确认 plan.md 更新状态前，禁止退出本次任务。**

---

## 附录: Graphify 知识图谱问题关联

### AC-002 专项检查

**问题描述**: `[Graphify 知识图谱] No matching nodes found.`

**关联文件变更**:
- `endless_daemon.py` - GraphifyNodeRegistry 类
- `frontend/src/app/components/AssetDetailModal.tsx` - mockGraphifySearch 函数

**验证要点**:
1. 检查异常处理代码是否捕获 `NodeNotFoundError`
2. 确认 `GraphifyNodeRegistry` 提供节点查询方法
3. 验证前端 mock 函数在空结果时返回正确的空数组结构

**验证命令**:
```bash
# 检查异常类存在
grep "class NodeNotFoundError" endless_daemon.py

# 检查查询方法存在
grep "def.*search\|def.*find\|def.*get" endless_daemon.py

# 检查 mock 函数空结果处理
grep -A 5 "non_existent\|__NO_RESULT__" frontend/src/app/components/AssetDetailModal.tsx
```

---

*文档版本: 1.0*
*最后更新: Sprint 4 收尾巡检执行*
*审核状态: 待执行*