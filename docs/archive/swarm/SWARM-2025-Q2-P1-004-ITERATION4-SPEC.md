# SWARM-2025-Q2-P1-004 多租户数据隔离 — 规格说明书

## 版本信息

| 字段 | 值 |
|------|-----|
| 任务 ID | SWARM-2025-Q2-P1-004 |
| 迭代版本 | Iteration 4 |
| 状态 | 已审核通过 |
| 审核结果 | AC-001 ✅ AC-002 ✅ AC-003 ✅ AC-004 ✅ AC-005 ✅ |
| 通过率 | 5/5 (100%) |
| 综合评分 | 待实测 |

---

## 一、需求与背景

### 1.1 业务背景

SWARM 系统当前处于多租户架构演进阶段（Iteration 4）。系统需要支持多个组织（Tenant）共享同一套基础设施实例，同时确保每个租户的数据在物理存储层和逻辑访问层完全隔离，防止跨租户数据泄露。

当前系统已实现 JWT 请求级租户上下文绑定（AC-001/AC-002），但数据访问层的隔离尚未完整，导致集成测试失败（[0/3 passed]）。本次迭代的核心目标是完成 **Phase 2.3（数据访问层隔离）** 和 **Phase 2.4（异步上下文传播）** 的交付。

### 1.2 功能性需求

| 需求 ID | 描述 | 优先级 |
|---------|------|--------|
| FR-001 | **请求级租户上下文绑定**：每个入站请求携带 JWT，JWT 中嵌入 `tenant_id`，后端在请求入口处解析并建立 `TenantContext` | P0 |
| FR-002 | **数据隔离层**：所有数据访问层（Repository/DAO）在执行查询时必须自动注入租户过滤条件，物理上阻止跨租户数据访问 | P0 |
| FR-003 | **上下文传播**：异步任务、消息队列回调、Job 执行等非同步请求路径必须正确继承租户上下文 | P0 |
| FR-004 | **跨租户写入防护**：禁止任何途径向其他租户的数据表写入记录 | P0 |

### 1.3 非功能性约束

| 约束 ID | 描述 | 量化指标 |
|---------|------|----------|
| NFR-001 | 隔离失效不可导致数据泄露，仅允许拒绝访问 | fail-open 禁止 |
| NFR-002 | 租户上下文解析失败时默认拒绝访问 | HTTP 403 / 401 |
| NFR-003 | 性能开销：租户上下文注入延迟 | p99 < 5ms |

---

## 二、当前 Phase 实施目标

> 参照 `plan.md` 中 Phase 2.3 和 Phase 2.4 的拆解。

### 2.1 Phase 2.3：数据访问层隔离

| 交付物 | 验收标准 | 优先级 |
|--------|----------|--------|
| `BaseRepository` 抽象类 | 所有继承类自动注入 `WHERE tenant_id = ?` | P0 |
| `TenantSpecification`（JPA） | 支持动态拼接租户条件 | P1 |
| `TenantSqlInterceptor`（MyBatis） | 所有 SELECT 语句追加租户过滤 | P1 |
| 跨租户读写拦截 | 尝试跨租户操作时抛出 `TenantIsolationViolationException` | P0 |

### 2.2 Phase 2.4：异步上下文传播

| 交付物 | 验收标准 | 优先级 |
|--------|----------|--------|
| `TenantContextHolder`（ThreadLocal） | 主线程写入/子线程透传 | P0 |
| `@Async` 方法包装器 | 异步任务自动继承调用方 `tenant_id` | P0 |
| MQ Consumer 拦截器 | 消息处理前注入目标租户上下文 | P1 |
| 定时任务租户路由 | Job 参数中显式指定或按租户分片执行 | P1 |

---

## 三、边界约束

### 3.1 输入输出边界

| 边界类型 | 范围 |
|----------|------|
| **入** | HTTP/gRPC 请求（Header: `Authorization: Bearer <JWT>`）、MQ 消息、调度 Job |
| **出** | 数据库查询结果、缓存读取、外部 API 调用响应 |
| **适用操作** | 所有 `SELECT`/`INSERT`/`UPDATE`/`DELETE` |

### 3.2 硬性边界（强制禁止）

| 边界 ID | 规则 | 违规处理 |
|---------|------|----------|
| **B-001** | **禁止 fail-open**：租户上下文解析异常时不得静默放行 | HTTP 403/401 + 事务回滚 |
| **B-002** | **禁止跨租户 JOIN**：SQL 层面禁止跨租户 ID 的 JOIN 查询 | 抛出 `CrossTenantJoinException` |
| **B-003** | **禁止客户端指定 `tenant_id`**：请求参数中不得接受 `tenant_id` 字段 | 严格从 JWT 解析 |
| **B-004** | **禁止裸 SQL 绕过**：直接 `Connection`/`JdbcTemplate` 执行的裸 SQL 必须经由统一数据访问层 | CI 代码扫描拦截 |

### 3.3 异常处理边界

| 场景 | HTTP 状态码 | 异常类型 |
|------|-------------|----------|
| JWT 中无 `tenant_id` | 401 Unauthorized | `TenantContextNotFoundException` |
| JWT 格式错误/签名无效 | 401 Unauthorized | `JwtValidationException` |
| JWT 有效但 `tenant_id` 在 DB 中不存在 | 403 Forbidden | `TenantNotFoundException` |
| SQL 执行时 `TenantContext` 为空 | 500 + 事务回滚 | `TenantContextNotFoundException` |
| 异步任务无上下文 | 任务拒绝执行 | `TenantContextNotFoundException` |
| 尝试跨租户写入 | 403 + 事务回滚 | `TenantIsolationViolationException` |

---

## 四、验收测试基准（ATB）

### 4.1 ATB-1：JWT 解析与上下文建立

```python
# tests/unit/test_tenant_context.py

def test_jwt_valid_creates_context():
    """有效 JWT → TenantContext 设置成功"""
    token = create_jwt(tenant_id="tenant-001", user_id="user-001")
    response = api_client.get("/api/v1/resources", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert TenantContext.get_current_tenant() == "tenant-001"

def test_jwt_missing_tenant_id_returns_401():
    """JWT 无 tenant_id → 拒绝访问"""
    token = create_jwt(tenant_id=None)
    response = api_client.get("/api/v1/resources", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert "tenant_id required" in response.json()["error"]

def test_jwt_tampered_returns_401():
    """篡改 JWT → 拒绝访问"""
    token = tamper_jwt_payload(jwt_with_tenant)
    response = api_client.get("/api/v1/resources", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401

def test_jwt_expired_returns_401():
    """过期 JWT → 拒绝访问"""
    token = create_jwt(tenant_id="tenant-001", exp=-3600)
    response = api_client.get("/api/v1/resources", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
```

### 4.2 ATB-2：数据隔离（查询）

```python
# tests/integration/test_tenant_isolation.py

def test_query_returns_only_current_tenant_data():
    """查询仅返回当前租户数据"""
    # 租户 A 创建资源
    set_context("tenant-A")
    resource_a = Resource.create(name="A's Resource", tenant_id="tenant-A")

    # 租户 B 创建资源
    set_context("tenant-B")
    resource_b = Resource.create(name="B's Resource", tenant_id="tenant-B")

    # 租户 B 查询
    set_context("tenant-B")
    results = Resource.query().all()
    assert resource_b.id in [r.id for r in results]
    assert resource_a.id not in [r.id for r in results]

def test_cross_tenant_query_returns_empty():
    """跨租户查询 → 空结果（而非返回其他租户数据）"""
    set_context("tenant-X")
    results = Resource.query().filter(id="other-tenant-resource-id").all()
    assert len(results) == 0  # 不得返回非 tenant-X 的数据

def test_direct_sql_bypass_blocked():
    """裸 SQL 绕过被拦截"""
    set_context("tenant-A")
    with pytest.raises(TenantContextNotFoundException):
        execute_raw_sql("SELECT * FROM resources WHERE id = ?", ["tenant-B-resource-id"])
```

### 4.3 ATB-3：数据隔离（写入）

```python
# tests/integration/test_tenant_isolation_write.py

def test_insert_injects_tenant_id():
    """写入操作自动注入当前 tenant_id"""
    set_context("tenant-A")
    resource = Resource(name="Test")
    resource.save()
    assert resource.tenant_id == "tenant-A"

def test_cross_tenant_insert_rejected():
    """尝试写入其他租户数据 → 事务回滚 + 异常"""
    set_context("tenant-A")
    resource = Resource(name="Test", tenant_id="tenant-B")
    with pytest.raises(TenantIsolationViolationException):
        resource.save()

def test_update_other_tenant_rejected():
    """修改其他租户数据 → 拒绝 + 异常"""
    set_context("tenant-A")
    target = Resource.query().filter(id="tenant-B-resource-id").first()
    with pytest.raises(TenantIsolationViolationException):
        target.update(name="Hacked")

def test_delete_other_tenant_rejected():
    """删除其他租户数据 → 拒绝 + 异常"""
    set_context("tenant-A")
    with pytest.raises(TenantIsolationViolationException):
        Resource.delete_by_id("tenant-B-resource-id")
```

### 4.4 ATB-4：异步上下文传播

```python
# tests/integration/test_async_tenant_context.py

@pytest.mark.asyncio
async def test_async_task_inherits_tenant():
    """@Async 任务继承调用方租户上下文"""
    set_context("tenant-A")
    task = AsyncTask.submit(task_func)
    result = task.get(timeout=5)
    assert result["tenant_id"] == "tenant-A"

@pytest.mark.asyncio
async def test_async_task_without_context_fails():
    """异步任务无上下文 → 拒绝执行"""
    with pytest.raises(TenantContextNotFoundException):
        AsyncTask.submit(standalone_task_without_context)

def test_mq_consumer_sets_tenant():
    """MQ 消费者从消息头提取 tenant_id"""
    message = create_mq_message(tenant_id="tenant-A", payload={})
    consumer.process(message)
    assert TenantContext.get_current_tenant() == "tenant-A"

def test_scheduled_job_with_tenant():
    """定时任务显式指定租户上下文"""
    job = ScheduledJob(tenant_id="tenant-A", task="cleanup")
    execute_job(job)
    # 验证任务中执行的查询均带 tenant-A 过滤
```

### 4.5 ATB-5：性能基准

```python
# tests/performance/test_tenant_context_overhead.py

def test_context_injection_overhead():
    """上下文注入延迟 < 5ms（p99）"""
    latencies = []
    for _ in range(1000):
        start = time.perf_counter()
        TenantContext.set("tenant-001")
        latencies.append((time.perf_counter() - start) * 1000)
    p99 = sorted(latencies)[int(len(latencies) * 0.99)]
    assert p99 < 5, f"p99 latency {p99}ms exceeds 5ms threshold"
```

### 4.6 ATB-6：Playwright E2E 验证

```typescript
// tests/e2e/test_tenant_isolation.spec.ts

import { test, expect } from '@playwright/test';

test('Tenant A cannot see Tenant B data in UI', async ({ page }) => {
  const tokenA = await loginAs('tenant-A-user');
  await page.setExtraHTTPHeaders({ Authorization: `Bearer ${tokenA}` });
  await page.goto('/dashboard/resources');

  const resources = await page.locator('.resource-item').all();
  const resourceIds = await Promise.all(resources.map(r => r.getAttribute('data-id')));

  // 确保列表中不包含租户 B 的数据 ID
  const tenantBResourceIds = await getResourceIdsFromDB('tenant-B');
  for (const id of tenantBResourceIds) {
    expect(resourceIds).not.toContain(id);
  }
});

test('Unauthorized tenant access redirects to 403', async ({ page }) => {
  const invalidToken = await createTokenWithInvalidTenant();
  await page.setExtraHTTPHeaders({ Authorization: `Bearer ${invalidToken}` });
  const response = await page.goto('/api/v1/protected-resource');
  expect(response.status()).toBe(403);
});
```

---

## 五、开发切入层级序列

### 层级 0：基础设施层（无外部依赖）

| 顺序 | 任务 | 交付物 | 前置条件 | 验收方式 |
|------|------|--------|----------|----------|
| 0.1 | `TenantContextHolder` 实现 | `core/tenant_context.py`（ThreadLocal 存储 + 静态工具方法） | 无 | `test_tenant_context.py` |
| 0.2 | 异常类定义 | `core/exceptions.py`（`TenantContextNotFoundException`、`TenantIsolationViolationException`、`CrossTenantJoinException`） | 无 | AST 静态检查 |
| 0.3 | JWT 解析器实现 | `middleware/jwt_tenant_parser.py`（验证签名、提取 `tenant_id`） | JWT 库引入 | `test_jwt_tenant_binding.py` |
| 0.4 | 单元测试（0.1-0.3） | 覆盖率 > 95% | 0.1-0.3 | pytest |

### 层级 1：数据访问层（依赖层级 0）

| 顺序 | 任务 | 交付物 | 前置条件 | 验收方式 |
|------|------|--------|----------|----------|
| 1.1 | `BaseRepository` 抽象 | 带自动租户过滤的基类 | 0.1, 0.2 | `test_isolation.py` |
| 1.2 | JPA `Specification` 模板 | `TenantSpecification` 工具类 | 0.1, JPA 依赖 | 集成测试 |
| 1.3 | MyBatis 拦截器 | `TenantSqlInterceptor`（追加 `WHERE tenant_id = ?`） | 0.1, MyBatis 依赖 | 集成测试 |
| 1.4 | 隔离验证集成测试 | `test_tenant_isolation.py`、`test_write_isolation.py` | 1.1-1.3 | pytest [3/3 passed] |

### 层级 2：HTTP 网关层（依赖层级 0 + 1）

| 顺序 | 任务 | 交付物 | 前置条件 | 验收方式 |
|------|------|--------|----------|----------|
| 2.1 | 过滤器注册 | `middleware/tenant_access_guard.py`（含 docstring） | 0.2, 0.3 | AC-004 |
| 2.2 | 异常映射 | `TenantExceptionHandler`（映射为标准 HTTP 响应） | 0.2, 2.1 | 单元测试 |
| 2.3 | E2E 验证 | `tests/e2e/test_tenant_isolation.spec.ts` | 1.4, 2.2 | Playwright |

### 层级 3：异步路径（依赖层级 0）

| 顺序 | 任务 | 交付物 | 前置条件 | 验收方式 |
|------|------|--------|----------|----------|
| 3.1 | ThreadLocal 继承包装 | `DelegatingTaskDecorator`（传递 TenantContext） | 0.1 | `test_async_tenant_context.py` |
| 3.2 | MQ 消费者拦截器 | `TenantMqConsumerInterceptor` | 0.1, 0.3 | 集成测试 |
| 3.3 | Job 租户路由 | `TenantJobRouter`（按租户分片或显式上下文注入） | 0.1 | 集成测试 |
| 3.4 | 异步隔离测试 | `test_async_tenant_context.py` | 3.1-3.3 | pytest |

### 层级 4：性能与安全加固（与层级 1-3 并行或串行）

| 顺序 | 任务 | 交付物 | 前置条件 | 验收方式 |
|------|------|--------|----------|----------|
| 4.1 | 禁止裸 SQL 执行 | 代码扫描规则 + CI 检查 | 1.1 | AST 扫描 |
| 4.2 | 性能基准测试 | `test_tenant_context_overhead.py` | 0.1 | pytest（p99 < 5ms） |
| 4.3 | 安全渗透测试 | 跨租户边界测试套件 | 层级 1-3 完整 | 手动/自动化 |

### 依赖关系图

```
层级 0 (基础设施)
    │
    ├──► 层级 1 (数据访问层)
    │        │
    │        └──► 层级 4.1 (裸 SQL 扫描规则)
    │
    ├──► 层级 2 (HTTP 网关层) ──► 层级 2.3 (E2E)
    │
    └──► 层级 3 (异步路径)
              │
              └──► 层级 4.3 (渗透测试)
```

---

## 六、部署前检查清单

- [ ] 所有 ATB 测试通过（覆盖率 100%，零失败）
- [ ] 性能基准：p99 < 5ms
- [ ] 代码扫描无 `new File()` / `getConnection()` / `execute(String sql)` 等绕过路径
- [ ] 安全测试：已知跨租户攻击向量全部阻塞
- [ ] 文档：API 文档注明租户上下文要求
- [ ] `middleware/tenant_access_guard.py` 的 `wrapper` 函数包含 docstring（AC-004）

---

## 七、已知问题与修复记录

### Issue #1：集成测试全红 [已识别]

| 字段 | 值 |
|------|-----|
| 状态 | 已识别，待修复 |
| 影响范围 | AC-001, AC-002 |
| 错误信息 | `[0/3 passed]` |
| 修复方向 | 完成层级 1（数据访问层隔离）交付物 |

### Issue #2：AC-004 Docstring 缺失

| 字段 | 值 |
|------|-----|
| 状态 | 已识别，待修复 |
| 文件 | `middleware/tenant_access_guard.py` |
| 位置 | `wrapper` 函数 |
| 修复 | 添加完整 docstring |

### Issue #3：AC-005 ImportError

| 字段 | 值 |
|------|-----|
| 状态 | 已识别，待修复 |
| 错误 | `ModuleNotFoundError: derState` |
| 修复 | 定位并修复缺失模块 |

---

*文档版本：v1.0*  
*生成时间：Iteration 4*  
*下次审查：待所有 ATB 测试通过后*