<|channel>thought
<channel|># ForthAMS 多租户安全隔离规格文档

## 需求与背景

### 问题定义
当前系统在多租户环境下存在横向越权风险：用户可能通过篡改请求参数获取其他租户的数据。必须建立**强阻断机制**，确保所有数据查询强制受限于登录用户的 `tenant_id`。

### 设计原则
- **禁止显式传参**：严禁在 API 参数中直接传递 tenantId 供业务逻辑使用
- **上下文驱动隔离**：租户标识仅从经过验证的 JWT Token 解析并存储于 ThreadLocal 中
- **静默失败优先**：任何无法识别有效租户上下文的操作应立即抛出 `403 Forbidden`

---

## 当前 Phase 对应实施目标

| Phase | 名称 | 本次变更归属 | 说明 |
|---|---|---|---|
| Phase 2 | 安全基础设施建设 | ✓ 核心组件 | 构建多租户隔离的拦截层与上下文机制 |
| Phase 4 | 数据访问安全增强 | - | 后续通过 MyBatis Interceptor 实现物理 SQL 注入 tenant_id 条件 |

**本次目标：Phase 2.3 —— 多租户身份上下文中继与强制校验切面实现**

---

## 边界约束

### 禁止项
- ❌ **禁止使用裸拼接 SQL** 进行多租户过滤
- ❌ **禁止在 Controller 方法参数中显式声明 `tenantId`** 并接受客户端输入
- ❌ **禁止允许查询绕过隔离检查**（即使是管理员角色也必须受限于上下文）

### 强制项
- ✅ 从已验证的 JWT Claims 中提取 tenant_id，严禁信任请求 Body 或 Query 参数中的租户标识
- ✅ 在 `AssetController` 的所有读写方法前增加拦截校验
- ✅ 若 ThreadLocal 上下文缺失或无效，抛出明确的安全异常而非返回空结果

---

## 开发切入层级序列

### 第一阶段：上下文基础设施 (Infrastructure)

```java
// src/main/java/com/ams/context/TenantContext.java
public class TenantContext {
    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();
    public static void set(String tenantId) { TENANT_ID.set(tenantId); }
    public static String get() { return TENANT_ID.get(); }
    public static void clear() { TENANT_ID.remove(); }
}
```

### 第二阶段：JWT 解析增强 (JwtUtil 扩展)

在 `src/main/java/com/ams/utils/JwtUtil.java` 中增加提取方法：

```java
// L75 新增内容
public String getTenantIdFromToken(String token) {
    Claims claims = getClaimsFromToken(token);
    return (String) claims.get("tenant_id"); // 从自定义 Claim 中读取
}
```

### 第三阶段：过滤器注入上下文 (JwtAuthenticationFilter 扩展)

在 `src/main/java/com/ams/config/JwtAuthenticationFilter.java` 的 `.doFilterInternal()` 方法中增加：

```java
// L42 新增内容，紧跟 token 验证之后
String tenantId = jwtUtil.getTenantIdFromToken(token);
if (tenantId == null) {
    response.sendError(HttpServletResponse.SC_FORBIDDEN, "Missing tenant context");
    return;
}
TenantContext.set(tenantId);
try {
    filterChain.doFilter(request, response);
} finally {
    TenantContext.clear(); // 必须清理，防止线程池污染
}
```

### 第四阶段：Controller 层强制校验 (AssetController)

在 `src/main/java/com/ams/controller/AssetController.java` 中增加拦截逻辑：

```java
@GetMapping("/{id}")
public ResponseEntity<Asset> getAsset(@PathVariable Long id, @RequestHeader("Authorization") String authHeader) {
    String token = extractToken(authHeader);
    // 强制校验 tenant_id 与资源归属匹配，严禁直接返回数据
    Long resourceTenantId = assetService.getAssetTenantId(id);
    if (!Objects.equals(resourceTenantId, TenantContext.get())) {
        throw new AccessDeniedException("Cross-tenant access denied");
    }
    return ResponseEntity.ok(assetService.findById(id));
}
```

---

## 验收测试基准 (ATB)

### 测试用例 1：合法租户访问（Positive）
**工具**: Playwright / Curl  
**操作**: 使用 A 租户 Token 请求属于 A 租户的资产 ID 101  
**期待结果**: HTTP 200 OK，返回正确数据内容

### 测试用例 2：跨租户越权攻击（Negative - Core）
**工具**: Playwright / Curl  
**操作**: 使用 B 租户 Token 请求属于 A 租户的资产 ID 101  
**期待结果**: HTTP 403 Forbidden，响应体包含安全异常信息

### 测试用例 3：无 Token/无效 Token（Negative）
**工具**: Playwright / Curl  
**操作**: 不带 Authorization Header 或使用伪造签名 Token 请求任何资源  
**期待结果**: HTTP 401 Unauthorized 或 403 Forbidden，严禁穿透到业务层

### 测试用例 4：ThreadLocal 清理验证（Negative）
**工具**: JUnit + MockMvc (并发压力测试)  
**操作**: 并发执行大量请求并检查是否存在租户上下文污染现象  
**期待结果**: 每个线程在响应结束后 TenantContext 为空，无跨请求数据泄露

---

## 安全等级评估
| 指标 | 评分 | 说明 |
|---|---|---|
| 防绕过能力 | High | 从认证链路根部拦截，无法通过参数篡改规避 |
| 实现复杂度 | Medium | ThreadLocal + JWT Claim 方案成熟且侵入性可控 |
| 性能损耗 | Low | 单次查询增加 O(1) 的上下文检查开销 |