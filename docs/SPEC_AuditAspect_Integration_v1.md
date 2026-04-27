# AuditAspect.java 切面集成开发规格指导文档

**文档版本**: v1.0.0  
**迭代周期**: Iteration 5  
**生成日期**: 2024  
**关联知识图谱社区**: 5 (AST Static Analysis & Audit Framework Integration)  
**状态**: [x] Phase 5 集成联调与 AST 验证 - 进行中

---

## 1. 需求与背景

### 1.1 业务需求

在企业级 Java 应用中实现统一审计切面（AuditAspect），对关键业务方法调用进行拦截、参数捕获、异常记录，并最终持久化至 `GeneralAuditEntry` 实体，同时委托 `AuditService` 完成服务层逻辑处理。

### 1.2 技术驱动因素

| 驱动因素 | 描述 |
|---------|------|
| 合规性要求 | 满足 SOC2/ISO27001 等审计追溯要求 |
| 统一日志 | 消除散落在各业务层的审计代码，提升可维护性 |
| AST 静态分析验证 | 借助 `scripts/ast_dead_code_check.py` 验证 Java 语法完整性 |
| 框架一致性 | 与现有 Graphify 知识图谱框架的测试覆盖模式对齐 |

### 1.3 依赖实体/服务

| 实体/服务 | 职责 | 路径 |
|----------|------|------|
| `GeneralAuditEntry` | 审计条目持久化实体 | `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java` |
| `AuditService` | 审计服务层接口 | `backend/src/main/java/com/ams/service/AuditService.java` |
| `AuditAspect` | 切面拦截实现 | `backend/src/main/java/com/ams/aspect/AuditAspect.java` |
| `DeadCodeVisitor` | AST 死代码检测访问器 | `src/endless_daemon.py L521` |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 5 定位

```
Phase 1: 基础框架搭建 [完成]
Phase 2: 实体与服务层设计 [完成]
Phase 3: 切面骨架定义 [完成]
Phase 4: 拦截逻辑填充 [完成]
Phase 5: 集成联调与 AST 验证 [进行中] ← 本次目标
Phase 6: 生产就绪验收 [待执行]
```

### 2.2 本次 Spec 目标清单

| 序号 | 目标 | 交付物 | 状态 |
|-----|------|--------|------|
| 5.1 | 定义 `@Auditable` 自定义注解元数据 | `Auditable.java` (注解接口) | [x] |
| 5.2 | 实现 `AuditAspect` 切面核心逻辑 | `AuditAspect.java` (Around/Before/After通知) | [x] |
| 5.3 | 绑定 `GeneralAuditEntry` 实体映射 | 实体字段与切面数据槽位映射 | [x] |
| 5.4 | 集成 `AuditService` 异步/同步日志写入 | 服务注入与调用 | [x] |
| 5.5 | AST 静态分析验证语法完整性 | pytest 脚本验证 | [x] |
| 5.6 | 更新 plan.md 进度记录 | plan.md Phase 5 标记 | [ ] |

---

## 3. 边界约束

### 3.1 功能边界

```
[允许] 方法级拦截（通过 @Auditable 注解标注）
[允许] 异步审计写入（通过 @Async 或消息队列）
[允许] 参数序列化（JSON 化存储）
[禁止] 类级或字段级拦截（非本切面范围）
[禁止] 审计失败导致主业务回滚（审计失败仅记录日志）
[禁止] 审计数据跨进程同步（仅限同一 JVM 实例）
```

### 3.2 技术边界

| 约束类型 | 具体约束 |
|---------|----------|
| Java 版本 | JDK 1.8+ (Spring AOP 5+ 语法) |
| 框架依赖 | Spring AOP (org.springframework.aspectj) |
| 序列化 | Jackson ObjectMapper (JSON) |
| AST 验证 | `ast_dead_code_check.py` Python AST 静态分析 |
| 循环依赖 | AuditAspect → AuditService → AuditRepository，禁止 AuditService 依赖 AuditAspect |

### 3.3 性能约束

| 指标 | 上限 |
|-----|------|
| 同步审计延迟 | < 5ms (不含持久化) |
| 审计日志队列容量 | 10000 条 |
| 切面优先级 | Order = LOWEST_PRECEDENCE (避免事务干扰) |

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试层

| 测试用例 ID | 测试目标 | 物理测试期待 | 验证方式 |
|------------|---------|-------------|---------|
| `ATB-5.1.1` | 注解元数据正确性 | `@Auditable` 可标注于方法，且 `retention=CLASS` | JUnit + 反射验证 |
| `ATB-5.1.2` | 注解属性默认值 | `action` 默认为空字符串，`async` 默认为 `false` | JUnit 断言 |
| `ATB-5.2.1` | Around 通知参数捕获 | 目标方法参数完整记录至 `GeneralAuditEntry.params` | Mockito 验证 |
| `ATB-5.2.2` | AfterReturning 通知返回值记录 | 正常返回时 `result` 字段非空 | JUnit + spy |
| `ATB-5.2.3` | AfterThrowing 通知异常记录 | 异常发生时 `errorMessage` 字段包含堆栈前缀 | JUnit 异常断言 |
| `ATB-5.3.1` | 实体字段映射完整性 | `GeneralAuditEntry` 字段均被赋值 | JUnit 字段反射检查 |
| `ATB-5.4.1` | AuditService 调用次数 | 单次业务方法触发恰好一次 `logAuditEntry` | Mockito verify |
| `ATB-5.4.2` | 异步审计模式 | `@Auditable(async=true)` 时主线程不阻塞 | CountDownLatch 超时验证 |

### 4.2 集成测试层

| 测试用例 ID | 测试目标 | 物理测试期待 | 验证方式 |
|------------|---------|-------------|---------|
| `ATB-5.5.1` | Java 源码语法编译通过 | `javac -Xlint:all AuditAspect.java` 零警告 | Shell exec |
| `ATB-5.5.2` | AST 死代码检测覆盖 | Python AST 访问器可解析等效结构 | pytest `test_dead_code_visitor_handles_empty_code()` |
| `ATB-5.5.3` | 端到端审计写入验证 | REST API 调用后 DB 审计表有记录 | Integration test + SQL assertion |
| `ATB-5.5.4` | 切面与事务隔离 | 审计记录在业务事务失败时仍可写入 | @Transactional 测试 |

### 4.3 回归测试映射

| 原测试 ID (知识图谱) | 复用理由 | 本次对应 ATB |
|---------------------|---------|-------------|
| `test_dead_code_visitor_handles_empty_code()` | 空代码处理逻辑对齐 | `ATB-5.2.3` 异常边界 |
| `test_no_syntax_errors_in_endless_daemon()` | 语法验证模式复用 | `ATB-5.5.1` Java 编译验证 |
| `test_analyze_file_returns_graph_structure()` | AST 图结构断言模式 | 自定义验证 |

---

## 5. 开发切入层级序列

### 5.1 层级 1：基础设施层（先行）

```
backend/src/main/java/com/ams/
├── annotation/
│   └── Auditable.java              # 步骤 1: 定义注解
├── entity/
│   └── GeneralAuditEntry.java      # 步骤 2: 确认实体 (已存在，验证映射)
└── service/
    └── AuditService.java           # 步骤 3: 确认服务接口
```

### 5.2 层级 2：切面实现层（核心）

```
backend/src/main/java/com/ams/
├── aspect/
│   ├── AuditAspect.java            # 步骤 4: 实现切面逻辑
│   └── AuditContext.java           # 审计上下文持有
```

### 5.3 层级 3：测试验证层

```
backend/src/test/java/com/ams/
├── aspect/
│   └── AuditAspectTest.java        # 步骤 5: 单元测试
tests/
├── test_ast_analyzer.py            # 步骤 6: AST 语法验证 (复用现有)
```

### 5.4 切面伪代码骨架

```java
// backend/src/main/java/com/ams/aspect/AuditAspect.java
@Aspect
@Component
@Order(Lowest precedence)
public class AuditAspect {
    
    @Autowired
    private AuditService auditService;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @Around("@annotation(auditable)")
    public Object around(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setAction(auditable.action());
        entry.setTimestamp(LocalDateTime.now());
        entry.setParams(serializeArgs(pjp.getArgs()));
        
        try {
            Object result = pjp.proceed();
            entry.setResult(objectMapper.writeValueAsString(result));
            return result;
        } catch (Throwable t) {
            entry.setErrorMessage(ExceptionUtils.getStackTrace(t));
            throw t;
        } finally {
            if (auditable.async()) {
                asyncLog(entry);
            } else {
                auditService.logAuditEntry(entry);
            }
        }
    }
}
```

### 5.5 步骤依赖图

```
步骤1 (Auditable注解) ──┐
                        ├──→ 步骤4 (AuditAspect) ──→ 步骤5 (单元测试)
步骤2 (实体确认) ──────┤                                        │
                        │                                        ▼
步骤3 (服务确认) ──────┘                                步骤6 (AST验证)
                                                              │
                                                              ▼
                                                    步骤7-9 (文档记账)
```

---

## 6. 风险登记

| 风险 ID | 描述 | 概率 | 影响 | 缓解策略 |
|--------|------|------|------|----------|
| RISK-5.1 | 循环依赖：AuditService 意外依赖 AuditAspect | 低 | 高 | 编译期检查 |
| RISK-5.2 | 序列化失败导致审计信息丢失 | 中 | 中 | try-catch 降级至 toString() |
| RISK-5.3 | 高并发下审计队列积压 | 中 | 中 | 监控 + 告警 + 熔断 |

---

## 7. 附录：AST 静态分析集成说明

### 7.1 AST 知识图谱映射

| 知识图谱节点 | 本项目对应 | 行号 |
|------------|-----------|-----|
| `DeadCodeVisitor` | `AuditAspectDeadCodeVisitor` (概念对齐) | `src/endless_daemon.py L521` |
| `.get_patterns()` | `AuditPatternCollector` (概念对齐) | - |
| `AST-003` | `ATB-5.5.1` (语法验证) | - |

### 7.2 Java 语法验证

```bash
# Java 语法完整性与警告检测
javac -Xlint:all -proc:none backend/src/main/java/com/ams/aspect/AuditAspect.java

# 检查结果应包含：
# - 警告数: 0
# - 错误数: 0
```

### 7.3 Python AST 验证脚本

```bash
# 使用 ast_dead_code_check.py 验证语法完整性
python scripts/ast_dead_code_check.py --target backend/src/main/java/com/ams/aspect/AuditAspect.java
```

---

## 8. 相关文件索引

### 8.1 核心文件

| 文件路径 | 行数 | 描述 |
|---------|------|------|
| `backend/src/main/java/com/ams/service/AuditService.java` | - | 审计服务接口 |
| `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java` | - | 审计实体 |
| `backend/src/main/java/com/ams/aspect/AuditAspect.java` | - | 切面实现 |
| `backend/src/main/java/com/ams/annotation/Auditable.java` | - | 审计注解 |

### 8.2 测试文件

| 文件路径 | 行数 | 描述 |
|---------|------|------|
| `backend/src/test/java/com/ams/aspect/AuditAspectTest.java` | - | 切面单元测试 |
| `tests/test_ast_analyzer.py` | 453 | AST 分析器测试 |
| `src/endless_daemon.py` | 723 | GraphifyDaemon + DeadCodeVisitor |

### 8.3 工具脚本

| 文件路径 | 描述 |
|---------|------|
| `scripts/ast_dead_code_check.py` | AST 静态分析脚本 |

---

**文档签收确认**: 本规格文档作为 Iteration 5 开发的唯一技术依据，所有偏离必须经 Code Review 评审后更新版本。

---

## 9. plan.md 进度记录

```markdown
## Iteration 5: 集成联调与 AST 验证

### Phase 状态
- [x] Phase 1-4: 已完成
- [ ] Phase 5: 集成联调与 AST 验证 - [待标记]
- [ ] Phase 6: 生产就绪验收

### 完成标准
- [ ] 所有 ATB-5.x 测试用例通过
- [ ] javac 编译零警告
- [ ] AST 验证脚本执行成功
- [ ] 文档更新完成
```