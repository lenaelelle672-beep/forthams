# SWARM-001 Phase 1 安全上下文基础设施规格文档

## 需求与背景

### 业务背景

AMS（资产管理系统）需要支持多租户架构，确保每个租户的数据严格隔离。当前系统存在以下问题：

- 租户隔离依赖业务层手动传递，容易遗漏
- Filter 层无法获取可靠租户标识
- 存在通过请求参数覆盖租户 ID 的潜在安全漏洞

### 技术债务

- `JwtUtil` 现有 claims 解析仅支持 `username` 和 `userId`，缺少 `tenant_id` 解析
- 无 `TenantContextHolder` 进行线程级租户上下文存储
- `JwtAuthenticationFilter` 未注入租户上下文

---

## 当前 Phase 对应实施目标

| 字段 | 值 |
|------|-----|
| 任务编号 | SWARM-001 |
| Phase 编号 | Phase 1 |
| Phase 名称 | 安全上下文基础设施 |
| 对接 plan.md 位置 | `[Phase-1] 多租户安全上下文基础设施` |

### 本次交付物

| 序号 | 交付物 | 文件路径 | 说明 |
|------|--------|----------|------|
| 1 | JwtUtil 扩展 | `backend/src/main/java/com/ams/utils/JwtUtil.java` | 新增 `getTenantIdFromToken()` 方法 |
| 2 | TenantContextHolder | `backend/src/main/java/com/ams/security/context/TenantContextHolder.java` | 新建 ThreadLocal 容器类 |
| 3 | JwtAuthenticationFilter 改造 | `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java` | 集成租户上下文注入 |
| 4 | 单元测试 | `backend/src/test/java/com/ams/` | 覆盖上述组件的测试用例 |

---

## 边界约束

### 作用域约束

```
✅ 包含
├── JwtUtil.java 新增 claims 解析方法
├── TenantContextHolder.java 新建类
├── JwtAuthenticationFilter.java 集成租户上下文
└── 相关单元测试

❌ 不包含
├── Service 层租户数据过滤逻辑
├── 数据库层租户字段自动填充
├── 租户配置管理接口
└── 跨线程异步任务的上下文传递（Future/ExecutorService）
```

### 安全约束

| 约束项 | 描述 |
|--------|------|
| 防注入 | 租户 ID 仅从 JWT 解析，禁止从 `HttpServletRequest.getParameter()` 或 `Header` 获取 |
| 防覆盖 | `TenantContextHolder.set()` 权限为 `private`，仅 Filter 内部调用链可调用 |
| 防泄漏 | 请求处理完成后必须调用 `TenantContextHolder.clear()`，在 `finally` 块执行 |

### 技术约束

| 约束项 | 值 |
|--------|-----|
| Java 版本 | Java 17+ |
| Spring Boot 版本 | Spring Boot 3.x |
| JWT 库 | `io.jsonwebtoken` (jjwt) |
| ThreadLocal 泛型 | `String` (tenantId) |

---

## 验收测试基准 (ATB)

### ATB-1: JwtUtil getTenantIdFromToken() 单元测试

**测试文件**: `backend/src/test/java/com/ams/utils/JwtUtilTest.java`

| 序号 | 测试场景 | 输入 | 预期结果 |
|------|----------|------|----------|
| T-01 | 有效 token 包含 tenant_id | 签发包含 `{"tenant_id": "tenant-001"}` 的 JWT | 返回 `"tenant-001"` |
| T-02 | 有效 token 不包含 tenant_id | 签发不包含 tenant_id 字段的 JWT | 抛出 `ClaimNotFoundException` |
| T-03 | 过期 token | 过期 JWT | 抛出 `ExpiredJwtException` |
| T-04 | 篡改 token (signature invalid) | 伪造 payload 的 JWT | 抛出 `SignatureException` |

```java
// 物理测试期待 (JUnit 5 + Mockito)
package com.ams.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
    }

    @Test
    void getTenantIdFromToken_validToken_returnsTenantId() {
        // 签发包含 tenant_id 的 token
        String token = jwtUtil.createToken("user-123", "alice", "tenant-001");
        String tenantId = jwtUtil.getTenantIdFromToken(token);
        assertEquals("tenant-001", tenantId);
    }

    @Test
    void getTenantIdFromToken_tokenWithoutTenantId_throwsClaimNotFoundException() {
        // 签发不包含 tenant_id 的 token
        String token = jwtUtil.generateToken("user-123", "alice");
        assertThrows(ClaimNotFoundException.class, () -> {
            jwtUtil.getTenantIdFromToken(token);
        });
    }

    @Test
    void getTenantIdFromToken_expiredToken_throwsExpiredJwtException() {
        // 创建已过期的 token（expiration 设置为过去时间）
        String token = createExpiredToken();
        assertThrows(ExpiredJwtException.class, () -> {
            jwtUtil.getTenantIdFromToken(token);
        });
    }
}
```

### ATB-2: TenantContextHolder 生命周期测试

**测试文件**: `backend/src/test/java/com/ams/security/context/TenantContextHolderTest.java`

| 序号 | 测试场景 | 操作 | 预期结果 |
|------|----------|------|----------|
| T-05 | 正常设置获取 | `set("tenant-001")` → `get()` | 返回 `"tenant-001"` |
| T-06 | 清除后获取 | `set()` → `clear()` → `get()` | 返回 `null` |
| T-07 | 线程隔离 | 线程A set → 线程B get | 线程B 返回 `null` |

```java
// 物理测试期待
package com.ams.security.context;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TenantContextHolderTest {

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void get_afterSet_returnsTenantId() {
        TenantContextHolder.set("tenant-001");
        assertEquals("tenant-001", TenantContextHolder.get());
    }

    @Test
    void get_afterClear_returnsNull() {
        TenantContextHolder.set("tenant-001");
        TenantContextHolder.clear();
        assertNull(TenantContextHolder.get());
    }

    @Test
    void get_inDifferentThread_returnsNull() throws InterruptedException {
        TenantContextHolder.set("tenant-001");
        Thread t = new Thread(() -> assertNull(TenantContextHolder.get()));
        t.start();
        t.join();
    }
}
```

### ATB-3: JwtAuthenticationFilter 集成测试

**测试文件**: `backend/src/test/java/com/ams/config/JwtAuthenticationFilterIntegrationTest.java`

| 序号 | 测试场景 | 输入 | 预期结果 |
|------|----------|------|----------|
| T-08 | 有效 JWT 请求 | Header: `Authorization: Bearer <valid-jwt-with-tenant>` | 过滤器放行，`TenantContextHolder.get() == "tenant-001"` |
| T-09 | 无 JWT 请求 | 无 Authorization Header | 过滤器拒绝（401），不设置 Context |
| T-10 | 非法 JWT 请求 | 伪造 JWT | 过滤器拒绝（401），不设置 Context |

```java
// 物理测试期待
package com.ams.config;

import com.ams.utils.JwtUtil;
import com.ams.security.context.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockFilterChain;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class JwtAuthenticationFilterIntegrationTest {

    private JwtUtil jwtUtil;
    private JwtAuthenticationFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        filter = new JwtAuthenticationFilter(jwtUtil);
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        filterChain = new MockFilterChain();
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void doFilterInternal_validToken_setsTenantContext() throws Exception {
        // 准备：签发包含 tenant_id 的有效 token
        String token = jwtUtil.createToken("user-123", "alice", "tenant-001");
        request.addHeader("Authorization", "Bearer " + token);

        // 执行
        filter.doFilterInternal(request, response, filterChain);

        // 验证：ThreadLocal 中包含正确的 tenant_id
        assertEquals("tenant-001", TenantContextHolder.get());
        assertEquals(HttpServletResponse.SC_OK, response.getStatus());
    }

    @Test
    void doFilterInternal_noToken_returns401() throws Exception {
        // 执行：无 Authorization Header
        filter.doFilterInternal(request, response, filterChain);

        // 验证：返回 401 且不设置 Context
        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, response.getStatus());
        assertNull(TenantContextHolder.get());
    }

    @Test
    void doFilterInternal_invalidToken_returns401() throws Exception {
        // 准备：伪造的无效 token
        request.addHeader("Authorization", "Bearer invalid.token.here");

        // 执行
        filter.doFilterInternal(request, response, filterChain);

        // 验证：返回 401 且不设置 Context
        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, response.getStatus());
        assertNull(TenantContextHolder.get());
    }
}
```

### ATB-4: 防篡改验证

| 序号 | 验证项 | 手段 | 验证通过条件 |
|------|--------|------|-------------|
| T-11 | `set()` 方法不可从外部调用 | 编译期 `private` 修饰符验证 | `TenantContextHolder.set()` 在 `com.ams.config` 包外不可访问 |
| T-12 | 不接受请求参数注入 | 代码审查 + 全局搜索 | 无 `request.getParameter("tenant")` 或 `request.getHeader("X-Tenant-ID")` |
| T-13 | `clear()` 在 finally 中执行 | 代码审查 | `finally { TenantContextHolder.clear(); }` 存在于 `doFilterInternal()` |

---

## 开发切入层级序列

### 层级 0: 基础设施 - JwtUtil 扩展

**文件**: `backend/src/main/java/com/ams/utils/JwtUtil.java`

#### 扩展方法签名

```java
/**
 * 从 JWT token 中获取租户 ID
 * @param token JWT token 字符串
 * @return tenant_id claim 的值
 * @throws ClaimNotFoundException 如果 token 中不包含 tenant_id
 * @throws ExpiredJwtException 如果 token 已过期
 * @throws SignatureException 如果 token 签名验证失败
 */
public String getTenantIdFromToken(String token) {
    Claims claims = getClaimsFromToken(token);
    String tenantId = claims.get("tenant_id", String.class);
    if (tenantId == null) {
        throw new ClaimNotFoundException("tenant_id claim not found in JWT");
    }
    return tenantId;
}
```

#### 现有 createToken 扩展

当前 `createToken(userId, username)` 方法需要扩展为支持 `tenantId` 参数：

```java
/**
 * 创建带有租户信息的 JWT token
 * @param userId 用户 ID
 * @param username 用户名
 * @param tenantId 租户 ID
 * @return JWT token 字符串
 */
public String createToken(String userId, String username, String tenantId) {
    Date now = new Date();
    Date expiryDate = new Date(now.getTime() + JWT_EXPIRATION);

    return Jwts.builder()
            .setSubject(username)
            .claim("userId", userId)
            .claim("tenant_id", tenantId)  // 新增 tenant_id claim
            .setIssuedAt(now)
            .setExpiration(expiryDate)
            .signWith(getSigningKey(), SignatureAlgorithm.HS512)
            .compact();
}
```

#### 修改点清单

| 行号 | 操作 | 说明 |
|------|------|------|
| L15 | 新增 `CLAIM_TENANT_ID = "tenant_id"` 常量 | Claim 键名常量定义 |
| L61 | 扩展 `getClaimsFromToken()` | 保持不变，作为基础方法 |
| L61+ | 新增 `getTenantIdFromToken()` | 调用 `claims.get("tenant_id")` |
| L30-40 | 扩展 `createToken()` 方法重载 | 支持 `tenantId` 参数 |

---

### 层级 1: 核心组件 - TenantContextHolder

**新建文件**: `backend/src/main/java/com/ams/security/context/TenantContextHolder.java`

```java
package com.ams.security.context;

/**
 * 租户上下文持有者，基于 ThreadLocal 实现线程级租户 ID 存储
 * 
 * <p>安全设计：
 * <ul>
 *   <li>set() 方法为 package-private，仅允许 Filter 层调用</li>
 *   <li>get()/clear() 方法为 public，允许业务层读取和清理</li>
 * </ul>
 * 
 * <p>使用示例：
 * <pre>
 * // Filter 层设置
 * TenantContextHolder.set(tenantId);
 * try {
 *     // 业务逻辑
 *     String currentTenant = TenantContextHolder.get();
 * } finally {
 *     TenantContextHolder.clear();
 * }
 * </pre>
 */
public final class TenantContextHolder {

    private static final ThreadLocal<String> CONTEXT = new ThreadLocal<>();

    /**
     * 设置当前线程的租户 ID
     * 
     * <p>权限：package-private
     * 仅允许 {@link com.ams.config.JwtAuthenticationFilter} 及同包组件调用
     * 
     * @param tenantId 租户 ID，不能为空
     */
    static void set(String tenantId) {
        CONTEXT.set(tenantId);
    }

    /**
     * 获取当前线程的租户 ID
     * 
     * @return 当前线程绑定的租户 ID，若未设置则返回 null
     */
    public static String get() {
        return CONTEXT.get();
    }

    /**
     * 清除当前线程的租户上下文
     * 
     * <p>应在请求处理完成后（finally 块）调用，防止内存泄漏
     */
    public static void clear() {
        CONTEXT.remove();
    }

    // 私有构造函数，防止实例化
    private TenantContextHolder() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }
}
```

#### 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| `set()` 权限 | package-private | 允许 Filter 调用，阻止业务层直接注入 |
| 泛型类型 | `String` | 简化实现，tenant_id 本身为字符串 |
| 线程安全 | ThreadLocal | Java 标准线程隔离机制 |
| 工具类设计 | private 构造函数 | 强制静态使用 |

---

### 层级 2: 集成层 - JwtAuthenticationFilter 改造

**文件**: `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java`

#### 核心修改

```java
package com.ams.config;

import com.ams.utils.JwtUtil;
import com.ams.security.context.TenantContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

/**
 * JWT 认证过滤器
 * 
 * <p>功能：
 * <ul>
 *   <li>从 Authorization Header 解析 JWT token</li>
 *   <li>验证 token 有效性</li>
 *   <li>设置 Spring Security 认证上下文</li>
 *   <li>设置 TenantContextHolder 租户上下文</li>
 * </ul>
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtAuthenticationFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String token = extractTokenFromRequest(request);

            if (StringUtils.hasText(token) && jwtUtil.validateToken(token)) {
                // 解析 JWT claims
                String username = jwtUtil.getUsernameFromToken(token);
                String userId = jwtUtil.getUserIdFromToken(token);
                String tenantId = jwtUtil.getTenantIdFromToken(token);  // 新增

                // 设置 Spring Security 认证上下文
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(username, userId, Collections.emptyList());
                SecurityContextHolder.getContext().setAuthentication(authentication);

                // 设置租户上下文（仅允许内部设置，禁止外部参数篡改）
                TenantContextHolder.set(tenantId);  // 新增
            }

            filterChain.doFilter(request, response);
        } catch (Exception e) {
            logger.error("Cannot set user authentication: " + e.getMessage(), e);
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid token");
        } finally {
            // 确保请求处理完成后清除上下文，防止内存泄漏
            TenantContextHolder.clear();  // 新增
        }
    }

    private String extractTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
```

#### 修改点清单

| 行号 | 修改内容 | 说明 |
|------|----------|------|
| L12 | 新增 `import com.ams.security.context.TenantContextHolder` | 导入租户上下文持有者 |
| L35 | `jwtUtil.getTenantIdFromToken(token)` | 从 JWT 解析 tenant_id |
| L44 | `TenantContextHolder.set(tenantId)` | 设置租户上下文 |
| L52 | `finally { TenantContextHolder.clear(); }` | 请求结束时清理上下文 |

#### 防篡改验证

```java
// ❌ 禁止：禁止从请求参数获取 tenant_id
String tenantId = request.getParameter("tenant_id");  // 不允许

// ❌ 禁止：禁止从请求头获取 tenant_id  
String tenantId = request.getHeader("X-Tenant-ID");   // 不允许

// ✅ 正确：仅从 JWT claims 解析
String tenantId = jwtUtil.getTenantIdFromToken(token);
```

---

### 层级 3: 测试验证

#### 测试文件结构

```
backend/src/test/java/com/ams/
├── utils/
│   └── JwtUtilTest.java
│       ├── testGetTenantIdFromToken_ValidToken()
│       ├── testGetTenantIdFromToken_TokenWithoutTenantId()
│       └── testGetTenantIdFromToken_ExpiredToken()
├── security/
│   └── context/
│       └── TenantContextHolderTest.java
│           ├── testGet_AfterSet()
│           ├── testGet_AfterClear()
│           └── testGet_InDifferentThread()
└── config/
    └── JwtAuthenticationFilterIntegrationTest.java
        ├── testValidToken_SetsTenantContext()
        ├── testNoToken_Returns401()
        └── testInvalidToken_Returns401()
```

#### 执行命令

```bash
cd backend

# 运行所有相关测试
mvn test -Dtest=JwtUtilTest,TenantContextHolderTest,JwtAuthenticationFilterIntegrationTest

# 运行单个测试类
mvn test -Dtest=JwtUtilTest

# 生成测试覆盖率报告
mvn test jacoco:report
```

#### 预期测试输出

```
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0

Results :
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0

BUILD SUCCESS
```

---

## 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                      JwtAuthenticationFilter                │
│                     (com.ams.config)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. extractTokenFromRequest()                         │  │
│  │ 2. jwtUtil.validateToken(token)                      │  │
│  │ 3. jwtUtil.getTenantIdFromToken(token)  ──────────────┼──┼──► 新增
│  │ 4. TenantContextHolder.set(tenantId)     ──────────────┼──┼──► 新增
│  │ 5. finally { TenantContextHolder.clear() } ───────────┼──┼──► 新增
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │ depends on
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         JwtUtil                             │
│                   (com.ams.utils)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ - getSigningKey()                                    │  │
│  │ - getClaimsFromToken(token) ─────────────────────────┼──┼──► EDGE: calls
│  │ + getTenantIdFromToken(token)  ──────────────────────┼──┼──► 新增
│  │ + createToken(userId, username, tenantId)  ──────────┼──┼──► 新增重载
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │ depends on
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TenantContextHolder                      │
│               (com.ams.security.context)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ - private static final ThreadLocal<String> CONTEXT   │  │
│  │ ~ static void set(String tenantId)   [package-private]  │
│  │ + public static String get()                        │  │
│  │ + public static void clear()                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 附录: 编译检查清单

| 序号 | 检查项 | 验证方法 | 状态 |
|------|--------|----------|------|
| 1 | `JwtUtil.java` 包含 `getTenantIdFromToken()` 方法 | 编译验证 | ☐ |
| 2 | `JwtUtil.java` `createToken()` 支持 `tenantId` 参数 | 编译验证 | ☐ |
| 3 | `TenantContextHolder.java` 位于 `com.ams.security.context` 包 | 编译验证 | ☐ |
| 4 | `TenantContextHolder.set()` 权限为 package-private 或 private | 代码审查 | ☐ |
| 5 | `JwtAuthenticationFilter.doFilterInternal()` 包含 `TenantContextHolder.set()` 调用 | 代码审查 | ☐ |
| 6 | `finally` 块包含 `TenantContextHolder.clear()` | 代码审查 | ☐ |
| 7 | 全局搜索 `request.getParameter("tenant")` 无结果 | Grep 搜索 | ☐ |
| 8 | 全局搜索 `request.getHeader("X-Tenant")` 无结果 | Grep 搜索 | ☐ |
| 9 | 所有单元测试通过 | `mvn test` | ☐ |

---

## 附录: 术语表

| 术语 | 定义 |
|------|------|
| JWT | JSON Web Token，一种开放标准（RFC 7519）用于在各方之间安全地传输信息 |
| Claims | JWT 中的声明，包含关于实体（通常是用户）和其他数据的声明 |
| ThreadLocal | Java 提供的一种线程绑定变量存储机制，每个线程都有独立的变量副本 |
| tenant_id | 租户唯一标识符，用于多租户系统中的租户隔离 |
| Filter | Servlet 规范中的过滤器，用于请求/响应的预处理和后处理 |
| 防篡改 | 确保租户 ID 仅从可信来源（JWT）获取，而非用户可控制的请求参数 |

---

**文档版本**: 1.0  
**对应 Iteration**: 1  
**创建日期**: 2026-01-XX  
**审核状态**: 待审核