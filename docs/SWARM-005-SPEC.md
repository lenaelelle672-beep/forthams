# SWARM-005 规格指导文档

## 需求与背景

### 业务背景

Squad Vendor 模块定位为供应商全生命周期闭环管理系统，覆盖以下核心链路：

- **供应商准入**：资质审核、信用评估、合规准入
- **供应商运营**：绩效评分、风险监控、合作状态管理
- **供应商变更**：信息变更申请、审批流、状态跃迁
- **供应商退出**：淘汰/暂停/黑名单机制

### 技术债现状

依据 round 43/49 风险审计结果，识别到以下高 Severity 问题：

| Severity | 问题类型 | 影响范围 |
|----------|----------|----------|
| Critical | 供应商状态机跃迁竞态 | 供应商状态并发修改 |
| Critical | 资质过期未自动预警 | 供应商合规性漏洞 |
| High | 批量操作无事务回滚 | 数据一致性风险 |
| High | API 限流缺失 | DoS 攻击面 |

### 本次迭代目标

修复 round 43/49 审计发现的高 Severity 技术债，并在修复过程中确保供应商核心链路功能完整性。

---

## 当前 Phase 对应实施目标

参照标准 Phase 拆解，本次迭代对应 **Phase 2: 核心链路打通** 与 **Phase 3: 技术债修复** 的交叉实施：

```
Phase 1: 基础设施搭建     [已历史完成]
Phase 2: 核心链路打通     [← 本次 Iteration 1 主战场]
Phase 3: 技术债修复       [← 与 Phase 2 并行]
Phase 4: 集成与验收       [后续 Iteration]
```

### 本次 Iteration 1 具体目标

1. **供应商 CRUD 完整链路**：实现供应商的创建、查询、更新、状态变更全链路
2. **状态机修复**：解决 Critical 级别的状态跃迁竞态问题
3. **事务加固**：批量操作增加事务回滚机制
4. **限流防护**：API 层增加 Rate Limiting

---

## 边界约束

### 功能边界

| 约束类型 | 说明 |
|----------|------|
| 范围边界 | 仅覆盖 `vendor` 核心实体及其直接关联的 `qualification`（资质）、`risk_record`（风险记录） |
| 排除范围 | 财务结算、合同签署、第三方信用API对接（延期至 Phase 4） |
| 数据边界 | 单次批量操作上限 100 条记录 |

### 技术约束

| 约束类型 | 说明 |
|----------|------|
| 事务策略 | 跨服务操作使用 Saga 模式，本服务内使用 ACID 事务 |
| 并发控制 | 状态变更采用乐观锁（version 字段），重试上限 3 次 |
| 幂等性 | 所有写操作需支持幂等，依赖 `idempotency_key` |
| 性能要求 | 单次查询 P99 < 200ms，批量操作 < 2s |

### 质量约束

- 所有 Critical/High Severity 问题必须在本次迭代关闭
- 变异测试覆盖率需达到 85% 以上
- 回归测试套件必须 100% 通过

---

## 验收测试基准 (ATB)

### ATB-1: 供应商基础 CRUD

| 测试编号 | 测试场景 | 物理测试期待 | 工具 |
|----------|----------|--------------|------|
| ATB-1.1 | 创建供应商成功 | HTTP 201，响应包含 `vendor_id`，数据库存在对应记录 | pytest |
| ATB-1.2 | 创建供应商参数校验失败 | HTTP 422，响应包含字段级错误信息 | pytest |
| ATB-1.3 | 查询供应商存在 | HTTP 200，返回完整供应商信息 | pytest |
| ATB-1.4 | 查询供应商不存在 | HTTP 404，响应包含 `detail` | pytest |
| ATB-1.5 | 更新供应商信息 | HTTP 200，version 自增，数据库已更新 | pytest |
| ATB-1.6 | 删除供应商（软删除） | HTTP 204，`is_deleted=True`，关联数据保留 | pytest |

**关键断言点**：
```python
# ATB-1.1 伪代码
resp = client.post("/api/v1/vendors", json=payload)
assert resp.status_code == 201
assert "vendor_id" in resp.json()
assert db.query(Vendor).filter_by(vendor_id=resp.json()["vendor_id"]).first() is not None
```

### ATB-2: 供应商状态机

| 测试编号 | 测试场景 | 物理测试期待 | 工具 |
|----------|----------|--------------|------|
| ATB-2.1 | 合法状态跃迁 | HTTP 200，状态更新，version+1 | pytest |
| ATB-2.2 | 非法状态跃迁 | HTTP 400，响应 `{"error": "invalid_transition"}` | pytest |
| ATB-2.3 | 并发状态变更竞态修复验证 | 10 并发请求，仅 1 成功，其余返回 409 | pytest + threading |
| ATB-2.4 | 状态变更事件发布 | Kafka/EventBus 收到 `VendorStatusChanged` 事件 | pytest + mock |

**关键断言点**：
```python
# ATB-2.3 并发竞态测试
def test_concurrent_status_update():
    vendor_id = create_vendor()["vendor_id"]
    results = []
    def update_status():
        r = client.post(f"/api/v1/vendors/{vendor_id}/status", json={"status": "active"})
        results.append(r.status_code)
    
    threads = [threading.Thread(target=update_status) for _ in range(10)]
    for t in threads: t.start()
    for t in threads: t.join()
    
    # 严格断言：仅 1 成功，9 个 409 Conflict
    assert results.count(200) == 1
    assert results.count(409) == 9
```

### ATB-3: 资质管理

| 测试编号 | 测试场景 | 物理测试期待 | 工具 |
|----------|----------|--------------|------|
| ATB-3.1 | 资质创建与关联 | HTTP 201，资质与供应商正确关联 | pytest |
| ATB-3.2 | 资质过期自动预警 | 定时任务触发，生成 `qualification_expiring` 事件 | pytest + scheduler |
| ATB-3.3 | 资质过期阻断 | 过期资质供应商无法发起交易（业务规则） | pytest |

### ATB-4: 批量操作事务

| 测试编号 | 测试场景 | 物理测试期待 | 工具 |
|----------|----------|--------------|------|
| ATB-4.1 | 批量更新部分失败 | 数据库回滚，无任何记录被修改 | pytest |
| ATB-4.2 | 批量更新全部成功 | HTTP 200，所有记录已更新 | pytest |
| ATB-4.3 | 批量操作超过上限 | HTTP 400，`{"error": "batch_size_exceeded"}` | pytest |

**关键断言点**：
```python
# ATB-4.1 事务回滚测试
def test_batch_partial_failure_rollback():
    vendors = [create_vendor()["vendor_id"] for _ in range(5)]
    # 故意注入一条无效记录
    payload = [{"vendor_id": v, "name": "test"} for v in vendors]
    payload[2]["vendor_id"] = "non-existent-id"  # 触发失败
    
    resp = client.post("/api/v1/vendors/batch-update", json=payload)
    assert resp.status_code == 400
    
    # 验证：无任何记录被修改（事务回滚）
    for v in vendors:
        vendor = db.query(Vendor).filter_by(vendor_id=v).first()
        assert vendor.name != "test"  # 未被修改
```

### ATB-5: API 限流

| 测试编号 | 测试场景 | 物理测试期待 | 工具 |
|----------|----------|--------------|------|
| ATB-5.1 | 正常请求不触发限流 | 前 100 次请求正常响应 | pytest |
| ATB-5.2 | 超过限流阈值 | 第 101 次返回 HTTP 429 | pytest |
| ATB-5.3 | 限流响应包含 Retry-After | 响应 Header 包含 `Retry-After: 60` | pytest |

### ATB-6: 自动变异测试协同（Round 43/49）

| 测试编号 | 测试场景 | 物理测试期待 | 工具 |
|----------|----------|--------------|------|
| ATB-6.1 | 状态机变异测试 | mutation-testing 工具检测状态跃迁逻辑 | pytest + mutmut |
| ATB-6.2 | SQL 注入变异测试 | 所有输入点已参数化，无注入点存活 | pytest + SQLMap |
| ATB-6.3 | 边界条件变异测试 | 整数溢出、空指针等已防护 | pytest + hypothesis |

---

## 开发切入层级序列

### 层级 0: 数据模型层（优先）

```
src/models/
├── vendor.py          # Vendor 实体（含 version 乐观锁）
├── qualification.py   # Qualification 资质实体
└── risk_record.py     # RiskRecord 风险记录实体
```

**技术债修复重点**：
- Vendor 表增加 `version` 字段（乐观锁）
- Vendor 表增加 `status` 枚举约束

### 层级 1: Repository 层

```
src/repositories/
├── vendor_repository.py
└── qualification_repository.py
```

**技术债修复重点**：
- 批量操作增加事务管理
- 状态变更增加乐观锁检查

### 层级 2: Service 层

```
src/services/
├── vendor_service.py
│   ├── create_vendor()
│   ├── update_vendor()
│   ├── change_status()      # 状态机核心
│   ├── batch_update()
│   └── get_vendor()
└── qualification_service.py
    ├── create_qualification()
    ├── check_expiring()      # 资质过期预警
    └── validate_qualification()
```

**技术债修复重点**：
- 状态机增加并发控制
- 批量操作增加事务回滚

### 层级 3: API 层

```
src/api/routes/
├── vendor_routes.py
└── qualification_routes.py
```

**技术债修复重点**：
- 增加 Rate Limiting 中间件
- 增加幂等性校验

### 层级 4: 中间件与防护

```
src/middleware/
├── rate_limiter.py    # 限流实现
├── idempotency.py     # 幂等性实现
└── error_handler.py   # 统一异常处理
```

### 层级 5: 测试套件

```
tests/
├── unit/
│   ├── test_vendor_service.py
│   └── test_status_machine.py
├── integration/
│   ├── test_vendor_crud.py
│   └── test_batch_operations.py
└── mutation/
    └── test_round43_specific.py
```

### 开发顺序

1. **Day 1**：数据模型 + Repository（含技术债修复）
2. **Day 2**：Service 层（含状态机、批量事务）
3. **Day 3**：API 层 + 中间件（含限流、幂等）
4. **Day 4**：单元测试 + 集成测试
5. **Day 5**：变异测试验证 + ATB 全量执行 + plan.md 更新

---

## 强制落地指令

完成本次代码开发后，**必须**执行以下收尾工作：

1. 前往 `/docs/plan.md` 或 `/plan.md`
2. 定位到 **SWARM-005** 或 **Phase 2** 相关章节
3. 将本次 Iteration 1 的进度标记为 `[x]` 或补充进度说明
4. 示例格式：
   ```markdown
   ## Phase 2: 核心链路打通
   - [x] Iteration 1: 供应商CRUD + 状态机修复 + 批量事务加固 + 限流实现
     - 完成时间: YYYY-MM-DD
     - ATB 覆盖率: 100%
     - Critical/High 技术债: 已全部关闭
   ```

**禁止事项**：代码提交后未经 plan.md 更新即退出本次任务会话。