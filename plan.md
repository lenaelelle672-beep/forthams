<|channel>thought
<channel|># 开发计划：多租户强隔离与 TenantId 强制校验

## 开发计划总览
在 `AssetController` 层实现基于 JWT 上下文的租户 ID 强制拦截，构建不可绕过的多租户数据访问屏障。

---

## Phase 拆解

### **Phase 1: 安全上下文基础设施增强**
- **目标**：建立稳定的 TenantId 获取机制，确保从认证链路中安全提取并传递隔离标识
- **涉及文件/模块**：
  - `src/main/java/com/ams/utils/JwtUtil.java` — 扩展 claims 解析逻辑
  - `src/main/java/com/ams/config/JwtAuthenticationFilter.java` — 在过滤器链中注入租户上下文
  - 新建 `TenantContextHolder.java` (ThreadLocal 持久化)
- **验收条件**：所有已认证请求的 ThreadLocal 中均能正确持有 tenant_id，且无法通过外部参数篡改
- **预计难度**：低

### **Phase 2: Controller 层强阻断拦截器实现**
- **目标**：在 `AssetController` 入口处强制校验租户合法性，建立第一道防御线
- **涉及文件/模块**：
  - `src/main/java/com/ams/controller/AssetController.java` — 注入 tenantId 参数并增加 preCheck 方法
  - 新建 `TenantSecurityInterceptor.java` 或在 Controller 中实现 AOP 切面
- **验收条件**：未带有效租户标识的请求返回 403 Forbidden，且拦截逻辑不可被业务代码绕过
- **预计难度**：中

### **Phase 3: 多租户数据库隔离模拟查询层**
- **目标**：在数据访问层强制注入 `tenant_id` 条件，实现物理/逻辑上的行级隔离效果
- **涉及文件/模块**：
  - `src/main/java/com/ams/repository/AssetRepository.java` — 重构所有查询方法签名
  - 新建 `TenantAwareBaseService.java` 或 BaseDAO 抽象类
  - 相关 Service 实现类（如 `AssetServiceImpl.java`）
- **验收条件**：所有数据库操作必须显式包含 tenant_id 条件，无任何裸 SQL 拼接，且无法查询到跨租户数据
- **预计难度**：高

### **Phase 4: 安全红线自动化验证测试**
- **目标**：编写针对多租户越权（IDOR）的专项测试用例，确保隔离机制生效
- **涉及文件/模块**：
  - `src/test/java/com/ams/security/TenantIsolationTest.java` — 模拟不同 tenant_id 的请求交叉查询测试
- **验收条件**：所有跨租户越权尝试均被拦截，且单元测试覆盖率达到要求
- **预计难度**：中

---

## 当前 Phase 焦点

> **当前应集中攻克：Phase 1 + Phase 2 并行实施**

首先必须确保 `JwtUtil` 和 `JwtAuthenticationFilter` 能正确提取并固化租户标识，这是后续所有隔离逻辑的信任根源。在建立上下文机制的同时同步实现 Controller 层的强制拦截，形成闭环防御。

---

## 风险与依赖

| 风险点 | 说明 |
|---|---|
| **Token Payload 不含 tenant_id** | 若现有 JWT Claims 中未包含该字段，需先执行 Token 生成逻辑变更（修改 `JwtUtil.createToken`） |
| **存量查询遗漏隔离条件** | Repository 层若存在原生 SQL 或动态拼接，可能产生越权漏洞。必须全面重构为参数化绑定 |
| **ThreadLocal 泄露风险** | 在线程池环境下需确保请求结束后清理 TenantContextHolder，否则会发生租户数据污染 |
| **性能损耗** | 每层查询强制注入 tenant_id 条件在复杂关联查询下可能导致索引失效或执行计划劣化 |

---

## 代码实现参考（关键结构）

```java
// ThreadLocal 隔离上下文示例
public class TenantContextHolder {
    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();
    public static void setTenantId(String tenantId) { TENANT_ID.set(tenantId); }
    public static String getTenantId() { return TENANT_ID.get(); }
    public static void clear() { TENANT_ID.remove(); }
}

// AssetController 拦截示例
@GetMapping("/{id}")
public ResponseEntity<?> getAsset(@PathVariable Long id) {
    String tenantId = TenantContextHolder.getTenantId();
    if (tenantId == null || !isValid(tenantId)) {
        throw new AccessDeniedException("租户标识无效");
    }
    // 强制带入隔离条件查询
    return ResponseEntity.ok(assetService.findByIdWithTenantIsolation(id, tenantId));
}
```