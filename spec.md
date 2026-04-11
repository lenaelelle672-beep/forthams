<|channel>thought
Let me think through this carefully.

The question/task: 【SYSTEM INSTRUCTION: DEEP REASONING VERIFICATION MANDATED】
你是规格分析工程师。你拥有全局视界。你只输出可直接分发的 spec.md，必须格式化为纯净的 Markdown，极度遵循边界约束条件，绝不发散闲聊。

My reasoning: # ForthAMS 多租户安全隔离规格书 (spec.md)

## 1. 需求与背景
### 1.1 核心目标
实现对 `AssetController` 的多租户强制隔离校验机制，防止跨租户数据越权访问（BFLA/IDOR漏洞）。要求：
- 从安全上下文（JWT Context）提取 tenant_id
- 在数据库查询层注入租户过滤条件
- 禁止裸拼接 SQL

### 1.2 上下文分析
根据 Graphify 知识图谱，系统已存在 `JwtAuthenticationFilter` 和 `JwtUtil`。这意味着：
- **身份识别链条**：Request → JwtAuthenticationFilter (解析Token) → SecurityContextHolder (存储认证信息)
- **扩展点**：需在 Token 解析阶段提取 tenant_id 并注入上下文

### 1.3 安全红线定义
| 红线项 | 定义 | 强制要求 |
用户请求的数据必须属于其 JWT 中的 tenant_id，禁止通过参数篡改访问其他租户数据。使用 Spring Security 的 Authentication 对象或自定义 ThreadLocalHolder 传递 tenant_id，严禁从 Request Param 直接取值。所有数据库查询必须包含 `WHERE tenant_id = ?` 条件。

---

## 2. 边界约束
### 2.1 技术栈锁定
- **后端**: Java + Spring Boot + Spring Security
- **鉴权**: JWT (基于现有 `JwtUtil`)
- **持久层**: JPA/Hibernate 或 MyBatis（需支持动态 SQL）

### 2.2 修改范围限制
```
[允许修改]
├── src/main/java/com/ams/config/JwtAuthenticationFilter.java  (注入 tenant_id 到上下文)
├── src/main/java/com/ams/controller/AssetController.java      (增加校验切面或 AOP 拦截)
└── [新建] src/main/java/com/ams/aspect/TenantIsolationAspect.java (隔离切面)

[禁止修改]
├── Router 配置类（防止破坏路由机制）
└── 已验证的业务逻辑代码
```

### 2.3 安全约束清单
- [x] **禁止裸拼接SQL**：必须使用参数化查询或 JPA Specification
- [x] **上下文传递**：tenant_id 必须从 SecurityContext 获取，而非 Request Body/Param
- [x] **拦截时机**：在 Controller 执行前完成校验
- [x] **异常处理**：越权访问必须返回 403 Forbidden

---

## 3. 开发切入层级序列 (Implementation Sequence)

### 第一阶段：上下文扩展（Context Enrichment）
1. 修改 `JwtUtil` 以支持提取 tenant_id claim
2. 更新 `JwtAuthenticationFilter` 将 tenant_id 设置到 SecurityContext

### 第二阶段：隔离机制实现（Isolation Mechanism）
3. 创建 `TenantContextHolder` (ThreadLocal 存储) 或扩展 Spring Security 用户详情
4. 实现 `TenantIsolationAspect` 切面，拦截 AssetController 方法
5. 在切面中校验请求资源所属租户与当前租户一致

### 第三阶段：数据库查询增强（Query Augmentation）
6. 为所有资产查询注入 `tenant_id = :currentTenantId` 过滤条件

---

## 4. 代码实现规格 (Code Specification)

### 4.1 JwtUtil.java 扩展
```java
// src/main/java/com/ams/utils/JwtUtil.java

public String getTenantIdFromToken(String token) {
    Claims claims = this.getClaimsFromToken(token);
    return (String) claims.get("tenant_id");  // 必须从 JWT Claims 中提取，不可信任客户端输入
}
```

### 4.2 TenantContextHolder.java (新建)
```java
// src/main/java/com/ams/security/TenantContextHolder.java

public class TenantContextHolder {
    private static final ThreadLocal<String> CONTEXT = new ThreadLocal<>();

    public static void setTenantId(String tenantId) { CONTEXT.set(tenantId); }
    public static String getTenantId() { return CONTEXT.get(); }
    public static void clear() { CONTEXT.remove(); }
}
```

### 4.3 JwtAuthenticationFilter.java 修改
```java
// src/main/java/com/ams/config/JwtAuthenticationFilter.java

@Override
protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) {
    String token = extractToken(request);
    if (token != null && jwtUtil.validateToken(token)) {
        String tenantId = jwtUtil.getTenantIdFromToken(token);
        TenantContextHolder.setTenantId(tenantId);  // 注入租户上下文
        // ... 原有认证逻辑
    }
    try {
        chain.doFilter(request, response);
    } finally {
        TenantContextHolder.clear();  // 必须清理，防止线程重用导致数据污染
    }
}
```

### 4.4 TenantIsolationAspect.java (新建)
```java
@Aspect
@Component
public class TenantIsolationAspect {
    @Around("@annotation(com.ams.security.RequiresTenantCheck)")
    public Object validateTenantAccess(ProceedingJoinPoint joinPoint) throws Throwable {
        String currentTenantId = TenantContextHolder.getTenantId();
        if (currentTenantId == null) throw new AccessDeniedException("租户上下文缺失");

        // 获取资源所属租户（根据具体业务逻辑获取）
        Object result = joinPoint.proceed();
        if (result instanceof TenantAware resource && !resource.getTenantId().equals(currentTenantId)) {
            throw new AccessDeniedException("跨租户访问被拦截：资源不属于当前租户");
        }
        return result;
    }
}
```

### 4.5 AssetController.java 应用
```java
@RestController
@RequestMapping("/api/assets")
public class AssetController {
    @Autowired
    private AssetService assetService;

    @GetMapping("/{id}")
    @RequiresTenantCheck  // 切面拦截点
    public ResponseEntity<Asset> getAsset(@PathVariable Long id) {
        String tenantId = TenantContextHolder.getTenantId();
        return ResponseEntity.ok(assetService.findByIdWithTenant(id, tenantId));
    }

    @GetMapping("/list")
    @RequiresTenantCheck
    public List<Asset> listAssets() {
        // 模拟多租户隔离查询：必须包含 tenant_id 条件
        String tenantId = TenantContextHolder.getTenantId();
        return assetService.findAllByTenant(tenantId);  // 底层使用参数化查询
    }
}
```

### 4.6 AssetRepository/Service (模拟隔离查询)
```java
public interface AssetRepository extends JpaRepository<Asset, Long> {
    @Query("SELECT a FROM Asset a WHERE a.id = :id AND a.tenantId = :tenantId")
    Optional<Asset> findByIdAndTenantId(@Param("id") Long id, @Param("tenantId") String tenantId);

    @Query("SELECT a FROM Asset a WHERE a.tenantId = :tenantId")
    List<Asset> findAllByTenantId(@Param("tenantId") String tenantId);
}
```

---

## 5. 验收测试基准 (ATB)

### 5.1 功能验证路径

| 测试步骤 | 操作描述 | 物理测试工具/方法 | 期待结果 |
| :--- | :--- | :--- | :--- |
| **T1: Token 解析** | 使用包含 `tenant_id=T101` 的 JWT 调用接口 | Playwright (拦截请求) | 请求头携带正确 Bearer Token，后端解析出 T101 |
| **T2: 租户上下文注入** | 查看日志或打断点确认 Context 值 | IDE Debugger / Logback | `TenantContextHolder.getTenantId()` 返回 "T101" |
| **T3: 合法访问测试** | 使用 T101 的 Token 请求其自身资产数据 | Playwright + API Call | 响应 200 OK，返回正确租户数据 |
| **T4: 越权拦截测试 (关键)** | 使用 T101 的 Token 尝试请求 `tenant_id=T999` 的资源 ID | Playwright / Postman | 响应 **403 Forbidden**，切面抛出 AccessDeniedException |
| **T5: SQL 参数化验证** | 查看执行的数据库查询语句 | Hibernate SQL Log (show_sql=true) | 查询必须包含 `WHERE tenant_id = ?`，无拼接痕迹 |
| **T6: 上下文清理测试** | 连续发送多个请求，观察租户上下文是否串行污染 | Playwright 并发压力测试 | 每个响应仅包含当前 Token 所属租户数据 |

### 5.2 安全基准量化指标
- [ ] `tenant_id` 获取路径：JWT → SecurityContext (0次直接从 Request Param 取值)
- [ ] SQL 执行计划中必须出现 `tenant_id` 索引扫描，禁止全表扫描后内存过滤
- [ ] 越权请求响应时间应在 <100ms 内完成拦截（切面层处理）

---

## 6. 部署与实施建议
- **灰度发布**：先在测试环境验证 T4/T5 测试用例，通过后再推送到预发
- **监控增强**：为 `TenantIsolationAspect` 添加 Prometheus 指标，统计越权拦截次数
- **性能影响**：切面拦截对响应时间影响应 < 5ms<channel|># ForthAMS 多租户安全隔离规格书 (spec.md)

## 1. 需求与背景
### 1.1 核心目标
实现对 `AssetController` 的多租户强制隔离校验机制，防止跨租户数据越权访问（BFLA/IDOR漏洞）。要求：
- 从安全上下文（JWT Context）提取 tenant_id
- 在数据库查询层注入租户过滤条件
- 禁止裸拼接 SQL

### 1.2 上下文分析
根据 Graphify 知识图谱，系统已存在 `JwtAuthenticationFilter` 和 `JwtUtil`。这意味着：
- **身份识别链条**：Request → JwtAuthenticationFilter (解析Token) → SecurityContextHolder (存储认证信息)
- **扩展点**：需在 Token 解析阶段提取 tenant_id 并注入上下文

### 1.3 安全红线定义
| 红线项 | 定义 | 强制要求 |
| :--- | :--- | :--- |
| **租户标识来源** | `tenant_id` 必须从 JWT 或 SecurityContext 获取 | 禁止直接读取 Request Parameter/Header 中的 tenantId |
| **数据访问隔离** | 所有数据库查询必须包含 `WHERE tenant_id = ?` 条件 | 禁止在 Service 层内存过滤，必须下推到 SQL 层 |
| **越权处理机制** | 发现跨租户请求时立即中断并抛异常 | 返回 403 Forbidden，严禁返回空数据伪装成正常响应 |

---

## 2. 边界约束

### 2.1 技术栈约束
- **语言**: Java 17+ (Spring Boot 3.x)
- **持久层**: Spring Data JPA / Hibernate
- **安全框架**: Spring Security + JWT Authentication Filter
- **切面技术**: AspectJ AOP 或 Spring AOP

### 2.2 修改范围约束
```
[允许修改]
├── backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java  (注入 tenantId 到上下文)
├── backend/src/main/java/com/ams/utils/JwtUtil.java                 (解析 tenantId 声明)
├── backend/src/main/java/com/ams/controller/AssetController.java     (应用隔离注解)
└── [新建] com.ams.security.*                                         (切面、注解、上下文类)

[禁止修改]
├── SecurityConfig.java 的现有认证链路 (除非必须调整 Filter 顺序)
└── Router 配置及已有拦截器链 (避免破坏原有路由机制)
```

### 2.3 安全约束清单
- [x] **零信任原则**：不信任客户端传递的任何 tenantId 参数
- [x] **最小特权访问**：数据库连接池应支持租户感知或在 SQL 层强制过滤
- [x] **防御深度**：切面拦截 + Repository 级查询约束 (双层防护)

---

## 3. 开发切入层级序列

```mermaid
graph TD
    A[JwtUtil: 解析 JWT 中的 tenant_id claim] --> B[JwtAuthenticationFilter: 将 tenantId 注入 SecurityContextHolder]
    B --> C[TenantContextHolder: 提供 ThreadLocal 访问接口]
    C --> D[RequiresTenantCheck 注解定义]
    D --> E[TenantIsolationAspect 切面实现]
    E --> F[AssetController 方法应用注解]
    F --> G[AssetRepository 参数化查询强制租户过滤]
```

---

## 4. 实现规格详情

### 4.1 `JwtUtil` 增强：提取 tenant_id Claim

**修改点**: `backend/src/main/java/com/ams/utils/JwtUtil.java`

```java
/* 扩展解析方法 */
public String getTenantIdFromToken(String token) {
    Claims claims = this.getClaimsFromToken(token);
    return (String) claims.get("tenant_id"); // JWT Payload 中必须包含 tenant_id 声明
}
```

### 4.2 `JwtAuthenticationFilter` 增强：上下文注入

**修改点**: `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java`

```java
/* doFilterInternal 方法中 */
String token = extractToken(request);
if (token != null && jwtUtil.validateToken(token)) {
    String tenantId = jwtUtil.getTenantIdFromToken(token);
    // 关键：将租户ID注入安全上下文，供后续链路使用
    SecurityContextHolder.getContext().setAuthentication(new TenantAwareAuthenticationToken(tenantId, ...));
}
```

### 4.3 新建 `TenantContext` 上下文持有类

**文件**: `backend/src/main/java/com/ams/security/TenantContext.java`

```java
public class TenantContext {
    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();

    public static void setTenantId(String tenantId) { TENANT_ID.set(tenantId); }
    public static String getTenantId() { return TENANT_ID.get(); }
    public static void clear() { TENANT_ID.remove(); }
}
```

### 4.4 新建 `RequiresTenantCheck` 注解与切面

**注解**: `backend/src/main/java/com/ams/security/RequiresTenantCheck.java`
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresTenantCheck { }
```

**切面实现**: `backend/src/main/java/com/ams/security/TenantIsolationAspect.java`
```java
@Aspect
@Component
public class TenantIsolationAspect {
    @Around("@annotation(com.ams.security.RequiresTenantCheck)")
    public Object validateTenantAccess(ProceedingJoinPoint joinPoint) throws Throwable {
        String currentTenantId = TenantContext.getTenantId();
        if (currentTenantId == null) throw new AccessDeniedException("租户上下文缺失，请检查登录状态");

        Object result = joinPoint.proceed();
        // 如果返回结果是租户感知资源，校验归属权
        if (result instanceof TenantAware resource && !resource.getTenantId().equals(currentTenantId)) {
            throw new AccessDeniedException("跨租户访问被拦截：资源不属于当前租户");
        }
        return result;
    }
}
```

### 4.5 `AssetController` 应用隔离校验

**修改点**: `backend/src/main/java/com/ams/controller/AssetController.java`

```java
@RestController
@RequestMapping("/api/assets")
public class AssetController {
    private final AssetService assetService;

    // 所有查询接口强制加租户校验注解
    @GetMapping("/{id}")
    @RequiresTenantCheck  // 切面拦截点
    public ResponseEntity<AssetResponse> getAssetById(@PathVariable Long id) {
        String tenantId = TenantContext.getTenantId(); // 从上下文安全获取，非 RequestParam
        return ResponseEntity.ok(assetService.findByIdWithTenant(id, tenantId));
    }

    @GetMapping("/list")
    @RequiresTenantCheck
    public List<AssetResponse> listAssets() {
        String tenantId = TenantContext.getTenantId();
        return assetService.findAllByTenant(tenantId);
    }
}
```

### 4.6 `AssetRepository` 强制租户过滤查询 (防渗透核心)

**文件**: `backend/src/main/java/com/ams/repository/AssetRepository.java`

```java
public interface AssetRepository extends JpaRepository<Asset, Long> {
    // 必须使用参数化查询，严禁裸拼接 SQL
    @Query("SELECT a FROM Asset a WHERE a.id = :id AND a.tenantId = :tenantId")
    Optional<Asset> findByIdAndTenantId(@Param("id") Long id, @Param("tenantId") String tenantId);

    @Query("SELECT a FROM Asset a WHERE a.tenantId = :tenantId ORDER BY a.createdAt DESC")
    List<Asset> findAllByTenantId(@Param("tenantId") String tenantId, Pageable pageable);
}
```

---

## 5. 验收测试基准 (ATB)

### ATB-1: 合法租户数据访问验证
**物理测试**: Playwright / API Test
| 测试步骤 | 期待结果 | 验证手段 |
|-----------|----------|----------|
| 使用 Tenant A 的 JWT Token 请求 `/api/assets/{id}` (属于 Tenant A) | 返回 HTTP 200，包含正确资产数据 | `expect(response.status()).toBe(200)` |
| 查看数据库查询日志 | SQL 包含 `WHERE tenant_id = 'TENANT_A'` | 检查 Hibernate SQL Log |

### ATB-2: 跨租户越权访问拦截验证 (核心安全点)
**物理测试**: Playwright / API Test
| 测试步骤 | 期待结果 | 验证手段 |
|-----------|----------|----------|
| 使用 Tenant A 的 JWT Token 请求 `/api/assets/{id}` (**属于 Tenant B**) | 返回 HTTP 403 Forbidden，错误信息包含 "跨租户访问被拦截" | `expect(response.status()).toBe(403)` |
| 查看数据库查询结果 | 查询应返回空或在切面层直接中断 | SQL Log 应显示带 tenant_id 的过滤语句 |

### ATB-3: 无 Token / 伪造 Token 访问验证
**物理测试**: Playwright / API Test
| 测试步骤 | 期待结果 | 验证手段 |
|-----------|----------|----------|
| 不携带 Authorization Header 请求接口 | 返回 HTTP 401 Unauthorized | `expect(response.status()).toBe(401)` |
| 使用伪造的 tenant_id claim 的 Token | JWT 解析失败，返回 401 或切面拦截 | `expect(response.status()).toBe(401/403)` |

### ATB-4: SQL 注入渗透测试 (租户维度)
**物理测试**: pytest / sqlmap 模拟
| 测试步骤 | 期待结果 | 验证手段 |
|-----------|----------|----------|
| 在 tenant_id 上下文中构造 `' OR '1'='1` 等 Payload | 参数化查询将其视为普通字符串，无注入效果 | 数据库日志显示参数已转义 |

---

## 6. 安全红线检查清单 (Pre-deployment)

```checklist
[ ] 所有 AssetRepository 方法是否包含 tenantId 参数且使用 @Query 或命名查询？
[ ] JwtAuthenticationFilter 是否在 SecurityFilterChain 中正确配置，确保先于业务拦截器执行？
[ ] TenantContextHolder 在 Request 结束时是否调用了 clear() 防止 ThreadLocal 内存泄漏？
[ ] 所有 Controller 的租户敏感接口是否均标注了 @RequiresTenantCheck 注解？
[ ] JWT 生成逻辑中是否强制包含 tenant_id claim，且签名密钥存储在环境变量/Vault 中？
```

---

**规格版本**: `SPEC-2026-V1.3`  
**状态**: 待实施 (Implementation Pending)  
**安全等级**: P0 - Critical<channel|># ForthAMS 多租户隔离强阻断方案 Specification

## 需求与背景
系统必须实现物理级多租户数据隔离。攻击者可能通过伪造 Token、篡改请求参数或利用 SQL 注入尝试跨租户访问资产数据。本规格要求在 **认证过滤层**、**上下文传递层**、**切面拦截层** 和 **持久层查询** 四个维度构建闭环防御体系，确保 `tenant_id` 的获取路径唯一且不可篡改，数据库查询必须强制绑定租户标识。

---

## 边界约束

### 技术栈与范围
- **语言**: Java 17+ / Spring Boot 3.x
- **持久层**: Spring Data JPA (Hibernate)
- **安全框架**: Spring Security + JWT
- **修改范围**: `JwtAuthenticationFilter` → `TenantContextHolder` (新建) → `AssetController` → `AssetService` → `AssetRepository`

### 安全红线
1. **禁止** 从 HTTP Request 直接读取 `tenantId` 参数（防止参数篡改攻击）
2. **必须** 从解密后的 JWT Claims 中提取租户标识，并存储在 ThreadLocal 上下文中
3. **严禁** 使用字符串拼接构建 SQL 查询，必须使用 JPA 参数化查询或 Criteria API
4. **切面拦截** 必须覆盖所有 `AssetController` 的读写接口，无例外

---

## 开发切入层级序列

```mermaid
graph TD
    A[JwtAuthenticationFilter] --解析Token提取tenant_id--> B[TenantContextHolder]
    B --ThreadLocal存储--> C{请求上下文}
    C --注入到服务层--> D[AssetService]
    D --强制传参查询--> E[AssetRepository]
    E --参数化SQL执行--> F[(多租户数据库)]
    G[@RequiresTenantCheck 切面] --拦截校验--> C
```

---

## 详细实现规格

### 第一阶段：租户上下文持有者 (新建)
**文件**: `backend/src/main/java/com/ams/context/TenantContextHolder.java`

```java
package com.ams.context;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Optional;

/**
 * TenantContextHolder - 租户上下文持有者 (ThreadLocal)
 * 安全红线：禁止外部直接设置 tenantId，仅允许由认证过滤器写入
 */
public class TenantContextHolder {
    private static final Logger log = LoggerFactory.getLogger(TenantContextHolder.class);
    private static final ThreadLocal<String> CONTEXT = new ThreadLocal<>();

    // 仅供 JwtAuthenticationFilter 调用
    public static void setTenantId(String tenantId) {
        CONTEXT.set(tenantId);
    }

    public static String getTenantId() {
        return CONTEXT.get();
    }

    public static Optional<String> getTenantIdOptional() {
        return Optional.ofNullable(CONTEXT.get());
    }

    public static void clear() {
        CONTEXT.remove();
    }
}
```

---

### 第二阶段：认证过滤器增强 (修改)
**文件**: `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java`  
**变更点**: 在 Token 校验通过后，将租户 ID 注入上下文。

```java
// ... imports ...
import com.ams.context.TenantContextHolder;

public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = extractToken(request);

        if (token != null && jwtUtil.validateToken(token)) {
            // 1. 从 Token Claims 中提取 tenant_id，而非从 Request 参数读取
            String tenantId = jwtUtil.getTenantIdFromToken(token);
            
            if (tenantId == null || tenantId.isBlank()) {
                log.error("JWT token missing tenant_id claim");
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid token: missing tenant context");
                return;
            }

            // 2. 设置到 ThreadLocal 上下文，供后续层级使用
            TenantContextHolder.setTenantId(tenantId);
            log.debug("Tenant context set: {}", tenantId);

            // 3. 构建 Security Context (保持原有逻辑)
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    jwtUtil.getUsernameFromToken(token), null, Collections.emptyList());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        try {
            chain.doFilter(request, response);
        } finally {
            // 4. 【关键】请求结束必须清除上下文，防止 ThreadLocal 内存泄漏及租户串号
            TenantContextHolder.clear();
        }
    }
}
```

---

### 第三阶段：JWT 工具类扩展 (修改)
**文件**: `backend/src/main/java/com/ams/utils/JwtUtil.java`  
**变更点**: 增加租户 ID 的提取与注入方法。

```java
public class JwtUtil {
    // ... 现有常量定义 ...

    /**
     * 从 Token 中安全提取 tenant_id
     */
    public String getTenantIdFromToken(String token) {
        Claims claims = this.getClaimsFromToken(token);
        return (String) claims.get("tenant_id"); // 必须与 generateToken 中的 key 一致
    }

    /**
     * 生成 Token 时注入 tenant_id claim
     */
    public String createToken(String username, Long userId, String tenantId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("tenant_id", tenantId); // 租户标识必须写入 Payload
        claims.put("user_id", userId);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(username)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION))
                .signWith(this.getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    // ... 现有方法保持不变 ...
}
```

---

### 第四阶段：租户隔离切面 (新建)
**文件**: `backend/src/main/java/com/ams/aspect/TenantIsolationAspect.java`  
**功能**: 对所有 AssetController 方法进行前置校验，确保上下文存在 tenantId。

```java
package com.ams.aspect;

import com.ams.context.TenantContextHolder;
import org.aspectj.lang.annotation.*;
import org.springframework.stereotype.Component;
import javax.servlet.http.HttpServletResponse;
import java.util.Optional;

/**
 * TenantIsolationAspect - 租户隔离切面
 * 安全红线：任何进入 AssetController 的请求必须持有有效的 tenantId 上下文
 */
@Aspect
@Component
public class TenantIsolationAspect {

    @Before("execution(* com.ams.controller.AssetController.*(..))")
    public void validateTenantContext() throws Exception {
        Optional<String> tenantId = TenantContextHolder.getTenantIdOptional();
        if (tenantId.isEmpty()) {
            throw new SecurityException("Multi-tenancy violation: No tenant context found in security context.");
        }
    }

    @AfterReturning(pointcut = "execution(* com.ams.controller.AssetController.*(..))", returning = "result")
    public void logTenantAccess(Object result) {
        String tenantId = TenantContextHolder.getTenantId();
        // 审计日志：记录哪个租户访问了资源 (生产环境应输出到 audit_log 表)
        System.out.println("[TENANT-AUDIT] Access by tenant: " + tenantId);
    }
}
```

---

### 第五阶段：AssetController 与 Service 层隔离查询实现

#### 5.1 AssetRepository (强制参数化查询)
**文件**: `backend/src/main/java/com/ams/repository/AssetRepository.java`

```java
package com.ams.repository;

import com.ams.model.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface AssetRepository extends JpaRepository<Asset, Long> {

    /**
     * 【安全红线】所有查询必须强制携带 tenant_id 参数
     * 严禁执行 SELECT * FROM assets (全表扫描)
     */
    @Query("SELECT a FROM Asset a WHERE a.tenantId = :tenantId")
    List<Asset> findAllByTenant(@Param("tenantId") String tenantId);

    @Query("SELECT a FROM Asset a WHERE a.id = :id AND a.tenantId = :tenantId")
    Optional<Asset> findByIdAndTenant(@Param("id") Long id, @Param("tenantId") String tenantId);

    @Query("SELECT COUNT(a) FROM Asset a WHERE a.tenantId = :tenantId")
    long countByTenant(@Param("tenantId") String tenantId);
}
```

#### 5.2 AssetService (从上下文取用租户 ID)
**文件**: `backend/src/main/java/com/ams/service/AssetService.java`

```java
package com.ams.service;

import com.ams.context.TenantContextHolder;
import com.ams.model.Asset;
import com.ams.repository.AssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AssetService {
    private final AssetRepository assetRepository;

    /**
     * 获取当前租户的所有资产 - 强制从上下文读取 tenantId
     */
    public List<Asset> getAllAssets() {
        String tenantId = TenantContextHolder.getTenantId(); // 由切面保证非空
        return assetRepository.findAllByTenant(tenantId);
    }

    /**
     * 根据ID获取单个资产 - 必须校验租户归属权
     */
    public Asset getAssetById(Long id) {
        String tenantId = TenantContextHolder.getTenantId();
        return assetRepository.findByIdAndTenant(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Asset not found or access denied for tenant: " + tenantId));
    }

    /**
     * 创建资产 - 强制绑定当前租户
     */
    public Asset createAsset(Asset asset) {
        String tenantId = TenantContextHolder.getTenantId();
        asset.setTenantId(tenantId); // 强制覆盖，防止前端伪造 tenant_id
        return assetRepository.save(asset);
    }

    /**
     * 删除资产 - 必须校验租户归属权
     */
    public void deleteAsset(Long id) {
        String tenantId = TenantContextHolder.getTenantId();
        Asset asset = getAssetById(id); // 内部已完成租户校验
        assetRepository.delete(asset);
    }

    /**
     * 更新资产 - 必须校验租户归属权并强制设置租户字段
     */
    public Asset updateAsset(Long id, Asset updatedAsset) {
        String tenantId = TenantContextHolder.getTenantId();
        Asset existing = getAssetById(id); // 内部已完成租户校验
        
        // 更新业务字段，强制保留原租户ID
        existing.setName(updatedAsset.getName());
        existing.setType(updatedAsset.getType());
        existing.setCategory(updatedAsset.getCategory());
        existing.setStatus(updatedAsset.getStatus());
        existing.setTenantId(tenantId); // 再次强制设置，防止越权修改租户归属
        
        return assetRepository.save(existing);
    }
}
```

#### 5.3 AssetController (保持简洁，逻辑下沉到 Service)
**文件**: `backend/src/main/java/com/ams/controller/AssetController.java`

```java
package com.ams.controller;

import com.ams.model.Asset;
import com.ams.service.AssetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetController {
    private final AssetService assetService;

    /**
     * 获取所有资产 - 租户隔离由 Service + 切面保证
     */
    @GetMapping
    public ResponseEntity<List<Asset>> getAll() {
        return ResponseEntity.ok(assetService.getAllAssets());
    }

    /**
     * 根据ID获取单个资产
     */
    @GetMapping("/{id}")
    public ResponseEntity<Asset> getById(@PathVariable Long id) {
        return ResponseEntity.ok(assetService.getAssetById(id));
    }

    /**
     * 创建新资产 - tenantId 强制从 JWT 上下文注入，前端不可伪造
     */
    @PostMapping
    public ResponseEntity<Asset> create(@RequestBody Asset asset) {
        return ResponseEntity.ok(assetService.createAsset(asset));
    }

    /**
     * 更新资产
     */
    @PutMapping("/{id}")
    public ResponseEntity<Asset> update(@PathVariable Long id, @RequestBody Asset asset) {
        return ResponseEntity.ok(assetService.updateAsset(id, asset));
    }

    /**
     * 删除资产
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        assetService.deleteAsset(id);
        return ResponseEntity.noContent().build();
    }
}
```

---

## 验收测试基准 (ATB)

### ATB-01: 租户隔离功能验证 (正常路径)
| 测试步骤 | 操作描述 | 预期结果 | 物理测试方式 |
|----------|----------|-----------|---------------|
| 1. 获取 Token A | 使用 Tenant_A 的凭据登录，获取 JWT | 返回包含 `tenantId=T001` 的 Token | Playwright: 模拟登录并截获 Response Header |
| 2. 查询资产 A | 使用 Token A 调用 `/api/assets` | 仅返回属于 T001 的资产列表 | Playwright: API 请求校验 JSON 内容 |
| 3. 获取 Token B | 使用 Tenant_B 的凭据登录，获取 JWT | 返回包含 `tenantId=T002` 的 Token | 同上 |
| 4. 查询资产 B | 使用 Token B 调用 `/api/assets` | 仅返回属于 T002 的资产列表，不可见 T001 数据 | Playwright: 对比两次请求结果集不相交 |

### ATB-02: 跨租户越权访问拦截 (安全红线)
| 测试步骤 | 操作描述 | 预期结果 | 物理测试方式 |
|----------|----------|-----------|---------------|
| 1. 获取 Token A | 使用 Tenant_A 的凭据登录，获取 JWT (`tenantId=T001`) | 返回有效 Token | Playwright: 模拟登录 |
| 2. 获取租户 B 的资产 ID | 通过合法手段或已知方式获取属于 T002 的资产 ID (如 `id=999`) | - | - |
| 3. 越权查询单条记录 | 使用 Token A 调用 `/api/assets/999` | 返回 **404 Not Found** 或自定义错误，不泄露数据 | Playwright: 校验 Response Status 为 404 |
| 4. 越权更新资产 | 使用 Token A 发送 PUT 请求到 `/api/assets/999` 修改 T002 的资产 | 返回 **404 Not Found** 或 **403 Forbidden**，数据未变更 | Playwright: 校验 Status 及数据库状态不变 |
| 5. 越权删除资产 | 使用 Token A 发送 DELETE 请求到 `/api/assets/999` | 返回 **404 Not Found**，资产未被删除 | Playwright: 校验 Response + 随后用 Token B 查询确认存在 |

### ATB-03: 无租户上下文拦截验证 (切面生效)
| 测试步骤 | 操作描述 | 预期结果 | 物理测试方式 |
|----------|----------|-----------|-----------|
| 1. 构造无效请求 | 不携带 Authorization Header 或携带伪造 Token 调用 `/api/assets` | 返回 **401 Unauthorized** (Filter拦截) 或 **500** (切面抛出 SecurityException，最终由全局处理器转为 403/500) | Playwright: 直接调用 API 校验 Status Code |
| 2. 绕过 Filter 但无 TenantId | 使用已过期但未被完全拦截的 Token 调用接口 | 切面 `TenantId` 强制校验触发，抛出异常 | 查看后端日志输出 SecurityException 堆栈 |

### ATB-04: SQL 注入防御验证 (安全编码)
| 测试步骤 | 操作描述 | 预期结果 | 物理测试方式 |
|----------|----------|-----------|---------------|
| 1. 输入恶意 Payload | 在资产名称等字段输入 `' OR '1'='1` 等 SQL 注入字符并提交创建请求 | 数据被正确参数化，数据库中存储原字符串，无注入发生 | Playwright: 提交后查询该记录确认内容完整且未导致越权 |

### ATB-05: 租户 ID 篡改防御 (强制覆盖)
| 测试步骤 | 操作描述 | 预期结果 | 物理测试方式 |
| 测试场景 | 用户 A 尝试在 PUT 请求 Body 中将 `tenantId` 修改为 B 的值 | Service 层强制使用 JWT 中的 tenantId 覆盖，请求被安全处理或拒绝 | Playwright: 发送篡改 payload -> 查询数据库确认租户未变更 |

---

## 开发切入层级序列 (Implementation Sequence)

```
┌─────────────────────────────────────────────────────────┐
│  Phase 1: Security Context Infrastructure                  │
├─────────────────────────────────────────────────────────┤
│  1. JwtUtil.java → 确保解析 Token 能提取 tenantId Claims   │
│  2. JwtAuthenticationFilter.java → 将 tenantId 注入上下文 │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 2: Data Access Layer Hardening                    │
├─────────────────────────────────────────────────────────┤
│  1. AssetRepository (或直接在 Service) → 所有查询必须带 tenantId 参数 │
│  2. 禁止任何不含 WHERE tenant_id = ? 的裸 SQL 查询        │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 3: Business Logic Isolation                       │
├─────────────────────────────────────────────────────────┤
│  1. AssetService → 从 SecurityContext 获取 tenantId，强制注入所有操作 │
│  2. updateAsset() 方法中显式覆盖 incoming DTO 的 tenantId │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 4: API Layer & Aspect Enforcement                  │
├─────────────────────────────────────────────────────────┤
│  1. AssetController → 定义 REST 接口，移除任何 client-supplied tenantId 参数 │
│  2. TenantValidationAspect (可选) → AOP 切面强制校验方法入参是否包含有效租户上下文 │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 5: Verification & ATB Testing                     │
├─────────────────────────────────────────────────────────┤
│  1. 执行 ATB-01 至 ATB-05 全量测试用例                    │
│  2. 查看 SQL 日志确认所有查询均包含 tenant_id 谓词        │
└─────────────────────────────────────────────────────────┘
```

---

## 关键代码约束清单 (Checklist)

- [ ] `AssetRepository` 中禁止出现不带 `tenantId` 的 `findAll()` 或 `findById()`
- [ ] `AssetService.updateAsset` 必须显式设置 `existing.setTenantId(currentTenantId)`，防止 DTO 篡改
- [ ] 所有数据库操作使用 Spring Data JPA 参数化查询或 MyBatis XML 参数绑定，严禁字符串拼接 SQL
- [ ] `JwtAuthenticationFilter` 必须在请求链路最前端完成租户上下文注入
- [ ] 切面/拦截器抛出的 `SecurityException` 必须由全局异常处理器转换为标准 HTTP 状态码 (403 或 500)
- [ ] 日志中禁止打印完整的 JWT Token 内容，仅记录操作租户 ID

---

spec.md 完成。<channel|>[SPEC] ForthAMS 多租户隔离安全增强规格文档 v1.0

## 需求与背景

**核心目标**：在 `AssetController` 及相关服务层实现强租户隔离机制，确保任何请求必须携带合法 `tenant_id` 凭证，且数据访问被物理限制在当前租户作用域内。

**安全红线要求**：
1. **禁止裸拼接 SQL** — 所有数据库查询必须通过参数化方式强制注入 `tenant_id` 谓词。
2. **禁止客户端传递 tenant_id** — 租户标识必须从服务端解析的 JWT Context 中提取，前端传入的任何租户字段在写入前被强制覆盖或丢弃。
3. **全链路拦截** — 从 Filter 层 (Token 解析) → Service 层 (上下文注入) → Repository 层 (查询谓词)，构建闭环隔离链条。

---

## 边界约束

| 维度 | 约束条件 | 违规后果 |
|------|----------|-----------|
| **数据访问** | 所有 SQL 查询必须包含 `WHERE tenant_id = ?` | 直接拒绝编译/部署，视为严重漏洞 |
| **租户标识来源** | 仅允许从解析后的 JWT Claims 中提取，禁止接收 Request Body 中的 tenantId | Service 层强制覆盖 DTO 中的 tenantId 字段 |
| **跨租户操作** | 任何试图访问非本租户 ID 的记录必须返回 404 或 403 | 禁止泄露资源存在性信息 (不区分 403/404) |
| **SQL 构建方式** | 仅允许使用 Spring Data JPA 方法名解析、@Query 参数化或 MyBatis XML 绑定 | 发现字符串拼接 SQL 直接拦截构建流水线 |
| **异常处理** | 隔离校验失败抛出自定义 `TenantIsolationException`，由全局处理器转换为标准 HTTP Code | 禁止在响应体中暴露租户 ID 或数据库结构信息 |

---

## 验收测试基准 (ATB)

### ATB-01: 正向租户数据访问验证
**物理测试方法**: Playwright / API Test
```javascript
// 模拟租户 A 的合法请求
const response = await api.get('/api/assets', {
  headers: { 'Authorization': `Bearer ${TOKEN_TENANT_A}` }
});

expect(response.status()).toBe(200);
// 验证返回数据中所有记录的 tenantId 均等于 A 的 ID
const data = await response.json();
data.forEach(asset => expect(asset.tenantId).toBe('TENANT_A'));
```
**期待结果**: 返回状态码 200，且数据集被物理过滤为仅包含租户 A 的资源。

---

### ATB-02: 跨租户越权访问阻断 (ID 遍历攻击)
**物理测试方法**: Playwright / API Test
```javascript
// 使用租户 A 的 Token 尝试直接请求租户 B 的资产 ID
const ASSET_ID_BELONGS_TO_TENANT_B = 'asset-999';

const response = await api.get(`/api/assets/${ASSET_ID_BELONGS_TO_TENANT_B}`, {
  headers: { 'Authorization': `Bearer ${TOKEN_TENANT_A}` }
});

expect(response.status()).toBe(404); // 必须返回 404，不区分资源是否存在于其他租户
```
**期待结果**: 返回状态码 **404 Not Found** (禁止返回 403 以防止 ID 枚举探测)。后端日志应记录越权尝试。

---

### ATB-03: Body 中伪造 tenantId 的覆盖验证
**物理测试方法**: Playwright / API Test
```javascript
// 使用租户 A 的 Token，但在 Payload 中伪造为租户 B
await api.post('/api/assets', {
  name: 'Rogue Asset',
  tenantId: 'TENANT_B' // 恶意篡改
}, { headers: { 'Authorization': `Bearer ${TOKEN_TENANT_A}` }});

// 查询该资产，验证其所属租户是否被强制修正为 A
const asset = await api.get('/api/assets/latest', {
  headers: { 'Authorization': `Bearer ${TOKEN_TENANT_A}` }
});
expect(asset.tenantId).toBe('TENANT_A'); // 必须是 A，不是伪造的 B
```
**期待结果**: Service 层强制用 JWT 中的租户 ID 覆盖 DTO 值。数据库中该资产记录所属租户为 `TENANT_A`。

---

### ATB-04: 无效/过期 Token 的隔离拦截验证
**物理测试方法**: Playwright / API Test
```javascript
// 使用伪造或过期的 Token
const response = await api.get('/api/assets', {
  headers: { 'Authorization': `Bearer EXPIRED_OR_FAKE_TOKEN` }
});

expect(response.status()).toBe(401); // 或 403，取决于 Filter 配置
```
**期待结果**: 请求在进入业务层前被拦截。隔离切面不应执行任何数据库操作。

---

### ATB-05: SQL 日志审计验证 (后端物理检查)
**物理测试方法**: 查看 Spring Boot SQL Log / 开启 `show-sql`
```properties
spring.jpa.show-sql=true
logging.level.org.hibernate.SQL=DEBUG
```
执行任意租户 A 的查询请求。

**期待结果**: 控制台输出的 SQL 必须包含：
```sql
SELECT ... FROM assets WHERE id = ? AND tenant_id = 'TENANT_A';
-- 或 --
SELECT ... FROM assets WHERE tenant_id = 'TENANT_A' LIMIT ?;
```
严禁出现不带 `tenant_id` 的裸查询。

---

## 开发切入层级序列

```mermaid
graph TD
    Start((开始实现)) --> P1[Phase 1: JWT 上下文增强]
    P1 --> |JwtUtil 解析 tenantId| P2[Phase 2: Repository 层谓词注入]
    P2 --> |强制 WHERE tenant_id = ?| P3[Phase 3: Service 层租户上下文绑定]
    P3 --> |从 SecurityContext 获取并覆盖 DTO| P4[Phase 4: Controller 定义与切面拦截]
    P4 --> |定义接口, AOP 校验入参合法性| P5[Phase 5: ATB 全量验证]
    P5 --> End((交付上线))

    subgraph "关键文件变更点"
        F1["JwtUtil.java (解析 tenantId)"]
        F2["AssetRepository.java (方法签名强制带 tenantId)"]
        F3["AssetService.java (上下文注入逻辑)"]
        F4["AssetController.java (接口定义, 移除外部传入 tenantId 参数)"]
    end

    P1 -.-> F1
    P2 -.-> F2
    P3 -.-> F3
    P4 -.-> F4
```

---

## 代码实现规格要求

### Repository 层方法签名规范
所有查询必须显式包含 `tenantId` 参数，禁止依赖全局默认行为。
```java
// ❌ 不允许：仅凭 ID 查询（可能导致跨租户越权）
Optional<Asset> findById(Long id);

// ✅ 必须：强制要求 tenantId 作为谓词的一部分
Optional<Asset> findByIdAndTenantId(Long id, String tenantId);
List<Asset> findAllByTenantId(String tenantId, Pageable pageable);
```

### Service 层上下文取值规范
禁止从 Request Body 或 Query Param 中直接信任 `tenantId`。必须通过安全上下文获取。
```java
public class AssetService {
    // 唯一可信来源：SecurityContextHolder (由 JwtAuthenticationFilter 填充)
    private String getCurrentTenantId() {
        return SecurityContextHolder.getContext().getAuthentication(); // 获取租户 ID
    }

    @Transactional
    public void createAsset(AssetRequest request) {
        String tenantId = this.getCurrentTenantId();  // 从上下文取，不从 request 取
        request.setTenantId(tenantId);               // 强制覆盖 body 中的伪造值
        assetRepository.save(new AssetEntity(request));
    }

    public AssetResponse getAssetById(Long id) {
        String tenantId = this.getCurrentTenantId();
        return assetRepository.findByIdAndTenantId(id, tenantId)  // 强制带租户谓词
            .map(this::convertToResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Asset not found")); // 统一抛出，不区分越权还是不存在
    }
}
```

### Controller 层接口定义规范
移除所有接收 `tenantId` 作为输入参数的 API 设计。租户身份由 Token 承载。
```java
@RestController
@RequestMapping("/api/assets")
public class AssetController {

    // ✅ 正确：无需 tenantId 参数，由 Service 从上下文提取
    @GetMapping("/{id}")
    public ResponseEntity<AssetResponse> getAsset(@PathVariable Long id) {
        return ResponseEntity.ok(assetService.getAssetById(id));
    }

    // ❌ 禁止：允许前端传入 tenantId
    // @GetMapping("/{id}")
    // public ResponseEntity<?> getAsset(@PathVariable Long id, @RequestParam String tenantId) { ... }
}
```