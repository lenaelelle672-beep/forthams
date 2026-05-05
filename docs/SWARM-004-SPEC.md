# SWARM-004 审计切面深度清剿 - 规格指导文档

## 需求与背景

### 业务痛点
- 当前系统中审计日志存在孤岛问题，部分关键业务方法未被 `@Auditable` 注解覆盖
- `AuditAspect` 切面织入点未覆盖所有高风险业务操作
- 审计日志记录不完整，存在数据追溯盲区

### 技术债务
```
问题定位：
1. AuditAspect.java 切面仅拦截 @Auditable 注解标注的方法
2. 缺少对 Service 层核心业务的强制覆盖机制
3. AuditService 存在两个实现路径（config/ vs aspect/），职责不清晰
4. GeneralAuditEntry 实体字段与业务需求可能存在偏差
```

### 改造目标
构建全链路审计追踪体系，确保所有关键业务方法（Create/Update/Delete 操作）强制纳入审计切面范围。

---

## 当前 Phase 对应实施目标

### 参照 plan.md Phase 拆解

| Phase | 描述 | 本次任务对应 |
|-------|------|--------------|
| Phase 1 | 审计注解与实体定义 | ✅ 已完成（Auditable.java, GeneralAuditEntry.java） |
| Phase 2 | 审计切面核心实现 | 🔄 **本次迭代重点** |
| Phase 3 | 业务方法注解覆盖 | 🔜 下一迭代 |
| Phase 4 | 集成测试与验证 | 🔜 后续迭代 |

### 本次 Iteration 目标（Phase 2）

```
目标清单：
[P2-1] 统一 AuditService 实现，合并 config/ 与 aspect/ 双路径
[P2-2] 完善 AuditAspect 切面逻辑，支持 JoinPoint 全要素提取
[P2-3] 解决审计日志孤岛：补充遗漏业务方法的 @Auditable 标注
[P2-4] 验证 AspectJ 织入有效性
```

---

## 边界约束

### 强制约束
| 约束项 | 说明 |
|--------|------|
| 织入范围 | 仅限 `com.ams.service.*` 及 `com.ams.controller.*` 包下的 public 方法 |
| 注解要求 | 任何涉及数据变更的方法必须标注 `@Auditable` |
| 日志持久化 | 审计日志必须写入数据库，不允许仅打印日志 |
| 异常处理 | 切面不得吞没业务异常，审计失败不影响主流程 |

### 排除范围
```
排除项：
- private/protected 方法（AspectJ 限制）
- 框架内部方法（Spring Transaction、Session 等）
- 纯查询方法（GET 请求且无数据变更）
- 定时任务内部调用（由调度框架自行审计）
```

### 性能约束
- 单次审计写入延迟 ≤ 50ms（异步队列兜底）
- 切面切入点匹配时间 ≤ 1ms
- 审计日志表分页查询响应 ≤ 200ms

---

## 验收测试基准 (ATB)

### ATB-1：切面织入验证

| 测试编号 | 测试场景 | 物理测试期待 | 验证方式 |
|----------|----------|--------------|----------|
| ATB-1.1 | `AuditAspect.logAfterReturning()` 正常返回 | GeneralAuditEntry 正确生成，字段完整 | JUnit `@Test` 断言 |
| ATB-1.2 | `AuditAspect` 方法抛出业务异常 | 审计日志不写入，异常正常向上抛出 | JUnit `@Test(expected=...)` |
| ATB-1.3 | 未标注 `@Auditable` 的方法 | 无审计日志生成 | 集成测试日志表行数验证 |

**物理测试用例示例（JUnit）：**
```java
@Test
void logAfterReturning_ShouldCreateAuditEntry() {
    // Given: 标注 @Auditable 的测试服务方法
    // When: 调用目标方法
    // Then: 验证 GeneralAuditEntry 记录存在且字段匹配
    AuditEntry entry = auditEntryRepository.findLatest();
    assertEquals("createUser", entry.getOperation());
    assertEquals(TEST_USER_ID, entry.getUserId());
}
```

### ATB-2：审计日志孤岛清剿

| 测试编号 | 测试场景 | 物理测试期待 | 验证方式 |
|----------|----------|--------------|----------|
| ATB-2.1 | Service 层核心方法覆盖检查 | 关键方法 100% 标注 `@Auditable` | 反射扫描 + 覆盖率报告 |
| ATB-2.2 | Controller 层 POST/PUT/DELETE 方法 | 全部触发审计 | Playwright E2E 测试 |
| ATB-2.3 | 嵌套调用场景 | 外层方法审计生效 | 单元测试 Mock 验证 |

**物理测试用例示例（反射扫描）：**
```java
@Test
void allServiceMutationMethods_ShouldBeAuditable() {
    // Given: 扫描 com.ams.service 包
    // When: 筛选所有写操作方法（名称含 create/update/delete/save）
    // Then: 所有方法均标注 @Auditable
    Set<Method> unmapped = findMutationMethodsWithoutAuditable();
    assertTrue(unmapped.isEmpty(), 
        "Unmapped methods: " + unmapped.stream().map(Method::getName).toList());
}
```

### ATB-3：数据完整性验证

| 测试编号 | 测试场景 | 物理测试期待 |
|----------|----------|--------------|
| ATB-3.1 | GeneralAuditEntry 字段完整性 | userId、operation、targetEntity、timestamp、requestParams 必填 |
| ATB-3.2 | JoinPoint 信息提取 | 方法名、类名、参数值、返回值均正确记录 |
| ATB-3.3 | 审计日志查询 | 支持按用户/时间/操作类型多维度查询 |

### ATB-4：集成回归验证

| 测试编号 | 测试场景 | 物理测试期待 |
|----------|----------|--------------|
| ATB-4.1 | 完整业务链路 | 用户操作 → Controller → Service → 审计日志写入 |
| ATB-4.2 | 并发场景 | 100 并发请求，审计日志无丢失、无乱序 |
| ATB-4.3 | 性能基准 | QPS 下降 ≤ 5% |

---

## 开发切入层级序列

### Phase 2 实施路径

```
┌─────────────────────────────────────────────────────────────────┐
│ Level 1: 基础设施层                                              │
├─────────────────────────────────────────────────────────────────┤
│ [1.1] 统一 AuditService 实现路径                                 │
│       - 废弃 com.ams.aspect.AuditAspect（若存在）               │
│       - 合并到 com.ams.service.AuditService                      │
│       - 定义统一接口 IAuditService                               │
│                                                                 │
│ [1.2] 完善 GeneralAuditEntry 实体                                │
│       - 字段对齐业务需求                                         │
│       - 添加必要索引（user_id, operation, timestamp）            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Level 2: 切面核心层                                              │
├─────────────────────────────────────────────────────────────────┤
│ [2.1] 重构 AuditAspect.java                                      │
│       - @Aspect + @Component 注解                                │
│       - @Pointcut 优化：匹配所有 @Auditable 标注方法             │
│       - @Around 拦截：提取方法签名、参数、返回值                   │
│                                                                 │
│ [2.2] 实现审计信息提取逻辑                                       │
│       - JoinPoint.getSignature() → 方法全限定名                 │
│       - JoinPoint.getArgs() → 请求参数                           │
│       - @Auditable.operationType() → 操作类型                   │
│       - MethodSignature.getReturnType() → 目标实体类型           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Level 3: 业务覆盖层                                              │
├─────────────────────────────────────────────────────────────────┤
│ [3.1] 审计孤岛识别                                               │
│       - 扫描 Service 层所有变更方法                              │
│       - 对比已有 @Auditable 标注                                 │
│       - 输出遗漏清单                                             │
│                                                                 │
│ [3.2] 补充 @Auditable 标注                                       │
│       - 为遗漏的关键业务方法添加注解                              │
│       - 指定 operationType（CREATE/UPDATE/DELETE）               │
│       - 指定 targetEntity（操作对象类型）                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Level 4: 验证与收尾                                              │
├─────────────────────────────────────────────────────────────────┤
│ [4.1] 运行 ATB-1~ATB-3 所有单元测试                              │
│ [4.2] 执行集成测试套件                                           │
│ [4.3] 更新 plan.md 进度记录（打 [x]）                            │
└─────────────────────────────────────────────────────────────────┘
```

### 关键切点配置建议

```java
// 推荐 Pointcut 表达式
@Pointcut("@annotation(com.ams.common.annotation.Auditable)")
public void auditableMethod() {}

@Pointcut("execution(* com.ams.service..*(..))")
public void serviceLayer() {}

@Pointcut("execution(* com.ams.controller..*(..))")
public void controllerLayer() {}
```

### 文件清单

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `backend/src/main/java/com/ams/config/AuditAspect.java` | 重构 | 切面核心实现 |
| `backend/src/main/java/com/ams/service/AuditService.java` | 合并 | 统一审计服务 |
| `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java` | 校验 | 实体字段完整性 |
| `backend/src/main/java/com/ams/common/annotation/Auditable.java` | 保留 | 审计注解接口 |
| `docs/plan.md` | 更新 | 标记 Phase 2 完成 ✅ |

---

## 执行备忘录

> **【强制】任务收尾检查清单**
> 
> - [ ] Phase 2 代码开发完成并通过本地测试
> - [ ] 所有 ATB 测试用例执行通过
> - [ ] **前往 `docs/plan.md` 或 `plan.md`，定位 Phase 2 章节，补充 `[x]` 标记或进度说明**
> - [ ] 如无 plan.md，在项目根目录创建 `SWARM-004-FINISHED.md` 记录完成状态
> - [ ] 禁止仅提交代码不更新文档

---

## 关联文件分析

### 核心切面文件
- `backend/src/main/java/com/ams/config/AuditAspect.java` - 主要切面实现（58 行）
- `backend/src/main/java/com/ams/aop/AuditAspect.java` - 备用切面实现（32 行）
- `Updated File: backend/src/main/java/com/ams/config/AuditAspect.java` - 更新版本（59 行）

### 注解与实体
- `backend/src/main/java/com/ams/annotation/Auditable.java` - 审计注解（12 行）
- `backend/src/main/java/com/ams/common/annotation/Auditable.java` - 公共审计注解
- `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java` - 审计条目实体

### 审计服务
- `backend/src/main/java/com/ams/service/AuditService.java` - 审计服务实现

### 关键 AC 验证点
- AC-001: 审计切面必须调用 AuditService
- AC-002: 审计数据必须写入 GeneralAuditEntry 实体
- AC-003: 解决审计日志孤岛，强制覆盖关键业务方法