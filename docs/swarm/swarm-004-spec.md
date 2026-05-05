# SWARM-004: AuditAspect.java 切面集成开发规格说明书

## 📋 文档信息

| 属性 | 内容 |
|------|------|
| **任务编号** | SWARM-004 |
| **任务名称** | AuditAspect.java 切面集成开发 |
| **阶段** | Phase 6: 切面集成与验证 |
| **创建日期** | 2024-12-19 |
| **优先级** | P0 - 核心功能 |
| **状态** | 进行中 |

---

## 🎯 业务目标

在 Graphify 知识图谱平台中实现统一的审计切面机制，通过 AOP (Aspect-Oriented Programming) 拦截核心业务方法的执行，记录操作轨迹、用户行为及系统变更，输出至 `GeneralAuditEntry` 实体并由 `AuditService` 服务层处理。

### 核心价值
- **统一管控**: 审计逻辑集中管理，避免散落各业务层
- **标准绑定**: 切面与实体建立标准映射规范
- **零侵入**: 通过注解方式接入，不影响业务代码
- **异步写入**: 审计操作异步执行，不阻塞主业务流程

---

## 🔧 技术栈约束

| 组件 | 技术规格 |
|------|----------|
| **语言** | Java 17+ |
| **框架** | Spring Boot 3.x + Spring AOP |
| **持久化** | JPA/Hibernate (对应 `GeneralAuditEntry` 实体) |
| **测试** | JUnit 5 + Mockito + Spring Test |
| **静态验证** | AST 分析工具 (基于 `ast_dead_code_check.py` 模式) |

### 依赖关系图
```
┌─────────────────────────────────────────────────────────────┐
│                      @Auditable 注解                          │
│            (backend/src/main/java/com/ams/                   │
│                   common/annotation/Auditable.java)          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    AuditAspect 切面                           │
│            (backend/src/main/java/com/ams/                   │
│                      aspect/AuditAspect.java)                │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────┐     ┌─────────────────────────────────┐
│   GeneralAuditEntry   │     │       AuditService              │
│        实体类          │     │         服务层                   │
└───────────────────────┘     └─────────────────────────────────┘
```

---

## 📁 核心文件清单

### 1. 注解定义文件 (本次任务焦点)
```
backend/src/main/java/com/ams/common/annotation/Auditable.java
```

| 属性 | 值 |
|------|-----|
| **文件路径** | `backend/src/main/java/com/ams/common/annotation/Auditable.java` |
| **包名** | `com.ams.common.annotation` |
| **类型** | 自定义方法注解 |
| **目标元素** | `METHOD` |
| **保留策略** | `RUNTIME` |

### 2. 关联文件
| 文件 | 路径 | 职责 |
|------|------|------|
| `AuditAspect.java` | `backend/src/main/java/com/ams/aspect/AuditAspect.java` | 切面拦截逻辑实现 |
| `GeneralAuditEntry.java` | `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java` | 审计记录实体 |
| `AuditService.java` | `backend/src/main/java/com/ams/service/AuditService.java` | 审计服务接口 |
| `AuditAspectTest.java` | `backend/src/test/java/com/ams/aspect/AuditAspectTest.java` | 单元测试 |

---

## 📝 Auditable 注解设计

### 完整代码实现

```java
package com.ams.common.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 审计切面注解
 * 
 * 用于标记需要审计的业务方法，切面将拦截被标注的方法执行，
 * 记录操作轨迹、用户行为及系统变更。
 * 
 * 使用示例:
 * <pre>
 * {@code
 * @Auditable(action = "ASSET_CREATE", level = AuditLevel.INFO)
 * public Asset createAsset(AssetCreateDTO dto) {
 *     // 业务逻辑
 * }
 * }
 * </pre>
 * 
 * @author Graphify Team
 * @since 2024-12-19
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {

    /**
     * 审计操作类型
     * 用于区分不同类型的操作，如 CREATE、UPDATE、DELETE、QUERY 等
     * 
     * @return 操作类型编码
     */
    String action() default "";

    /**
     * 审计级别
     * 用于过滤不同重要程度的操作
     * 
     * @return 审计级别枚举
     */
    AuditLevel level() default AuditLevel.INFO;

    /**
     * 操作描述
     * 允许自定义操作描述，覆盖默认生成的描述
     * 
     * @return 操作描述文本
     */
    String description() default "";

    /**
     * 是否记录方法参数
     * 
     * @return true 记录参数，false 不记录
     */
    boolean logArgs() default true;

    /**
     * 是否记录返回值
     * 
     * @return true 记录返回值，false 不记录
     */
    boolean logReturnValue() default true;

    /**
     * 是否记录异常信息
     * 
     * @return true 记录异常，false 不记录
     */
    boolean logException() default true;
}
```

### 审计级别枚举

```java
package com.ams.common.annotation;

/**
 * 审计级别枚举
 * 
 * 用于标识操作的敏感程度，配合日志级别进行过滤
 */
public enum AuditLevel {
    
    /** 调试级别 - 仅开发环境使用 */
    DEBUG(0),
    
    /** 信息级别 - 普通业务操作 */
    INFO(1),
    
    /** 警告级别 - 需要关注的操作 */
    WARN(2),
    
    /** 错误级别 - 操作失败或异常 */
    ERROR(3),
    
    /** 严重级别 - 涉及敏感数据或权限变更 */
    CRITICAL(4);

    private final int level;

    AuditLevel(int level) {
        this.level = level;
    }

    public int getLevel() {
        return level;
    }

    /**
     * 判断当前级别是否需要记录
     * 
     * @param minLevel 最低需要记录的级别
     * @return true 如果需要记录
     */
    public boolean shouldLog(AuditLevel minLevel) {
        return this.level >= minLevel.level;
    }
}
```

---

## 🔒 边界约束

### 功能边界

| 约束项 | 规则 |
|--------|------|
| **拦截范围** | 仅标注 `@Auditable` 的方法，不做全局拦截 |
| **异步处理** | 审计写入必须异步 (`@Async`)，不得阻塞主业务 |
| **异常处理** | 切面异常不得传播至业务方法 |
| **嵌套调用** | 仅记录最外层调用，忽略内部自调用 |
| **序列化** | `GeneralAuditEntry` 字段变更需同步更新切面绑定 |

### 技术边界

| 边界项 | 约束 |
|--------|------|
| **包路径** | 注解位于 `com.ams.common.annotation` 包 |
| **切面优先级** | `@Order(Ordered.LOWEST_PRECEDENCE - 1)` |
| **数据库操作** | 禁止在切面中直接操作数据库，应委托 `AuditService` |
| **Spring 版本** | Spring Boot 3.x (Spring AOP 5.x) |

### 依赖约束

```
Auditable.java
    │
    ├──▶ AuditAspect.java (使用此注解)
    │
    └──▶ GeneralAuditEntry.java (审计目标实体)
```

---

## ✅ 验收测试基准 (ATB)

### ATB-1: 注解定义验证
```java
@Test
void auditable_annotation_exists_and_has_correct_attributes() {
    // 物理测试期待: @Auditable 注解存在且元数据正确
    Auditable annotation = Auditable.class.getAnnotation(Auditable.class);
    
    assertThat(annotation).isNotNull();
    assertThat(annotation.action()).isEqualTo("");
    assertThat(annotation.level()).isEqualTo(AuditLevel.INFO);
    assertThat(annotation.logArgs()).isTrue();
    assertThat(annotation.logReturnValue()).isTrue();
}
```

### ATB-2: 注解作用域验证
```java
@Test
void auditable_annotation_target_is_method_only() {
    // 物理测试期待: @Auditable 只能用于方法
    Target target = Auditable.class.getAnnotation(Target.class);
    
    assertThat(target).isNotNull();
    assertThat(target.value()).containsExactly(ElementType.METHOD);
}
```

### ATB-3: 注解保留策略验证
```java
@Test
void auditable_annotation_retention_is_runtime() {
    // 物理测试期待: @Auditable 在运行时可见
    Retention retention = Auditable.class.getAnnotation(Retention.class);
    
    assertThat(retention).isNotNull();
    assertThat(retention.value()).isEqualTo(RetentionPolicy.RUNTIME);
}
```

### ATB-4: 审计级别枚举验证
```java
@Test
void audit_level_enum_has_correct_values() {
    // 物理测试期待: 审计级别枚举值完整且可比较
    assertThat(AuditLevel.values()).hasSize(5);
    assertThat(AuditLevel.INFO.shouldLog(AuditLevel.DEBUG)).isTrue();
    assertThat(AuditLevel.DEBUG.shouldLog(AuditLevel.INFO)).isFalse();
}
```

### ATB-5: AST 语法完整性验证
```bash
# 物理测试期待: Python AST 分析器验证 Java 源文件语法
python scripts/ast_dead_code_check.py \
    --target backend/src/main/java/com/ams/common/annotation/Auditable.java \
    --validate-syntax

# 期待输出: syntax_valid=true, node_count >= 10
```

### ATB-6: 切面绑定验证
```java
@Test
void audited_method_intercepted_by_aspect() {
    // 物理测试期待: 使用 @Auditable 注解的方法被切面拦截
    @Auditable(action = "TEST_ACTION", level = AuditLevel.INFO)
    public void testMethod() {
        // 业务逻辑
    }
    
    // 验证方法调用后产生审计记录
    GeneralAuditEntry entry = captureFirstEntry();
    assertThat(entry.getAction()).isEqualTo("TEST_ACTION");
    assertThat(entry.getLevel()).isEqualTo("INFO");
}
```

---

## 🏗️ 开发切入层级序列

### L1: 注解定义 (当前层级)
```
backend/src/main/java/com/ams/common/annotation/Auditable.java
```

### L2: 实体确认
```java
// GeneralAuditEntry 必须包含字段
@Entity
public class GeneralAuditEntry {
    private Long id;
    private String className;        // 类名
    private String methodName;       // 方法名
    private String userId;           // 用户ID
    private String action;           // 操作类型 (from @Auditable)
    private String args;             // 参数 JSON
    private String returnValue;      // 返回值 JSON
    private String level;            // 审计级别
    private String description;      // 操作描述
    private LocalDateTime timestamp; // 时间戳
    private String exception;        // 异常信息
}
```

### L3: 切面核心实现
```java
// AuditAspect.java 关键逻辑
@Aspect
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 1)
public class AuditAspect {
    
    @Autowired private AuditService auditService;
    
    @Around("@annotation(auditable)")
    public Object around(ProceedingJoinPoint pjp, Auditable auditable) {
        // 1. 提取方法签名
        // 2. 序列化参数
        // 3. 执行业务方法
        // 4. 异步写入审计记录
        // 5. 捕获异常并记录
    }
}
```

### L4: 服务委托层
```java
// AuditService 接口
public interface AuditService {
    @Async
    void logAudit(GeneralAuditEntry entry);
    
    List<GeneralAuditEntry> findByUserId(String userId);
}

// AuditServiceImpl 实现
@Service
public class AuditServiceImpl implements AuditService {
    @Autowired private GeneralAuditEntryRepository repository;
    
    @Override
    @Async
    public void logAudit(GeneralAuditEntry entry) {
        repository.save(entry);
    }
}
```

### L5: 测试覆盖
- 单元测试: `AuditableTest.java` (ATB-1 ~ ATB-4)
- 集成测试: `AuditAspectIntegrationTest.java` (ATB-6)

---

## 📊 Phase 进度追踪

| Phase | 描述 | 状态 | 备注 |
|-------|------|------|------|
| Phase 1-5 | 核心框架搭建、实体定义、服务层实现 | ✅ 已完成 | |
| **Phase 6** | **Auditable 注解 + AuditAspect 切面开发** | **🔄 进行中** | 当前任务 |
| Phase 7 | 集成测试与性能调优 | ⏳ 待执行 | |

---

## 📌 强制文档落地指令

完成本次开发后，必须执行以下收尾动作：

### 1. 更新 plan.md
前往 `plan.md` 或 `docs/plan.md`，定位 **Phase 6** 并更新状态：

```markdown
## Phase 6: 切面集成与验证 [x]
- Auditable.java 注解: ✅ 完成
- AuditLevel 枚举: ✅ 完成
- AuditAspect.java: ✅ 完成
- ATB-1 ~ ATB-6: 全部通过
- AST 语法验证: ✅ 通过
- 文档更新: 2024-12-19
```

### 2. 验收确认清单
- [ ] `Auditable.java` 文件已创建
- [ ] `AuditLevel` 枚举已定义
- [ ] 所有 ATB 测试用例已编写
- [ ] AST 语法验证通过
- [ ] plan.md 已更新 Phase 6 状态

---

## 🔗 关联文档

| 文档 | 路径 | 关系 |
|------|------|------|
| 项目主规范 | `SPEC.md` | 父级文档 |
| 切面实现规范 | `backend/src/main/java/com/ams/aspect/AuditAspect.java` | 子级实现 |
| 测试规范 | `backend/src/test/java/com/ams/aspect/AuditAspectTest.java` | 验证文档 |
| AST 分析工具 | `scripts/ast_dead_code_check.py` | 静态验证 |

---

## 📝 变更日志

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2024-12-19 | 1.0.0 | 初始版本创建 | SWARM-004 |

---

**⚠️ 重要提示**: 本规范文档为 SWARM-004 任务的核心参考，所有开发工作必须严格遵循上述约束和验收标准。