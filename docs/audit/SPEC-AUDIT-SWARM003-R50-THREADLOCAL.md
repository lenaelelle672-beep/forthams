# SWARM-003 Squad Audit 第50轮专项巡检规格文档

## 需求与背景

### 业务上下文
本次巡检源于 `AuditService` 中 `.save()` 方法与 `AuditAspect` 的 `.audit()` 切面拦截机制在并发场景下的潜在 ThreadLocal 上下文泄露风险。

### 技术根因
- `GeneralAuditEntry` 作为审计实体，在多线程环境下通过 ThreadLocal 传递上下文
- 切面 `AuditAspect` 在方法入口织入、出口清理，若清理逻辑存在异常路径遗漏，将导致内存泄漏
- 社区等级为 7（高风险敏感区），必须逐行验证

### 巡检目标
验证 ThreadLocal 上下文的 `set()` → `get()` → `remove()` 生命周期在以下并发场景的完整性：
1. 同步调用链
2. 异步线程池执行
3. 线程池复用场景
4. 异常抛出路径的清理覆盖

---

## 当前 Phase 对应实施目标

### 对应 Phase
参照 `plan.md` 中 Phase-7（审计追踪体系） → Sub-Phase 7.3（并发安全验证）

### 本次具体目标
| 目标编号 | 描述 | 验收状态 |
|---------|------|---------|
| T50-001 | 定位所有 ThreadLocal 声明点 | 待验证 |
| T50-002 | 确认 set/get/remove 配对完整性 | 待验证 |
| T50-003 | 验证异常路径 remove 覆盖 | 待验证 |
| T50-004 | 并发压测无泄漏告警 | 待验证 |

---

## 边界约束

### 扫描范围
```
backend/src/main/java/com/ams/
├── entity/GeneralAuditEntry.java
├── service/AuditService.java
├── config/AuditAspect.java
├── aop/AuditAspect.java
└── aspect/AuditAspect.java
```

### 约束条件
1. **不修改生产代码**：本次为巡检审计，不涉及功能修改
2. **不引入新依赖**：仅使用现有测试框架（JUnit 5 + Mockito）
3. **隔离性要求**：每个测试用例独立运行，无状态污染
4. **超时阈值**：单线程 set→get→remove 完整链路 ≤ 5ms

### 排除范围
- Controller 层 HTTP 请求上下文（不属于本次范围）
- 数据库连接池 ThreadLocal（由框架管理）

---

## 验收测试基准 (ATB)

### ATB-001: ThreadLocal 声明点扫描

**测试目标**：枚举所有 ThreadLocal 变量声明

**物理测试代码**（JUnit 5）：
```java
@Test
void scanThreadLocalDeclarations() {
    Path servicePath = Paths.get("backend/src/main/java/com/ams/service/AuditService.java");
    Path aspectPath = Paths.get("backend/src/main/java/com/ams/config/AuditAspect.java");
    
    List<String> serviceCode = Files.readAllLines(servicePath);
    List<String> aspectCode = Files.readAllLines(aspectPath);
    
    // 断言：找到 ThreadLocal 声明
    assertTrue(hasThreadLocalDeclaration(serviceCode), 
        "AuditService 必须显式声明 ThreadLocal<GeneralAuditEntry>");
    
    // 记录行号供后续验证
    List<Integer> tlLines = extractThreadLocalLineNumbers(aspectCode);
    assertFalse(tlLines.isEmpty(), "Aspect 必须持有 ThreadLocal 引用");
}
```

**期待结果**：
- `AuditService.java` 存在 `private static final ThreadLocal<GeneralAuditEntry>`
- `AuditAspect.java` 持有对上述 ThreadLocal 的引用

---

### ATB-002: set/get/remove 配对完整性

**测试目标**：验证每个 `set()` 必有对应的 `remove()`

**物理测试代码**：
```java
@Test
void verifyLifecycleCompleteness() {
    String aspectCode = Files.readString(
        Paths.get("backend/src/main/java/com/ams/config/AuditAspect.java"));
    
    // 统计 set 调用次数
    long setCount = countOccurrences(aspectCode, ".set(");
    // 统计 remove 调用次数
    long removeCount = countOccurrences(aspectCode, ".remove(");
    
    assertEquals(setCount, removeCount,
        String.format("ThreadLocal set(%d) 与 remove(%d) 必须配对", setCount, removeCount));
}
```

**期待结果**：set 数量 == remove 数量，无遗漏

---

### ATB-003: 异常路径 remove 覆盖验证

**测试目标**：确保 try-finally 或 try-with-resources 覆盖异常路径

**物理测试代码**：
```java
@Test
void verifyExceptionPathCleanup() {
    String aspectCode = Files.readString(
        Paths.get("backend/src/main/java/com/ams/config/AuditAspect.java"));
    
    // 断言：存在 try 块
    assertTrue(aspectCode.contains("try {"), 
        "AuditAspect 必须使用 try 块包裹 ThreadLocal 操作");
    
    // 断言：finally 或 try-with-resources 中调用 remove
    boolean hasFinally = aspectCode.contains("finally {");
    boolean hasTryWithResources = aspectCode.matches(
        ".*try \\([^)]*ThreadLocal[^)]*\\) \\{.*");
    
    assertTrue(hasFinally || hasTryWithResources,
        "ThreadLocal 清理必须在 finally 或 try-with-resources 中");
}
```

**期待结果**：
- 存在 `try { set(); ... } finally { remove(); }` 模式
- 或使用 `try (ThreadLocalHolder holder = ...) { ... }`

---

### ATB-004: 并发压测无泄漏

**测试目标**：100 线程并发执行后，ThreadLocal map 无残留

**物理测试代码**（使用 ExecutorService）：
```java
@Test
void concurrentStressTest() throws InterruptedException {
    ExecutorService executor = Executors.newFixedThreadPool(100);
    CountDownLatch latch = new CountDownLatch(100);
    
    // 注入 spy 监听 remove 调用
    ThreadLocal<GeneralAuditEntry> spy = spy(auditService.getThreadLocal());
    doNothing().when(spy).remove();
    
    for (int i = 0; i < 100; i++) {
        final int id = i;
        executor.submit(() -> {
            try {
                spy.set(GeneralAuditEntry.builder().id((long) id).build());
                auditService.save(new GeneralAuditEntry());
            } finally {
                spy.remove();
            }
            latch.countDown();
        });
    }
    
    assertTrue(latch.await(10, TimeUnit.SECONDS), "100 线程必须在10秒内完成");
    verify(spy, times(100)).remove(); // 断言每个线程都调用了 remove
    
    executor.shutdown();
}
```

**期待结果**：
- 所有 100 个线程均执行了 `remove()`
- 无 `OutOfMemoryError` 或线程阻塞
- 线程池可正常复用

---

### ATB-005: 静态分析扫描

**测试目标**：使用 SpotBugs/FindBugs 检测 ThreadLocal 泄漏模式

**物理测试命令**：
```bash
cd backend
mvn spotbugs:check -Dspotbugs.includeFilterFile=src/test/resources/spotbugs-threadlocal.xml
```

**spotbugs-threadlocal.xml 配置片段**：
```xml
<Match>
    <Bug pattern="MS_SHOULD_BE_REFACTORED_TO_BE_FINAL" />
    <Class name="~com.ams.service.AuditService"/>
    <Field name="~.*[tT]hread[lL]ocal.*"/>
</Match>
```

**期待结果**：SpotBugs 报告无 `EI_EXPOSE_REP2` 或 `EI_EXPOSE_STATIC_WILDCARD` 告警

---

## 开发切入层级序列

```
Level 1: 静态源码扫描（本地 IDE + grep）
    │
    ├── L1.1: 定位 GeneralAuditEntry.java 中的字段定义
    ├── L1.2: 定位 AuditService.java 中的 ThreadLocal 声明
    └── L1.3: 定位 AuditAspect.java 中的 set/get/remove 调用

Level 2: 单元测试验证（JUnit 5 单测）
    │
    ├── L2.1: ATB-001 ThreadLocal 声明点扫描
    ├── L2.2: ATB-002 set/get/remove 配对完整性
    └── L2.3: ATB-003 异常路径覆盖验证

Level 3: 集成压测（并发场景）
    │
    └── L3.1: ATB-004 100 线程并发压测

Level 4: 静态分析工具扫描
    │
    └── L4.1: ATB-005 SpotBugs 规则匹配

Level 5: 审计报告输出
    │
    └── L5.1: 生成 audit-report-swarm003-50.md
```

---

## 巡检结论输出要求

完成上述 5 个 Level 后，输出报告：
```
# SWARM-003 Round-50 审计报告

## 巡检时间: {timestamp}
## 巡检人: Squad Audit

## 风险等级: [HIGH/MEDIUM/LOW/NONE]
## 遗留问题: [数量]

## 详细结论
- [x] ATB-001 通过
- [x] ATB-002 通过
- [ ] ATB-003 失败 (见下方问题)
...
```

---

## 候选文件清单（Locality Report）

| 文件路径 | 相关度 | 巡检优先级 |
|---------|--------|-----------|
| `backend/src/main/java/com/ams/config/AuditAspect.java` | 6 | P0 - 核心切面 |
| `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java` | 6 | P0 - 核心实体 |
| `backend/src/main/java/com/ams/service/AuditService.java` | 4 | P1 - 服务层 |
| `backend/src/main/java/com/ams/aop/AuditAspect.java` | 4 | P2 - 备选切面 |
| `backend/src/main/java/com/ams/aspect/AuditAspect.java` | 4 | P2 - 备选切面 |

---

**文档版本**: v1.0  
**状态**: 待执行  
**下次巡检**: SWARM-003 Round-51