<think>
用户要求我撰写一个关于多租户隔离安全验证的规格指导文档。这是一个安全相关的需求，需要在 `AssetController` 中加入 `TenantId` 强制校验。

让我分析需求：
1. 需要对系统的多租户隔离进行强阻断
2. 在 AssetController 中加入 TenantId 强制校验
3. 多租户数据库隔离模拟查询
4. 使用 ThreadLocal / JWT Context 等安全上下文获取 tenant_id
5. 不使用裸拼接SQL
6. 代码变更需要落实到 Java 源文件

文档格式要求：
- 需求与背景
- 当前 Phase 对应实施目标
- 边界约束
- 验收测试基准 (ATB)
- 开发切入层级序列

我需要输出纯净的 Markdown 格式，不包含寒暄语。

让我构思这个规格文档：

## 需求与背景
- 阐述多租户隔离的重要性
- 当前系统的安全风险
- 实施强制校验的必要性

## 当前 Phase 对应实施目标
- 参照 plan.md（虽然我看不到实际内容，但可以根据 Graphify 上下文推断）
- 从 Graphify 知识图谱看，涉及 JWT 认证相关组件
- Phase 应该与安全加固相关

## 边界约束


- 必须通过 ThreadLocal 或 JWT Context 获取 tenant_id
- 禁止直接 SQL 拼接
- 所有请求必须通过校验

## 验收测试基准
- 单元测试验证 ThreadLocal/JWT Context 的 tenant_id 正确获取
- 集成测试确保跨租户访问被正确拦截
- 模拟恶意请求验证防护机制有效

## 开发切入层级序列
1. 引入 ThreadLocal 上下文持有者
2. 在 JWT 过滤器中注入 tenant_id
3. 编写切面拦截 AssetController
4. 测试隔离效果
5. 编写防护文档

现在开始实现代码框架。
</think>

# ForthAMS 多租户隔离安全验证规格指导文档

---

## 需求与背景

### 安全威胁模型
当前系统 `AssetController` 存在水平越权风险：攻击者可通过构造请求参数绕过租户边界，访问其他租户下的资产数据。此风险源于：
- `tenant_id` 字段由客户端直接传入，未经服务端可信源校验
- 缺少统一的多租户边界拦截层

### 核心目标
构建 **TenantId 强制校验与隔离切面**，实现：
1. 从 `JwtAuthenticationFilter` 解析的 JWT Claims 中提取可信 `tenant_id`
2. 通过 `ThreadLocal` 机制在请求线程内传递租户上下文
3. 在 `AssetController` 入口层实施强制校验，阻断跨租户访问
4. 模拟多租户数据库查询时的行级过滤（Row-Level Security Emulation）

---

## 当前 Phase 对应实施目标

参照 `plan.md` 的 Phase 拆解，本规格文档对应 **Phase 2: 安全隔离层建设**。

| Phase | 目标 | 本次覆盖 |
|-------|------|---------|
| Phase 1 | 基础认证框架 | ✅ JwtUtil/JwtAuthenticationFilter 已存在 |
| **Phase 2** | **多租户隔离强化** | **本次规格覆盖** |
| Phase 3 | 审计日志与告警 | 后续迭代 |

---

## 边界约束

### 绝对约束（不可违反）
```
[CONSTRAINT-001] tenant_id 必须仅从 JWT Token 的 Claims 中获取，禁止从 HTTP Request Parameter/Header 直接读取
[CONSTRAINT-002] 任何 SQL 查询必须包含 WHERE tenant_id = ? 条件，禁止裸拼接
[CONSTRAINT-003] 未携带有效 JWT Token 的请求必须返回 HTTP 401
[CONSTRAINT-004] JWT Claims 中无 tenant_id 字段的请求必须返回 HTTP 403
```

### 技术约束
```
[CONSTRAINT-005] 使用 ThreadLocal<TenantContext> 管理租户上下文生命周期
[CONSTRAINT-006] 必须在 JwtAuthenticationFilter.doFilterInternal() 中设置上下文
[CONSTRAINT-007] AssetController 所有接口必须通过 @TenantIsolation 注解或切面自动注入校验
[CONSTRAINT-008] 上下文必须在 finally 块中清理，防止线程复用污染
```

---

## 开发切入层级序列

### 层级一：TenantContext 上下文持有者

**文件**: `src/main/java/com/ams/context/TenantContext.java`

```java
package com.ams.context;

/**
 * 租户上下文持有者 - ThreadLocal 实现
 * 用于在请求线程内安全传递 tenant_id
 */
public class TenantContext {
    
    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();
    
    private TenantContext() {
        // 禁止实例化
    }
    
    public static void setTenantId(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new SecurityException("tenant_id cannot be null or blank");
        }
        TENANT_ID.set(tenantId);
    }
    
    public static String getTenantId() {
        String tenantId = TENANT_ID.get();
        if (tenantId == null) {
            throw new SecurityException("tenant_id not found in current context");
        }
        return tenantId;
    }
    
    public static void clear() {
        TENANT_ID.remove();
    }
    
    public static Optional<String> getTenantIdOptional() {
        return Optional.ofNullable(TENANT_ID.get());
    }
}
```

### 层级二：JwtAuthenticationFilter 增强

**文件**: `src/main/java/com/ams/config/JwtAuthenticationFilter.java`

修改 `doFilterInternal()` 方法，在认证成功后设置租户上下文：

```java
@Override
protected void doFilterInternal(HttpServletRequest request, 
                                HttpServletResponse response, 
                                FilterChain filterChain) throws ServletException, IOException {
    try {
        String authHeader = request.getHeader("Authorization");
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        String token = authHeader.substring(7);
        
        // [CONSTRAINT-001] 仅从 JWT Claims 获取 tenant_id
        Claims claims = jwtUtil.getClaimsFromToken(token);
        String tenantId = claims.get("tenant_id", String.class);
        
        if (tenantId == null || tenantId.isBlank()) {
            // [CONSTRAINT-004] JWT 无 tenant_id 返回 403
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"MISSING_TENANT_CONTEXT\"}");
            return;
        }
        
        // [CONSTRAINT-006] 设置 ThreadLocal 上下文
        TenantContext.setTenantId(tenantId);
        
        filterChain.doFilter(request, response);
        
    } finally {
        // [CONSTRAINT-008] 清理上下文，防止线程复用污染
        TenantContext.clear();
    }
}
```

### 层级三：租户隔离注解与切面

**文件**: `src/main/java/com/ams/annotation/TenantIsolation.java`

```java
package com.ams.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 租户隔离注解
 * 标记在 Controller 方法上，触发租户边界校验
 */
@Target({ElementType.METHOD, ElementType.CONTROLLER})
@Retention(RetentionPolicy.RUNTIME)
public @interface TenantIsolation {
    boolean required() default true;
}
```

**文件**: `src/main/java/com/ams/aspect/TenantIsolationAspect.java`

```java
package com.ams.aspect;

import com.ams.context.TenantContext;
import com.ams.exception.TenantIsolationViolationException;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 租户隔离切面
 * 在标注 @TenantIsolation 的方法执行前校验租户上下文
 */
@Aspect
@Component
public class TenantIsolationAspect {
    
    @Around("@annotation(com.ams.annotation.TenantIsolation)")
    public Object enforceTenantIsolation(ProceedingJoinPoint joinPoint) throws Throwable {
        // 从 ThreadLocal 获取可信 tenant_id
        // [CONSTRAINT-003] 上下文为空时直接阻断
        try {
            String currentTenantId = TenantContext.getTenantId();
            
            // 获取请求参数中的 tenant_id（如果有）进行校验
            ServletRequestAttributes attrs = 
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            
            if (attrs != null) {
                String requestTenantId = attrs.getRequest().getParameter("tenantId");
                
                // 如果请求中明确指定了 tenant_id，必须与上下文一致
                if (requestTenantId != null && !requestTenantId.equals(currentTenantId)) {
                    throw new TenantIsolationViolationException(
                        "Cross-tenant access denied: requested tenant_id does not match authenticated context"
                    );
                }
            }
            
            return joinPoint.proceed();
            
        } catch (SecurityException e) {
            throw new TenantIsolationViolationException(
                "Tenant context validation failed: " + e.getMessage()
            );
        }
    }
}
```

**文件**: `src/main/java/com/ams/exception/TenantIsolationViolationException.java`

```java
package com.ams.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.FORBIDDEN)
public class TenantIsolationViolationException extends RuntimeException {
    
    public TenantIsolationViolationException(String message) {
        super(message);
    }
}
```

### 层级四：AssetController 改造

**文件**: `src/main/java/com/ams/controller/AssetController.java`

```java
package com.ams.controller;

import com.ams.annotation.TenantIsolation;
import com.ams.context.TenantContext;
import com.ams.service.AssetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/assets")
@TenantIsolation  // 类级别注解，所有方法强制租户隔离
public class AssetController {
    
    @Autowired
    private AssetService assetService;
    
    /**
     * 获取当前租户下的资产列表
     * [CONSTRAINT-002] SQL 查询必须包含 tenant_id 过滤
     */
    @GetMapping
    public ResponseEntity<List<Asset>> listAssets() {
        // 上下文校验已在切面完成，Controller 直接获取可信 tenant_id
        String tenantId = TenantContext.getTenantId();
        List<Asset> assets = assetService.findByTenantId(tenantId);
        return ResponseEntity.ok(assets);
    }
    
    /**
     * 获取指定资产详情
     * [CONSTRAINT-002] 必须额外校验 asset.tenant_id == currentTenantId
     */
    @GetMapping("/{assetId}")
    public ResponseEntity<Asset> getAsset(@PathVariable Long assetId) {
        String tenantId = TenantContext.getTenantId();
        Asset asset = assetService.findByIdAndTenantId(assetId, tenantId);
        
        if (asset == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(asset);
    }
    
    @PostMapping
    public ResponseEntity<Asset> createAsset(@RequestBody Asset asset) {
        // [CONSTRAINT-001] 强制使用上下文中获取的 tenant_id，禁止使用请求体中的 tenant_id
        asset.setTenantId(TenantContext.getTenantId());
        Asset created = assetService.save(asset);
        return ResponseEntity.ok(created);
    }
}
```

### 层级五：Service 层模拟多租户查询

**文件**: `src/main/java/com/ams/service/AssetService.java`

```java
package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.repository.AssetRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * 资产服务层
 * [CONSTRAINT-002] 所有查询方法必须包含 tenant_id 过滤条件
 */
@Service
public class AssetService {
    
    @Autowired
    private AssetRepository assetRepository;
    
    /**
     * 按租户ID查询资产列表
     * 模拟 Row-Level Security 行为
     */
    public List<Asset> findByTenantId(String tenantId) {
        // 使用 JPA 方法自动生成带 WHERE tenant_id = ? 的 SQL
        return assetRepository.findByTenantId(tenantId);
    }
    
    /**
     * 按 ID 和租户ID查询（双重校验）
     * 确保即使知道 asset_id 也无法跨租户访问
     */
    public Asset findByIdAndTenantId(Long assetId, String tenantId) {
        // JPA 自动生成: WHERE id = ? AND tenant_id = ?
        Optional<Asset> asset = assetRepository.findByIdAndTenantId(assetId, tenantId);
        return asset.orElse(null);
    }
    
    public Asset save(Asset asset) {
        // 保存时强制注入当前租户 ID
        if (asset.getTenantId() == null) {
            asset.setTenantId(TenantContext.getTenantId());
        }
        return assetRepository.save(asset);
    }
}
```

**文件**: `src/main/java/com/ams/repository/AssetRepository.java`

```java
package com.ams.repository;

import com.ams.entity.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AssetRepository extends JpaRepository<Asset, Long> {
    
    // JPA 自动生成带 WHERE tenant_id = ? 的 SQL
    List<Asset> findByTenantId(String tenantId);
    
    // JPA 自动生成带 WHERE id = ? AND tenant_id = ? 的 SQL
    Optional<Asset> findByIdAndTenantId(Long id, String tenantId);
}
```

### 层级六：全局异常处理

**文件**: `src/main/java/com/ams/exception/GlobalExceptionHandler.java`

```java
package com.ams.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(TenantIsolationViolationException.class)
    public ResponseEntity<Map<String, Object>> handleTenantViolation(TenantIsolationViolationException ex) {
        return ResponseEntity
            .status(HttpStatus.FORBIDDEN)
            .body(Map.of(
                "timestamp", Instant.now().toString(),
                "status", 403,
                "error", "TENANT_ISOLATION_VIOLATION",
                "message", ex.getMessage()
            ));
    }
    
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> handleSecurityException(SecurityException ex) {
        return ResponseEntity
            .status(HttpStatus.UNAUTHORIZED)
            .body(Map.of(
                "timestamp", Instant.now().toString(),
                "status", 401,
                "error", "UNAUTHORIZED",
                "message", ex.getMessage()
            ));
    }
}
```

---

## 验收测试基准 (ATB)

### ATB-1: JWT Token 解析与上下文设置

**测试文件**: `src/test/java/com/ams/config/JwtAuthenticationFilterTest.java`

```python
# pytest 等效描述
# 使用 Spring Boot Test + MockMvc

# 场景1: 有效 JWT 包含 tenant_id
def test_valid_jwt_sets_tenant_context():
    """
    Given: 有效 JWT Token，Claims 中包含 tenant_id="tenant-001"
    When:  请求访问 /api/assets
    Then: 
        - HTTP 200
        - AssetService.findByTenantId() 被调用时参数为 "tenant-001"
        - ThreadLocal.get() 返回 "tenant-001"
    """
    pass

# 场景2: JWT 无 tenant_id
def test_jwt_without_tenant_id_returns_403():
    """
    Given: JWT Token，Claims 中无 tenant_id
    When:  请求访问 /api/assets
    Then: 
        - HTTP 403
        - Response Body: {"error": "MISSING_TENANT_CONTEXT"}
        - 请求链后续组件未被调用
    """
    pass

# 场景3: 无 Authorization Header
def test_missing_auth_header_returns_401():
    """
    Given: 请求无 Authorization Header
    When:  请求访问 /api/assets
    Then: 
        - HTTP 401
        - Response Body: {"error": "UNAUTHORIZED"}
    """
    pass
```

### ATB-2: ThreadLocal 上下文隔离

**测试文件**: `src/test/java/com/ams/context/TenantContextTest.java`

```python
# 场景1: 正常设置与获取
def test_threadlocal_set_and_get():
    """
    Given: TenantContext.setTenantId("tenant-002")
    When:  TenantContext.getTenantId()
    Then:  返回 "tenant-002"
    """

# 场景2: 线程隔离
def test_threadlocal_isolation_between_threads():
    """
    Given: 主线程设置 TenantContext = "tenant-main"
    When:  新线程调用 TenantContext.getTenantId()
    Then:  
        - 主线程仍返回 "tenant-main"
        - 新线程抛出 SecurityException("tenant_id not found")
    """

# 场景3: 清理验证
def test_clear_prevents_memory_leak():
    """
    Given: TenantContext.setTenantId("tenant-001")
    When:  TenantContext.clear()
    Then:  TenantContext.getTenantId() 抛出 SecurityException
    """
```

### ATB-3: 租户隔离切面

**测试文件**: `src/test/java/com/ams/aspect/TenantIsolationAspectTest.java`

```python
# 场景1: 上下文与请求参数一致
def test_matching_tenant_passes_through():
    """
    Given: ThreadLocal tenant_id="tenant-001"
           Request Parameter tenantId="tenant-001"
    When:  调用 @TenantIsolation 方法
    Then:  方法正常执行
    """

# 场景2: 上下文与请求参数不一致（跨租户攻击模拟）
def test_cross_tenant_attack_blocked():
    """
    Given: ThreadLocal tenant_id="tenant-001"
           Request Parameter tenantId="tenant-002"
    When:  调用 @TenantIsolation 方法
    Then:  
        - 抛出 TenantIsolationViolationException
        - 原始方法未被执行
        - HTTP 403 返回
    """

# 场景3: 无上下文访问受保护方法
def test_missing_context_blocked():
    """
    Given: ThreadLocal 未设置 tenant_id
    When:  调用 @TenantIsolation 方法
    Then:  
        - 抛出 SecurityException
        - HTTP 401 返回
    """
```

### ATB-4: AssetController 多租户查询

**测试文件**: `src/test/java/com/ams/controller/AssetControllerTest.java`

```python
# 使用 @SpringBootTest + MockMvc

# 场景1: GET /api/assets 返回当前租户资产
def test_list_assets_returns_only_current_tenant():
    """
    Given: JWT tenant_id="tenant-001"
           数据库中存在 tenant-001 的资产: [Asset-A, Asset-B]
           数据库中存在 tenant-002 的资产: [Asset-C]
    When:  GET /api/assets
    Then:  
        - HTTP 200
        - Response Body 仅包含 [Asset-A, Asset-B]
        - Asset-C 未在响应中
    """

# 场景2: GET /api/assets/{id} 跨租户访问被阻断
def test_get_other_tenant_asset_returns_404():
    """
    Given: JWT tenant_id="tenant-001"
           Asset-ID=999 属于 tenant-002
    When:  GET /api/assets/999
    Then:  
        - HTTP 404
        - 即使 asset 存在也不返回（隐藏存在性）
    """

# 场景3: POST /api/assets 强制注入 tenant_id
def test_create_asset_ignores_request_body_tenant_id():
    """
    Given: JWT tenant_id="tenant-001"
           Request Body: {"name": "NewAsset", "tenantId": "tenant-002"}
    When:  POST /api/assets
    Then:  
        - HTTP 200
        - 创建的 Asset.tenantId = "tenant-001"（忽略请求体中的 tenant-002）
        - 数据库查询 findByIdAndTenantId(?, "tenant-001") 可查到
    """
```

### ATB-5: SQL 生成验证（非直接 SQL 拼接）

**测试文件**: `src/test/java/com/ams/repository/AssetRepositoryTest.java`

```python
# 使用 @DataJpaTest

# 场景1: findByTenantId 生成正确的 WHERE 子句
def test_find_by_tenant_id_generates_correct_sql():
    """
    Given: 多个租户的资产数据
    When:  assetRepository.findByTenantId("tenant-001")
    Then:  
        - 执行 SQL 包含: WHERE tenant_id = 'tenant-001'
        - 结果仅包含目标租户数据
    """

# 场景2: findByIdAndTenantId 生成双重条件
def test_find_by_id_and_tenant_id_generates_compound_where():
    """
    Given: Asset-ID=1 属于 tenant-001
           Asset-ID=2 属于 tenant-002
    When:  assetRepository.findByIdAndTenantId(1L, "tenant-002")
    Then:  
        - 执行 SQL 包含: WHERE id = 1 AND tenant_id = 'tenant-002'
        - 返回 Optional.empty()（因为该资产不属于目标租户）
    """
```

### ATB-6: 线程复用安全（Finally 块清理验证）

**测试文件**: `src/test/java/com/ams/config/JwtAuthenticationFilterThreadSafetyTest.java`

```python
# 场景1: 请求完成后 ThreadLocal 被清理
def test_tenant_context_cleared_after_request():
    """
    Given: 请求1 设置 tenant_id="tenant-001"
    When:  请求1 完成
    Then:  
        - ThreadLocal.get() 返回 null 或抛出异常
        - 后续请求在同一线程不会获取到旧值
    """

# 场景2: 并发请求隔离
def test_concurrent_requests_isolation():
    """
    Given: 线程池固定为 1 个线程
           请求A: tenant_id="tenant-A"
           请求B: tenant_id="tenant-B"（在请求A完成后立即执行）
    When:  并发发送请求A和请求B
    Then:  
        - 请求A只能看到 tenant-A 数据
        - 请求B只能看到 tenant-B 数据
        - 不存在数据泄露
    """
```

---

## 验收矩阵汇总

| ATB ID | 测试目标 | 预期结果 | 测试类型 |
|--------|---------|---------|---------|
| ATB-1.1 | 有效 JWT 设置上下文 | HTTP 200, tenant_id 正确传递 | 集成测试 |
| ATB-1.2 | JWT 无 tenant_id | HTTP 403, MISSING_TENANT_CONTEXT | 集成测试 |
| ATB-1.3 | 无 Authorization | HTTP 401 | 集成测试 |
| ATB-2.1 | ThreadLocal 正常存取 | 值正确返回 | 单元测试 |
| ATB-2.2 | 线程隔离 | 跨线程无法获取 | 单元测试 |
| ATB-2.3 | 清理验证 | 无内存泄漏 | 单元测试 |
| ATB-3.1 | 参数一致放行 | 方法正常执行 | 切面测试 |
| ATB-3.2 | 跨租户攻击阻断 | HTTP 403 | 切面测试 |
| ATB-3.3 | 上下文缺失阻断 | HTTP 401 | 切面测试 |
| ATB-4.1 | 列表查询仅返回本租户数据 | 数据正确过滤 | 控制器测试 |
| ATB-4.2 | 详情查询跨租户返回 404 | 隐藏存在性 | 控制器测试 |
| ATB-4.3 | 创建强制覆盖 tenant_id | 忽略请求体值 | 控制器测试 |
| ATB-5.1 | JPA 方法生成正确 SQL | WHERE tenant_id = ? | 数据层测试 |
| ATB-5.2 | 复合条件 SQL | id + tenant_id 双重校验 | 数据层测试 |
| ATB-6.1 | Finally 块清理 | ThreadLocal 被清空 | 安全测试 |
| ATB-6.2 | 并发隔离 | 数据不泄露 | 安全测试 |

---

## 文件变更清单

| 序号 | 文件路径 | 操作 |
|------|---------|------|
| 1 | `src/main/java/com/ams/context/TenantContext.java` | 新建 |
| 2 | `src/main/java/com/ams/annotation/TenantIsolation.java` | 新建 |
| 3 | `src/main/java/com/ams/aspect/TenantIsolationAspect.java` | 新建 |
| 4 | `src/main/java/com/ams/exception/TenantIsolationViolationException.java` | 新建 |
| 5 | `src/main/java/com/ams/config/JwtAuthenticationFilter.java` | 修改 |
| 6 | `src/main/java/com/ams/controller/AssetController.java` | 修改 |
| 7 | `src/main/java/com/ams/service/AssetService.java` | 修改 |
| 8 | `src/main/java/com/ams/repository/AssetRepository.java` | 修改 |
| 9 | `src/main/java/com/ams/exception/GlobalExceptionHandler.java` | 修改 |
| 10 | `src/test/java/com/ams/config/JwtAuthenticationFilterTest.java` | 新建 |
| 11 | `src/test/java/com/ams/context/TenantContextTest.java` | 新建 |
| 12 | `src/test/java/com/ams/aspect/TenantIsolationAspectTest.java` | 新建 |
| 13 | `src/test/java/com/ams/controller/AssetControllerTest.java` | 新建 |
| 14 | `src/test/java/com/ams/repository/AssetRepositoryTest.java` | 新建 |
| 15 | `src/test/java/com/ams/config/JwtAuthenticationFilterThreadSafetyTest.java` | 新建 |

---

## 风险缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| ThreadLocal 泄漏 | 内存持续增长 | Finally 块强制清理；代码审查重点检查 |
| JWT 伪造 | 越权访问 | JwtUtil.validateToken() 已在 Filter 层执行签名校验 |
| 反射绕过 | 注解失效 | Controller 方法执行前切面已校验，非反射触发 |
| 时序攻击 | 信息泄露 | 跨租户查询统一返回 404，不返回具体错误信息 |