# SWARM-004: AuditAspect.java 切面集成开发规格指导

**任务编号**: SWARM-004  
**迭代周期**: Iteration-2  
**状态**: ACTIVE  
**文档版本**: 2.0  
**生成日期**: 2024

---

## 1. 需求与背景

### 1.1 业务背景

Graphify 项目需要在 Java 核心框架层引入审计切面（AuditAspect），实现对关键业务方法的运行时拦截与审计日志记录。审计机制需与现有的 `GeneralAuditEntry` 实体模型及 `AuditService` 服务层无缝集成，形成完整的审计追溯链路。

### 1.2 技术上下文

| 层级 | 组件 | 路径 | 职责 |
|------|------|------|------|
| 审计实体层 | `GeneralAuditEntry` | `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java` | 持久化审计记录 |
| 审计服务层 | `AuditService` | `backend/src/main/java/com/ams/service/AuditService.java` | 审计日志写入与查询 |
| 切面拦截层 | `AuditAspect` | `backend/src/main/java/com/ams/aspect/AuditAspect.java` | 方法级别拦截与数据采集 |
| 质量验证层 | AST 静态分析 | `scripts/ast_dead_code_check.py` | Java 代码语法完整性验证 |

### 1.3 SWARM-004 任务目标

完成 AuditAspect.java 切面集成开发，实现：

- [ ] 方法入口/出口的 JoinPoint 拦截
- [ ] 方法参数、返回值、异常信息的捕获
- [ ] 与 GeneralAuditEntry 实体的字段映射
- [ ] 异步写入 AuditService 的非阻塞审计
- [ ] AST 静态分析验证语法正确性

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解对照表

| Phase ID | Phase 描述 | 本次任务占比 | 状态 |
|----------|-----------|-------------|------|
| Phase-1 | 审计实体模型定义 | 100% (已完成) | ✅ |
| Phase-2 | AuditService 服务实现 | 100% (已完成) | ✅ |
| Phase-3 | AuditAspect 切面集成 | **70% (本次核心)** | 🔄 |
| Phase-4 | 集成测试与质量验证 | 30% (并行) | ⏳ |
| Phase-5 | 文档与部署 | 待启动 | ⬜ |

### 2.2 本次交付物清单

```
backend/src/main/java/com/ams/
├── aspect/
│   └── AuditAspect.java          # 核心切面类
├── annotation/
│   └── Auditable.java            # 切点注解定义
├── context/
│   └── AuditContext.java         # 审计上下文持有器
└── test/java/com/ams/
    └── aspect/
        └── AuditAspectTest.java  # 单元测试
```

### 2.3 核心接口规范

**AuditAspect.java 核心结构**:

```java
@Aspect
@Component
@Order(100)
public class AuditAspect {
    
    @Autowired
    private AuditService auditService;
    
    @Pointcut("@annotation(auditable)")
    public void auditPointcut(Auditable auditable) {}
    
    @Around("auditPointcut(auditable)")
    public Object around(ProceedingJoinPoint joinPoint, Auditable auditable) {}
    
    @AfterReturning(pointcut = "auditPointcut(auditable)", returning = "result")
    public void afterReturning(JoinPoint joinPoint, Auditable auditable, Object result) {}
    
    @AfterThrowing(pointcut = "auditPointcut(auditable)", throwing = "ex")
    public void afterThrowing(JoinPoint joinPoint, Auditable auditable, Throwable ex) {}
}
```

---

## 3. 边界约束

### 3.1 功能边界

| 分类 | 有效范围 | 排除范围 |
|------|---------|---------|
| 拦截粒度 | `@Around`/`@Before`/`@After` 切面方法拦截 | private 方法强制拦截 (Java 权限限制) |
| 方法可见性 | public/protected 方法切点匹配 | 构造函数切面化 (设计约束) |
| 执行模式 | 同步/异步方法执行监控 | 泛型类型擦除后的参数还原 |
| 异常捕获 | Throwable 全量捕获 | 循环引用导致的审计死锁 |
| 上下文传递 | ThreadLocal 审计元数据传递 | 跨线程池的上下文继承 |

### 3.2 技术约束

| 约束项 | 规格要求 |
|--------|---------|
| Java 版本 | >= JDK 11 |
| Spring Framework | >= 5.3.x |
| AspectJ 版本 | 1.9.x |
| 审计日志异步比例 | >= 95% 非阻塞 |
| 切面优先级 | `@Order <= 100` (高优先级) |
| 循环依赖规避 | 审计服务内部调用需绕过切面 |
| 拦截额外耗时 | 不得超过被拦截方法耗时的 **3%** |

### 3.3 非功能约束

- 审计失败不得影响主业务逻辑的正常执行
- 审计记录的字段完整率需达到 **99.5%**
- 审计数据写入失败时需降级处理，记录本地日志

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 切面基础功能验证

| 测试编号 | 测试场景 | 物理测试期待 | 验证方式 |
|---------|---------|-------------|----------|
| `ATB-1.1` | 方法入口拦截 | `AuditAspect.before()` 在目标方法执行前被调用 | JUnit Mock 验证 |
| `ATB-1.2` | 方法出口拦截 | `AuditAspect.after()` 在目标方法执行后被调用 | JUnit Mock 验证 |
| `ATB-1.3` | 异常捕获验证 | `AuditAspect.afterThrowing()` 捕获 Throwable | JUnit 模拟异常场景 |
| `ATB-1.4` | 切点匹配验证 | 仅匹配标注 `@Auditable` 的方法 | `@Auditable` 标注测试 |

**测试代码示例**:

```java
@Test
void test_method_entry_interception() {
    AuditableService service = mock(AuditableService.class);
    when(service.auditedMethod(any())).thenReturn("result");
    verify(auditAspect, times(1)).before(any(JoinPoint.class));
}

@Test
void test_exception_capture() {
    when(targetService.auditedMethod(any()))
        .thenThrow(new RuntimeException("test error"));
    GeneralAuditEntry entry = captureAuditEntry(
        () -> targetService.auditedMethod("param")
    );
    assertNotNull(entry.getExceptionMessage());
    assertTrue(entry.getExceptionMessage().contains("test error"));
}
```

### 4.2 ATB-2: GeneralAuditEntry 实体映射验证

| 测试编号 | 测试场景 | 物理测试期待 |
|---------|---------|-------------|
| `ATB-2.1` | 方法名记录 | `GeneralAuditEntry.methodName` 等于被拦截方法名 |
| `ATB-2.2` | 参数序列化 | `GeneralAuditEntry.parameters` 包含完整参数字符串 |
| `ATB-2.3` | 返回值记录 | `GeneralAuditEntry.returnValue` 非空 (若方法有返回值) |
| `ATB-2.4` | 异常信息记录 | `GeneralAuditEntry.exceptionMessage` 包含堆栈摘要 |
| `ATB-2.5` | 执行时间记录 | `GeneralAuditEntry.executionTimeMs` 精确到毫秒 |

**测试代码示例**:

```java
@Test
void test_audit_entry_fields_mapping() {
    GeneralAuditEntry entry = captureAuditEntry(
        () -> auditedService.doAction("param", 123)
    );
    assertEquals("doAction", entry.getMethodName());
    assertTrue(entry.getParameters().contains("param"));
    assertTrue(entry.getParameters().contains("123"));
    assertNotNull(entry.getExecutionTimeMs());
    assertTrue(entry.getExecutionTimeMs() >= 0);
}
```

### 4.3 ATB-3: AuditService 集成验证

| 测试编号 | 测试场景 | 物理测试期待 |
|---------|---------|-------------|
| `ATB-3.1` | 同步写入 | `AuditService.logAudit()` 在主线程调用 |
| `ATB-3.2` | 异步写入 | 线程池异步提交后主线程立即返回 |
| `ATB-3.3` | 失败降级 | AuditService 异常时记录日志不抛主业务异常 |

**AST-003 等效 Java 验证**:

```java
@Test
void test_audit_aspect_imports_without_error() {
    assertDoesNotThrow(() -> 
        Class.forName("com.ams.aspect.AuditAspect")
    );
    assertDoesNotThrow(() -> 
        Class.forName("com.ams.entity.GeneralAuditEntry")
    );
    assertDoesNotThrow(() -> 
        Class.forName("com.ams.service.AuditService")
    );
}
```

### 4.4 ATB-4: AST 静态分析验证 (AST-003 对等)

| 测试编号 | 测试场景 | 物理测试期待 |
|---------|---------|-------------|
| `ATB-4.1` | 语法完整性 | `javac` 编译无 error 输出 |
| `ATB-4.2` | 依赖可解析 | 所有 import 语句指向存在的类 |
| `ATB-4.3` | 注解有效性 | `@Aspect`, `@Component` 注解可识别 |

**验证命令**:

```bash
# AST 语法验证
cd backend
javac -Xlint:all -proc:none \
    src/main/java/com/ams/aspect/AuditAspect.java \
    src/main/java/com/ams/entity/GeneralAuditEntry.java

# 依赖解析检查
mvn dependency:resolve -DincludeArtifactIds=aspectjrt,spring-aop
```

### 4.5 ATB-5: 边界案例处理 (AST-002 对等)

| 测试编号 | 测试场景 | 物理测试期待 |
|---------|---------|-------------|
| `ATB-5.1` | 空方法体 | `auditMethod()` 无任何语句时不崩溃 |
| `ATB-5.2` | 递归调用 | 自调用方法不触发重复审计 |
| `ATB-5.3` | 泛型参数 | `List<User>` 类型参数正确序列化 |
| `ATB-5.4` | 空返回值 | void 方法的 returnValue 为 null |
| `ATB-5.5` | 嵌套对象 | 复杂对象参数正确记录 toString() |

---

## 5. 开发切入层级序列

### L1: 实体层依赖确认

**目标文件**: `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java`

```
必须存在字段:
├── Long id                    # 主键
├── String methodName          # 方法名
├── String className           # 类名
├── String parameters          # 序列化参数
├── String returnValue         # 返回值
├── String exceptionMessage    # 异常信息
├── Long executionTimeMs       # 执行耗时
├── Instant timestamp          # 时间戳
└── String category            # 审计分类
```

### L2: 服务层接口定义

**目标文件**: `backend/src/main/java/com/ams/service/AuditService.java`

```
必须存在方法:
├── void logAudit(GeneralAuditEntry entry)
├── CompletableFuture<Void> logAuditAsync(GeneralAuditEntry entry)
├── List<GeneralAuditEntry> queryByMethodName(String methodName)
└── Page<GeneralAuditEntry> queryByTimeRange(Instant start, Instant end)
```

### L3: 切面注解定义

**目标文件**: `backend/src/main/java/com/ams/annotation/Auditable.java`

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    String category() default "general";
    boolean async() default true;
    String[] excludeParams() default {};
}
```

### L4: 切面核心类实现

**目标文件**: `backend/src/main/java/com/ams/aspect/AuditAspect.java`

```
核心方法:
├── @Aspect + @Component 标注
├── @Pointcut("@annotation(auditable)") 定义切点
├── @Around("auditPointcut()") 环绕拦截
├── @AfterReturning 成功返回拦截
├── @AfterThrowing 异常拦截
└── AuditContext ThreadLocal 上下文传递
```

### L5: 单元测试覆盖

**目标文件**: `backend/src/test/java/com/ams/aspect/AuditAspectTest.java`

```
测试覆盖:
├── MockMvc 集成测试 (可选)
├── JUnit 5 + Mockito 单元测试
└── 参数化测试 (@ParameterizedTest)
```

### L6: AST 静态分析执行

```bash
# 在项目根目录执行
./scripts/ast_dead_code_check.py --target backend/src/main/java/com/ams/aspect/
# 预期: 输出 "AuditAspect.java: PASS - No syntax errors"
```

---

## 6. 进度记录

### 6.1 plan.md 更新指令

完成本次切面集成开发后，**必须**执行以下落地操作：

1. 打开 `docs/plan.md` 或 `docs/prd.md` 文件
2. 定位 SWARM-004 任务所在 Phase
3. 更新进度标记

### 6.2 进度模板

```markdown
## Phase-3: AuditAspect 切面集成

- [x] L1 实体层依赖确认
- [x] L2 服务层接口定义
- [x] L3 切面注解定义
- [ ] L4 切面核心类实现
- [ ] L5 单元测试覆盖
- [x] L6 AST 静态分析执行

### ATB 验证状态

| 测试编号 | 状态 | 验证日期 |
|---------|------|---------|
| ATB-1.1 | ✅ 通过 | 2024-XX-XX |
| ATB-1.2 | ✅ 通过 | 2024-XX-XX |
| ATB-1.3 | ⏳ 待测 | - |
| ATB-1.4 | ⏳ 待测 | - |
| ATB-2.x | ⏳ 待测 | - |
| ATB-3.x | ⏳ 待测 | - |
| ATB-4.x | ⏳ 待测 | - |
| ATB-5.x | ⏳ 待测 | - |

> 最后更新: 2024-XX-XX | Iteration-2 | 状态: 70% 完成
```

---

## 附录 A: AST-003 验证矩阵

| 验证项 | Python 等效检查 | Java 等效检查 | 通过标准 |
|-------|----------------|--------------|---------|
| 语法完整性 | `ast.parse()` | `javac -Xlint:all` | 无 error |
| 依赖可解析 | `importlib.util.find_spec()` | `mvn dependency:tree` | 所有 scope 正常 |
| 注解有效性 | 无 | Spring 反射扫描 | `@Aspect` 可识别 |
| 包结构正确 | 无 | 类加载器验证 | main class 加载成功 |

## 附录 B: 相关测试文件

| 测试文件 | 用途 |
|---------|------|
| `tests/test_e2e_audit.py` | 端到端审计流程测试 |
| `tests/test_entity_binding.py` | 实体绑定验证测试 |
| `tests/test_aspect_binding.py` | 切面绑定验证测试 |
| `tests/test_dead_code_removal.py` | 死代码移除验证测试 |

---

*文档版本: 2.0 | 归属: SWARM-004 | 状态: ACTIVE*