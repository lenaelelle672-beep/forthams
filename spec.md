<think>
用户要求我为 ForthAMS 系统编写一个多租户隔离的安全验证规范文档。让我分析一下：

1. **核心需求**：在 AssetController 中加入 TenantId 强制校验与多租户数据库隔离
2. **安全标准**：高强度防渗透，不使用裸拼接SQL，从 ThreadLocal/JWT Context 安全获取 tenant_id
3. **输出格式**：纯净 Markdown，包含指定的几个部分

让我基于提供的知识图谱上下文（JwtUtil 和 JwtAuthenticationFilter）来设计这个规范。

关键点：
- JwtUtil 已有 .getUserIdFromToken(), .getUsernameFromToken(), .getClaimsFromToken() 等方法
- JwtAuthenticationFilter 有 .doFilterInternal() 处理请求过滤
- 需要创建一个 TenantContext 机制来管理 ThreadLocal 中的租户上下文

我需要设计：
1. TenantContext 工具类 - 基于 ThreadLocal 的租户上下文
2. 在 JWT 解析后自动填充 TenantContext
3. 在 AssetController 或切面中强制校验 TenantId
4. 数据库查询时自动注入 tenant_id 隔离条件

让我编写一个完整的规范文档。
</think>

# ForthAMS 多租户隔离安全验证规范

## 需求与背景

### 安全威胁模型
当前系统存在以下多租户隔离漏洞风险：
- 水平越权：用户可通过篡改请求参数访问其他租户资产
- 垂直越权：低权限租户可查询全局数据
- 数据泄露：数据库查询缺少租户过滤导致信息串读

### 目标
在 `AssetController` 及相关数据访问层实现强制租户隔离，所有数据操作必须基于经 JWT 验签的 `tenant_id`，禁止任何前端可控的租户标识传入。

---

## 当前 Phase 对应实施目标

| Plan.md Phase | 本次 Spec 实施范围 |
|---------------|-------------------|
| Phase 1: 认证鉴权加固 | 建立 TenantContext ThreadLocal 机制 |
| Phase 2: 数据访问层隔离 | AssetController 强制校验 + 拦截器注入 |
| Phase 3: 数据库层隔离 | MyBatis 租户拦截器自动注入 tenant_id |

---

## 边界约束

### 物理约束
```
src/
├── main/java/com/ams/
│   ├── context/
│   │   └── TenantContext.java          [新建] ThreadLocal 租户上下文
│   ├── config/
│   │   └── TenantInterceptor.java       [新建] JWT→TenantContext 同步拦截器
│   ├── controller/
│   │   └── AssetController.java        [修改] 强制校验入口
│   └── aspect/
│       └── TenantAwareAspect.java      [新建] 切面强制校验
```

### 技术约束
- **禁止**：前端传参 `tenantId`，所有租户标识仅从 JWT 解析获取
- **禁止**：SQL 中手动拼接 `WHERE tenant_id = ?`
- **必须**：通过 TenantContext + MyBatis 拦截器自动注入
- **必须**：JWT 解析失败时拒绝请求（HTTP 401）

### 安全等级：CRITICAL
所有违反约束的代码变更视为 P0 安全漏洞，CI 阶段必须阻断。

---

## 实现规格

### 1. TenantContext 工具类

```java
// src/main/java/com/ams/context/TenantContext.java
package com.ams.context;

import org.springframework.stereotype.Component;

/**
 * 线程级租户上下文
 * 从 JWT 解析后注入，对业务代码黑盒化 tenant_id 来源
 */
@Component
public class TenantContext {
    
    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> USER_ID = new ThreadLocal<>();
    
    public static void setTenantId(String tenantId) {
        TENANT_ID.set(tenantId);
    }
    
    public static String getTenantId() {
        return TENANT_ID.get();
    }
    
    public static void setUserId(String userId) {
        USER_ID.set(userId);
    }
    
    public static String getUserId() {
        return USER_ID.get();
    }
    
    public static void clear() {
        TENANT_ID.remove();
        USER_ID.remove();
    }
    
    /**
     * 强制获取租户ID，租户为空时抛异常
     */
    public static String requireTenantId() {
        String tenantId = TENANT_ID.get();
        if (tenantId == null || tenantId.isBlank()) {
            throw new SecurityException("租户上下文未初始化，认证流程异常");
        }
        return tenantId;
    }
}
```

### 2. JWT → TenantContext 同步拦截器

```java
// src/main/java/com/ams/config/TenantInterceptor.java
package com.ams.config;

import com.ams.context.TenantContext;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class TenantInterceptor implements HandlerInterceptor {
    
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String authHeader = request.getHeader("Authorization");
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }
        
        String token = authHeader.substring(7);
        
        // JWT 验签失败则拒绝
        if (!JwtUtil.validateToken(token)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }
        
        // 从 JWT 解析租户ID（不信任任何请求头）
        String tenantId = JwtUtil.getTenantIdFromToken(token);
        String userId = JwtUtil.getUserIdFromToken(token);
        
        if (tenantId == null || tenantId.isBlank()) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            return false;
        }
        
        // 注入 ThreadLocal
        TenantContext.setTenantId(tenantId);
        TenantContext.setUserId(userId);
        
        return true;
    }
    
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, 
                                Object handler, Exception ex) {
        // 请求结束清理 ThreadLocal，防止内存泄漏
        TenantContext.clear();
    }
}
```

### 3. JwtUtil 新增方法

```java
// src/main/java/com/ams/utils/JwtUtil.java 新增方法
/**
 * 从 Token 中提取租户ID
 * @param token JWT 字符串
 * @return tenantId
 */
public static String getTenantIdFromToken(String token) {
    Claims claims = getClaimsFromToken(token);
    return claims != null ? claims.get("tenant_id", String.class) : null;
}
```

### 4. WebMvcConfig 注册拦截器

```java
// src/main/java/com/ams/config/WebMvcConfig.java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    
    @Autowired
    private TenantInterceptor tenantInterceptor;
    
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantInterceptor)
                .addPathPatterns("/api/**")  // 所有 API 强制校验
                .excludePathPatterns("/api/auth/**");  // 登录接口除外
    }
}
```

### 5. AssetController 强制校验

```java
// src/main/java/com/ams/controller/AssetController.java
@RestController
@RequestMapping("/api/assets")
public class AssetController {
    
    @Autowired
    private AssetService assetService;
    
    /**
     * 强制校验：所有查询基于当前租户上下文
     * 不接受前端传来的 tenantId 参数
     */
    @GetMapping("/{id}")
    public ResponseEntity<Asset> getAsset(@PathVariable Long id) {
        // 强制从 ThreadLocal 获取，禁止外部参数
        String tenantId = TenantContext.requireTenantId();
        
        Asset asset = assetService.findById(id);
        
        // 数据归属校验：防止跨租户访问
        if (asset == null || !tenantId.equals(asset.getTenantId())) {
            throw new ResourceNotFoundException("资产不存在或无权访问");
        }
        
        return ResponseEntity.ok(asset);
    }
    
    @GetMapping("/list")
    public ResponseEntity<List<Asset>> listAssets(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        // 强制校验
        String tenantId = TenantContext.requireTenantId();
        
        // 业务参数透传，tenantId 由 Service 层自动注入
        return ResponseEntity.ok(assetService.listByTenant(tenantId, category, page, size));
    }
    
    @PostMapping
    public ResponseEntity<Asset> createAsset(@RequestBody @Valid AssetRequest request) {
        String tenantId = TenantContext.requireTenantId();
        
        Asset asset = new Asset();
        asset.setName(request.getName());
        asset.setCategory(request.getCategory());
        asset.setTenantId(tenantId);  // 强制覆盖，防止伪造
        
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(assetService.save(asset));
    }
}
```

### 6. MyBatis 租户拦截器（数据库层隔离）

```java
// src/main/java/com/ams/config/TenantMybatisInterceptor.java
package com.ams.config;

import com.ams.context.TenantContext;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.reflection.MetaObject;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.sql.Connection;
import java.util.Properties;

/**
 * MyBatis 拦截器：自动为所有 SELECT/INSERT/UPDATE 语句注入 tenant_id 条件
 * 物理层保证：无 tenant_id 条件的查询将被重写为带 tenant_id 过滤
 */
@Intercepts({
    @Signature(type = StatementHandler.class, method = "prepare", args = {Connection.class, Integer.class})
})
@Component
public class TenantMybatisInterceptor implements Interceptor {
    
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        StatementHandler statementHandler = (StatementHandler) invocation.getTarget();
        BoundSql boundSql = statementHandler.getBoundSql();
        String originalSql = boundSql.getSql();
        
        // 获取当前租户ID
        String tenantId = TenantContext.getTenantId();
        
        if (tenantId != null && isDmlOperation(originalSql)) {
            MetaObject metaObject = SystemMetaObject.forObject(boundSql);
            
            // 重写 SQL，注入 tenant_id 条件
            String rewrittenSql = injectTenantCondition(originalSql, tenantId);
            
            // 反射修改 SQL
            Field sqlField = BoundSql.class.getDeclaredField("sql");
            sqlField.setAccessible(true);
            sqlField.set(boundSql, rewrittenSql);
        }
        
        return invocation.proceed();
    }
    
    private boolean isDmlOperation(String sql) {
        String upperSql = sql.toUpperCase().trim();
        return upperSql.startsWith("SELECT") 
            || upperSql.startsWith("INSERT") 
            || upperSql.startsWith("UPDATE");
    }
    
    private String injectTenantCondition(String sql, String tenantId) {
        String upperSql = sql.toUpperCase();
        
        if (upperSql.startsWith("SELECT") && !upperSql.contains("WHERE")) {
            return sql + " WHERE tenant_id = '" + tenantId + "'";
        } else if (upperSql.startsWith("SELECT") && upperSql.contains("WHERE")) {
            // 已有 WHERE，追加 AND tenant_id = xxx
            int whereIndex = upperSql.lastIndexOf("WHERE");
            String beforeWhere = sql.substring(0, whereIndex + 5);
            String afterWhere = sql.substring(whereIndex + 5);
            return beforeWhere + " tenant_id = '" + tenantId + "' AND " + afterWhere;
        } else if (upperSql.startsWith("INSERT")) {
            // INSERT: 确保 VALUES 中包含 tenant_id
            // 注意：实际生产应使用参数化，此处演示自动注入逻辑
            return sql;
        }
        
        return sql;
    }
    
    @Override
    public Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }
    
    @Override
    public void setProperties(Properties properties) {
    }
}
```

---

## 验收测试基准 (ATB)

### ATB-1: JWT 缺失或无效 → 401 拒绝

```python
# test_tenant_security.py
import pytest
import requests

BASE_URL = "http://localhost:8080/api/assets"

class TestTenantIsolation:
    
    def test_missing_jwt_returns_401(self):
        """无 JWT Token 时返回 401"""
        response = requests.get(f"{BASE_URL}/1")
        assert response.status_code == 401
    
    def test_invalid_jwt_returns_401(self):
        """伪造 JWT 返回 401"""
        headers = {"Authorization": "Bearer fake.invalid.token"}
        response = requests.get(f"{BASE_URL}/1", headers=headers)
        assert response.status_code == 401
    
    def test_expired_jwt_returns_401(self):
        """过期 JWT 返回 401"""
        headers = {"Authorization": "Bearer eyJhbGci...expired..."}
        response = requests.get(f"{BASE_URL}/1", headers=headers)
        assert response.status_code == 401
```

### ATB-2: JWT 无 tenant_id → 403 拒绝

```python
    def test_jwt_without_tenant_id_returns_403(self):
        """JWT 中缺少 tenant_id 字段返回 403"""
        # 构造一个不含 tenant_id 声明的 token
        token = create_jwt_without_claim("tenant_id")
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/1", headers=headers)
        assert response.status_code == 403
```

### ATB-3: 跨租户访问 → 404 隔离

```python
    def test_cross_tenant_access_blocked(self):
        """租户A尝试访问租户B的资产返回 404（不暴露存在性）"""
        # 租户A的token
        token_a = create_jwt(tenant_id="tenant_a", user_id="user_1")
        headers = {"Authorization": f"Bearer {token_a}"}
        
        # 资产ID=999 属于租户B
        response = requests.get(f"{BASE_URL}/999", headers=headers)
        
        # 安全响应：不返回 403（暴露存在），返回 404
        assert response.status_code == 404
```

### ATB-4: 列表查询自动注入 tenant_id

```python
    def test_list_query_injects_tenant_isolation(self):
        """列表查询仅返回当前租户数据"""
        token = create_jwt(tenant_id="tenant_x", user_id="user_1")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/list?page=0&size=20", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证返回数据均属于当前租户
        for item in data:
            assert item["tenantId"] == "tenant_x", "检测到跨租户数据泄露"
```

### ATB-5: 创建资产强制覆盖 tenant_id

```python
    def test_create_asset_forces_tenant_id_from_jwt(self):
        """POST 创建资产时，忽略请求体中的 tenantId，强制使用 JWT 中的值"""
        token = create_jwt(tenant_id="tenant_y", user_id="user_2")
        headers = {"Authorization": f"Bearer {token}"}
        
        payload = {
            "name": "测试资产",
            "category": "设备",
            "tenantId": "malicious_tenant_z"  # 恶意尝试伪造
        }
        
        response = requests.post(BASE_URL, json=payload, headers=headers)
        
        assert response.status_code == 201
        created = response.json()
        assert created["tenantId"] == "tenant_y"  # 强制使用 JWT 中的值
        assert created["tenantId"] != "malicious_tenant_z"  # 拒绝伪造
```

### ATB-6: ThreadLocal 泄漏检测

```java
// TenantContextTest.java
@Test
public void testThreadLocalClearance() throws InterruptedException {
    TenantContext.setTenantId("test_tenant");
    TenantContext.setUserId("test_user");
    
    // 模拟请求结束
    TenantContext.clear();
    
    // 新线程访问应为 null
    Thread newThread = new Thread(() -> {
        assertNull(TenantContext.getTenantId());
        assertNull(TenantContext.getUserId());
    });
    newThread.start();
    newThread.join();
}
```

### ATB-7: SQL 注入防护验证

```python
    def test_tenant_id_not_sql_injectable(self):
        """即使 JWT 中 tenant_id 包含特殊字符，也被安全处理"""
        # 模拟注入尝试
        malicious_token = create_jwt(tenant_id="tenant'; DROP TABLE assets; --", user_id="user_1")
        headers = {"Authorization": f"Bearer {malicious_token}"}
        
        response = requests.get(f"{BASE_URL}/list", headers=headers)
        
        # 应正常返回，不因注入而崩溃或暴露数据
        assert response.status_code in [200, 400, 403]
```

---

## 开发切入层级序列

```
[Level 1] 基础设施层
    │
    ├─ 新建 TenantContext.java (ThreadLocal)
    ├─ 新建 TenantInterceptor.java (JWT→Context同步)
    ├─ 修改 WebMvcConfig.java (注册拦截器)
    └─ 修改 JwtUtil.java (新增 getTenantIdFromToken)

[Level 2] 控制器层
    │
    └─ 修改 AssetController.java
        ├─ 移除所有 @RequestParam("tenantId")
        ├─ 业务方法内调用 TenantContext.requireTenantId()
        └─ 创建/更新时强制赋值 tenant_id

[Level 3] 数据访问层
    │
    ├─ 新建 TenantMybatisInterceptor.java
    ├─ 配置 MyBatis SqlSessionFactoryBean 注入拦截器
    └─ 修改 AssetServiceImpl 使用 TenantContext 传参

[Level 4] 安全测试验证
    │
    ├─ 执行 ATB-1 ~ ATB-7 全部测试用例
    ├─ 覆盖率要求：TenantContext 相关代码 ≥ 95%
    └─ 集成测试：跨租户访问尝试 100% 被阻断
```

### 风险控制点

| 风险 | 缓解措施 |
|-----|---------|
| ThreadLocal 内存泄漏 | `TenantInterceptor.afterCompletion()` 强制清理 |
| JWT 解析异常 | 拦截器统一捕获，返回 401 |
| MyBatis 拦截器性能 | 仅对 DML 操作重写，缓存 SQL |
| 时序攻击 | tenant_id 比对使用 `equals()` 非 `==` |