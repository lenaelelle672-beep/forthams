# SWARM-004: AuditAspect.java 切面集成开发规格说明书

## 版本与修订历史

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| 1.0 | 2024-XX-XX | Graphify Team | 初始版本 |

---

## 1. 需求概述

### 1.1 业务目标

在 Graphify 知识图谱平台中实现统一的审计切面机制，通过 AOP (Aspect-Oriented Programming) 拦截核心业务方法的执行，记录操作轨迹、用户行为及系统变更，输出至 `GeneralAuditEntry` 实体并由 `AuditService` 服务层处理。

### 1.2 技术栈约束

- **语言**: Java 17+
- **框架**: Spring Boot 3.x + Spring AOP
- **持久化**: JPA/Hibernate (对应 `GeneralAuditEntry` 实体)
- **测试**: JUnit 5 + Mockito + Spring Test
- **静态验证**: AST 分析工具 (基于 `ast_dead_code_check.py` 模式)

### 1.3 当前痛点

1. 审计逻辑散落在各业务层，无法统一管控
2. 缺乏切面与实体的标准绑定规范
3. 未建立 AST 语法完整性验证流程

---

## 2. Phase 6 实施目标

参照 `plan.md` 中 Phase 拆解，本规格对准 **Phase 6: 切面集成与验证**：

| Phase | 描述 | 状态 |
|-------|------|------|
| Phase 1-5 | 核心框架搭建、实体定义、服务层实现 | 已完成 |
| **Phase 6** | **AuditAspect.java 切面开发 + AST 验证** | **进行中** |
| Phase 7 | 集成测试与性能调优 | 待执行 |

### 2.1 本次迭代交付物

1. `AuditAspect.java` - 审计切面类
2. `@Audited` 自定义注解
3. 单元测试覆盖切面逻辑
4. AST 语法验证通过

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 规则 |
|--------|------|
| 拦截范围 | 仅标注 `@Audited` 的方法，不做全局拦截 |
| 异步处理 | 审计写入必须异步 (`@Async`)，不得阻塞主业务 |
| 异常处理 | 切面异常不得传播至业务方法 |
| 嵌套调用 | 仅记录最外层调用，忽略内部自调用 |
| 序列化 | `GeneralAuditEntry` 字段变更需同步更新切面绑定 |

### 3.2 技术边界

- 切面类位于 `com.graphify.audit.aspect` 包
- 切面优先级 `@Order(Ordered.LOWEST_PRECEDENCE - 1)`
- 禁止在切面中直接操作数据库，应委托 `AuditService`

### 3.3 依赖约束

```
AuditAspect --> GeneralAuditEntry (Entity)
AuditAspect --> AuditService (Service)
AuditAspect --> AuditAspectTest (Test)
```

---

## 4. 架构设计

### 4.1 包结构

```
com.graphify.audit
├── annotation/
│   ├── Audited.java          # 自定义审计注解
│   └── AuditLevel.java       # 审计级别枚举
├── aspect/
│   ├── AuditAspect.java      # 核心切面类
│   └── AuditContext.java     # 审计上下文持有者
├── entity/
│   └── GeneralAuditEntry.java  # 审计实体 (已存在)
├── service/
│   ├── AuditService.java     # 审计服务接口 (已存在)
│   └── AuditServiceImpl.java # 审计服务实现
└── test/
    └── AuditAspectTest.java  # 切面单元测试
```

### 4.2 组件关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Controller                               │
│                    (@RestController)                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │ 调用
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│              (@Service + @Audited)                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ AOP 拦截
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AuditAspect                                 │
│                  (@Aspect + @Component)                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ @Around("@annotation(audited)")                             ││
│  │ 1. 提取方法签名与参数                                        ││
│  │ 2. 序列化方法参数为 JSON                                     ││
│  │ 3. 执行业务方法 (proceed)                                    ││
│  │ 4. 捕获返回值/异常                                           ││
│  │ 5. 异步写入审计记录                                          ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │ 委托
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AuditService                                │
│                  (@Service + @Async)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ logAudit(GeneralAuditEntry entry)                           ││
│  │  - 异步执行，不阻塞主业务                                    ││
│  │  - 事务传播: REQUIRES_NEW                                   ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │ 持久化
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GeneralAuditEntry                              │
│                      (@Entity)                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. 接口规格

### 5.1 @Audited 注解

```java
package com.graphify.audit.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记需要审计的业务方法
 * 
 * <p>使用示例:</p>
 * <pre>
 * {@code
 * @Audited(action = "CREATE_ASSET", level = AuditLevel.INFO)
 * public Asset createAsset(AssetCreateDTO dto) {
 *     // 业务逻辑
 * }
 * }
 * </pre>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    
    /**
     * 操作名称，用于标识具体业务操作
     * 
     * @return 操作名称
     */
    String action() default "";
    
    /**
     * 审计级别
     * 
     * @return 审计级别枚举值
     */
    AuditLevel level() default AuditLevel.INFO;
    
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
}
```

### 5.2 AuditLevel 枚举

```java
package com.graphify.audit.annotation;

/**
 * 审计级别枚举
 */
public enum AuditLevel {
    /** 调试级别 - 详细信息 */
    DEBUG,
    
    /** 信息级别 - 一般操作记录 */
    INFO,
    
    /** 警告级别 - 需要关注的操作 */
    WARN,
    
    /** 错误级别 - 操作失败或异常 */
    ERROR
}
```

### 5.3 AuditAspect 切面类

```java
package com.graphify.audit.aspect;

import com.graphify.audit.annotation.Audited;
import com.graphify.audit.annotation.AuditLevel;
import com.graphify.audit.entity.GeneralAuditEntry;
import com.graphify.audit.service.AuditService;
import com.graphify.security.context.SecurityContextHolder;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 审计切面类
 * 
 * <p>拦截所有标注 @Audited 注解的方法，记录审计日志</p>
 * 
 * <p>设计原则:</p>
 * <ul>
 *   <li>异步写入，不阻塞主业务</li>
 *   <li>异常隔离，不影响业务方法执行</li>
 *   <li>嵌套调用过滤，只记录最外层</li>
 * </ul>
 */
@Aspect
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 1)
public class AuditAspect {
    
    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);
    
    @Autowired
    private AuditService auditService;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    /**
     * 切面拦截方法
     * 
     * @param pjp    连接点
     * @param audited 审计注解
     * @return 业务方法返回值
     * @throws Throwable 业务方法抛出的异常
     */
    @Around("@annotation(audited)")
    public Object around(ProceedingJoinPoint pjp, Audited audited) throws Throwable {
        long startTime = System.currentTimeMillis();
        
        // 1. 提取方法签名
        MethodSignature signature = (MethodSignature) pjp.getSignature();
        String className = signature.getDeclaringType().getSimpleName();
        String methodName = signature.getMethod().getName();
        
        // 2. 序列化参数
        String argsJson = serializeArgs(pjp, audited);
        
        // 3. 执行业务方法
        Object result = null;
        Throwable exception = null;
        try {
            result = pjp.proceed();
            return result;
        } catch (Throwable e) {
            exception = e;
            throw e;
        } finally {
            // 4. 异步写入审计记录
            long duration = System.currentTimeMillis() - startTime;
            try {
                writeAuditEntry(pjp, audited, className, methodName, argsJson, 
                               result, exception, duration);
            } catch (Exception e) {
                log.error("审计记录写入失败", e);
            }
        }
    }
    
    /**
     * 序列化方法参数
     */
    private String serializeArgs(ProceedingJoinPoint pjp, Audited audited) {
        if (!audited.logArgs()) {
            return null;
        }
        try {
            Object[] args = pjp.getArgs();
            if (args == null || args.length == 0) {
                return "[]";
            }
            Map<String, Object> argsMap = new HashMap<>();
            MethodSignature signature = (MethodSignature) pjp.getSignature();
            String[] paramNames = signature.getParameterNames();
            for (int i = 0; i < args.length; i++) {
                String key = paramNames != null && i < paramNames.length 
                    ? paramNames[i] 
                    : "arg" + i;
                argsMap.put(key, sanitizeArg(args[i]));
            }
            return objectMapper.writeValueAsString(argsMap);
        } catch (Exception e) {
            log.warn("参数序列化失败", e);
            return "[]";
        }
    }
    
    /**
     * 清理敏感参数
     */
    private Object sanitizeArg(Object arg) {
        if (arg == null) {
            return null;
        }
        // 过滤密码等敏感字段
        if (arg instanceof String && ((String) arg).contains("password")) {
            return "***";
        }
        return arg;
    }
    
    /**
     * 异步写入审计记录
     */
    private void writeAuditEntry(ProceedingJoinPoint pjp, Audited audited,
                                  String className, String methodName,
                                  String argsJson, Object result,
                                  Throwable exception, long duration) {
        String userId = getCurrentUserId();
        String action = audited.action();
        AuditLevel level = audited.level();
        
        // 如果未指定 action，使用方法名
        if (action == null || action.isEmpty()) {
            action = methodName;
        }
        
        GeneralAuditEntry entry = GeneralAuditEntry.builder()
            .className(className)
            .methodName(methodName)
            .userId(userId)
            .action(action)
            .args(argsJson)
            .returnValue(audited.logReturnValue() && exception == null 
                ? serializeReturnValue(result) : null)
            .exception(exception != null ? exception.getClass().getSimpleName() : null)
            .level(level.name())
            .timestamp(LocalDateTime.now())
            .build();
        
        // 委托 AuditService 异步写入
        auditService.logAudit(entry);
    }
    
    /**
     * 序列化返回值
     */
    private String serializeReturnValue(Object result) {
        if (result == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.warn("返回值序列化失败", e);
            return result.toString();
        }
    }
    
    /**
     * 获取当前用户ID
     */
    private String getCurrentUserId() {
        try {
            return SecurityContextHolder.getCurrentUserId();
        } catch (Exception e) {
            return "SYSTEM";
        }
    }
}
```

### 5.4 AuditService 接口

```java
package com.graphify.audit.service;

import com.graphify.audit.entity.GeneralAuditEntry;
import java.util.List;

/**
 * 审计服务接口
 */
public interface AuditService {
    
    /**
     * 异步记录审计日志
     * 
     * @param entry 审计实体
     */
    void logAudit(GeneralAuditEntry entry);
    
    /**
     * 根据用户ID查询审计记录
     * 
     * @param userId 用户ID
     * @return 审计记录列表
     */
    List<GeneralAuditEntry> findByUserId(String userId);
    
    /**
     * 根据操作类型查询审计记录
     * 
     * @param action 操作类型
     * @return 审计记录列表
     */
    List<GeneralAuditEntry> findByAction(String action);
}
```

---

## 6. GeneralAuditEntry 实体规格

### 6.1 实体定义

```java
package com.graphify.audit.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * 通用审计实体
 * 
 * <p>存储所有需要审计的操作记录</p>
 */
@Entity
@Table(name = "general_audit_entry")
public class GeneralAuditEntry {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * 类名
     */
    @Column(name = "class_name", length = 100)
    private String className;
    
    /**
     * 方法名
     */
    @Column(name = "method_name", length = 100)
    private String methodName;
    
    /**
     * 用户ID
     */
    @Column(name = "user_id", length = 50)
    private String userId;
    
    /**
     * 操作名称
     */
    @Column(name = "action", length = 100)
    private String action;
    
    /**
     * 方法参数 (JSON格式)
     */
    @Column(name = "args", columnDefinition = "TEXT")
    private String args;
    
    /**
     * 返回值 (JSON格式)
     */
    @Column(name = "return_value", columnDefinition = "TEXT")
    private String returnValue;
    
    /**
     * 异常类型
     */
    @Column(name = "exception", length = 200)
    private String exception;
    
    /**
     * 审计级别
     */
    @Column(name = "level", length = 20)
    private String level;
    
    /**
     * 审计时间
     */
    @Column(name = "timestamp")
    private LocalDateTime timestamp;
    
    // 构造函数
    public GeneralAuditEntry() {}
    
    public GeneralAuditEntry(String className, String methodName, String userId,
                            String action, String args, String returnValue,
                            String exception, String level, LocalDateTime timestamp) {
        this.className = className;
        this.methodName = methodName;
        this.userId = userId;
        this.action = action;
        this.args = args;
        this.returnValue = returnValue;
        this.exception = exception;
        this.level = level;
        this.timestamp = timestamp;
    }
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }
    
    public String getMethodName() { return methodName; }
    public void setMethodName(String methodName) { this.methodName = methodName; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    
    public String getArgs() { return args; }
    public void setArgs(String args) { this.args = args; }
    
    public String getReturnValue() { return returnValue; }
    public void setReturnValue(String returnValue) { this.returnValue = returnValue; }
    
    public String getException() { return exception; }
    public void setException(String exception) { this.exception = exception; }
    
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
    
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
    
    // Builder 模式
    public static Builder builder() { return new Builder(); }
    
    public static class Builder {
        private String className;
        private String methodName;
        private String userId;
        private String action;
        private String args;
        private String returnValue;
        private String exception;
        private String level;
        private LocalDateTime timestamp;
        
        public Builder className(String className) { this.className = className; return this; }
        public Builder methodName(String methodName) { this.methodName = methodName; return this; }
        public Builder userId(String userId) { this.userId = userId; return this; }
        public Builder action(String action) { this.action = action; return this; }
        public Builder args(String args) { this.args = args; return this; }
        public Builder returnValue(String returnValue) { this.returnValue = returnValue; return this; }
        public Builder exception(String exception) { this.exception = exception; return this; }
        public Builder level(String level) { this.level = level; return this; }
        public Builder timestamp(LocalDateTime timestamp) { this.timestamp = timestamp; return this; }
        
        public GeneralAuditEntry build() {
            return new GeneralAuditEntry(className, methodName, userId, action,
                                        args, returnValue, exception, level, timestamp);
        }
    }
}
```

---

## 7. 验收测试基准 (ATB)

### 7.1 ATB-1: 切面实例化验证

```java
@Test
@DisplayName("ATB-1: 切面实例化验证")
void auditAspect_wireframe_instantiated() {
    // 物理测试期待: ApplicationContext 启动后 AuditAspect bean 存在
    assertThat(applicationContext.getBean(AuditAspect.class)).isNotNull();
}
```

### 7.2 ATB-2: 方法拦截验证

```java
@Test
@DisplayName("ATB-2: 方法拦截验证")
void audited_method_intercepted_and_auditEntry_created() {
    // 物理测试期待: 调用 @Audited 方法后 GeneralAuditEntry 记录被创建
    yourService.performAuditedOperation();
    
    // 等待异步写入完成
    await().atMost(2, TimeUnit.SECONDS)
           .untilAsserted(() -> {
               GeneralAuditEntry entry = auditEntryRepository.findAll().get(0);
               assertThat(entry.getMethodName()).isEqualTo("performAuditedOperation");
               assertThat(entry.getTimestamp()).isNotNull();
           });
}
```

### 7.3 ATB-3: 异常隔离验证

```java
@Test
@DisplayName("ATB-3: 异常隔离验证")
void aspect_exception_does_not_propagate() {
    // 物理测试期待: 切面异常被捕获，业务方法正常抛出原始异常
    assertThatThrownBy(() -> yourService.auditedMethodThrows())
        .isInstanceOf(CustomBusinessException.class);
    
    // 审计仍被记录
    await().atMost(2, TimeUnit.SECONDS)
           .untilAsserted(() -> 
               assertThat(auditEntryRepository.count()).isEqualTo(1));
}
```

### 7.4 ATB-4: 异步写入验证

```java
@Test
@DisplayName("ATB-4: 异步写入验证")
void audit_write_is_async_nonBlocking() {
    // 物理测试期待: 主业务方法返回时间不包含审计写入耗时
    long start = System.currentTimeMillis();
    yourService.performAuditedOperation();
    long elapsed = System.currentTimeMillis() - start;
    
    // 审计写入在异步线程，主业务不应被阻塞
    assertThat(elapsed).isLessThan(100);
}
```

### 7.5 ATB-5: AST 语法完整性验证

```bash
# 物理测试期待: Python AST 分析器验证 Java 源文件语法
python scripts/ast_dead_code_check.py \
    --target backend/src/main/java/com/ams/aspect/AuditAspect.java \
    --validate-syntax

# 期待输出: syntax_valid=true, node_count >= 15
```

### 7.6 ATB-6: 切面与实体绑定验证

```java
@Test
@DisplayName("ATB-6: 切面与实体绑定验证")
void auditEntry_entity_fields_bound_to_aspect() {
    // 触发审计方法
    yourService.performAuditedOperation();
    
    // 等待异步写入
    await().atMost(2, TimeUnit.SECONDS)
           .untilAsserted(() -> {
               GeneralAuditEntry entry = captureFirstEntry();
               
               // 验证所有字段均被正确赋值
               assertThat(entry.getClassName()).isNotBlank();
               assertThat(entry.getMethodName()).isNotBlank();
               assertThat(entry.getUserId()).isNotNull();
               assertThat(entry.getArgs()).isNotNull();
               assertThat(entry.getReturnValue()).isNotNull();
               assertThat(entry.getLevel()).isNotNull();
               assertThat(entry.getTimestamp()).isNotNull();
           });
}
```

---

## 8. 使用示例

### 8.1 在业务方法上使用 @Audited

```java
@Service
public class AssetService {
    
    @Autowired
    private AssetRepository assetRepository;
    
    /**
     * 创建资产
     */
    @Audited(action = "CREATE_ASSET", level = AuditLevel.INFO)
    public Asset createAsset(AssetCreateDTO dto) {
        Asset asset = new Asset();
        asset.setName(dto.getName());
        asset.setCode(dto.getCode());
        return assetRepository.save(asset);
    }
    
    /**
     * 更新资产
     */
    @Audited(action = "UPDATE_ASSET", level = AuditLevel.WARN, logArgs = false)
    public Asset updateAsset(Long id, AssetUpdateDTO dto) {
        Asset asset = assetRepository.findById(id)
            .orElseThrow(() -> new AssetNotFoundException(id));
        asset.setName(dto.getName());
        return assetRepository.save(asset);
    }
    
    /**
     * 删除资产
     */
    @Audited(action = "DELETE_ASSET", level = AuditLevel.ERROR)
    public void deleteAsset(Long id) {
        assetRepository.deleteById(id);
    }
}
```

### 8.2 配置异步审计

```java
@Configuration
@EnableAsync
public class AsyncConfig {
    
    @Bean(name = "auditExecutor")
    public Executor auditExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("Audit-");
        executor.initialize();
        return executor;
    }
}
```

---

## 9. 文件清单

| 文件路径 | 类型 | 描述 |
|----------|------|------|
| `backend/src/main/java/com/ams/annotation/Audited.java` | 新增 | 自定义审计注解 |
| `backend/src/main/java/com/ams/annotation/AuditLevel.java` | 新增 | 审计级别枚举 |
| `backend/src/main/java/com/ams/aspect/AuditAspect.java` | 新增 | 核心审计切面类 |
| `backend/src/main/java/com/ams/aspect/AuditContext.java` | 新增 | 审计上下文 |
| `backend/src/main/java/com/ams/service/AuditService.java` | 已有 | 审计服务接口 |
| `backend/src/main/java/com/ams/service/impl/AuditServiceImpl.java` | 新增 | 审计服务实现 |
| `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java` | 已有 | 审计实体 |
| `backend/src/test/java/com/ams/aspect/AuditAspectTest.java` | 新增 | 切面单元测试 |

---

## 10. 风险与缓解

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| 异步写入失败导致审计数据丢失 | 中 | 添加重试机制 + 降级日志 |
| 切面性能影响主业务 | 低 | 确保异步执行，方法级别拦截 |
| 序列化异常影响业务 | 低 | try-catch 隔离，异常不传播 |
| 嵌套调用重复记录 | 中 | 使用 ThreadLocal 标记执行状态 |

---

## 11. 后续规划

- **Phase 7**: 集成测试与性能调优
  - 全链路集成测试
  - 性能基准测试
  - 压力测试
  - 生产环境部署验证

---

## 12. 附录

### 12.1 AST 验证脚本使用

```python
# scripts/ast_dead_code_check.py 用法示例
python scripts/ast_dead_code_check.py \
    --target backend/src/main/java/com/ams/aspect/AuditAspect.java \
    --validate-syntax \
    --output-format json
```

### 12.2 参考文献

- Spring AOP Documentation: https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#aop
- AspectJ Annotation: https://www.eclipse.org/aspectj/doc/released/adk15notebook/annotations-ajs.html
- JUnit 5 User Guide: https://junit.org/junit5/docs/current/user-guide/

---

**文档状态**: 已完成  
**审批状态**: 待审批  
**下次审查日期**: 2024-XX-XX