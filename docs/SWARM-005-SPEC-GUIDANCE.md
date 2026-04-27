# SWARM-005 规格指导文档

> **任务主题**: Squad Vendor 供应商闭环强攻  
> **迭代周期**: Iteration 1 (Round 43/49)  
> **创建日期**: 2024年  
> **状态**: 进行中

---

## 1. 需求与背景

### 1.1 业务背景

Squad Vendor 模块定位为供应商全生命周期闭环管理系统，核心目标是打通供应商从准入到退出的完整链路。

#### 1.1.1 供应商生命周期链路

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   准入      │───▶│   运营      │───▶│   变更      │───▶│   退出      │
│  (Onboard)  │    │ (Operation) │    │ (Change)    │    │ (Offboard)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 资质审核    │    │ 绩效评分    │    │ 信息变更    │    │ 淘汰/暂停   │
│ 信用评估    │    │ 风险监控    │    │ 状态跃迁    │    │ 黑名单      │
│ 合规准入    │    │ 合作管理    │    │ 审批流      │    │ 数据归档    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

#### 1.1.2 当前系统问题识别

根据 round 43/49 风险审计结果，系统存在以下高 Severity 问题：

| Severity | 问题ID | 问题描述 | 影响范围 |
|----------|--------|----------|----------|
| **Critical** | R43-001 | 供应商状态机跃迁存在竞态条件 | 并发场景下状态不一致 |
| **Critical** | R43-002 | 资质过期未自动预警 | 合规性漏洞 |
| **High** | R43-003 | 批量操作无事务回滚机制 | 数据一致性风险 |
| **High** | R43-004 | API 限流防护缺失 | DoS 攻击面 |

### 1.2 技术债现状分析

#### 1.2.1 AC-001 核心问题：[Graphify 知识图谱] No matching nodes found

**问题根因**：
当前系统在图谱节点查询时，由于 Graphify 知识图谱未正确接入或查询逻辑存在断层，导致资产与供应商关联查询返回空结果。

**问题链路**：
```
AssetDetailModal.tsx (L90) 
    └── mockGraphifySearch()
        └── 返回空数组 (L100-106)
            └── 触发条件: query.includes('non_existent') || query.includes('__NO_RESULT__')
```

**影响分析**：
- WorkflowDesigner 无法加载资产关联的供应商节点
- CustomNodes 无法渲染供应商关系图谱
- 供应商闭环链路在可视化层断裂

### 1.3 本次迭代目标

| 目标编号 | 目标描述 | 优先级 |
|----------|----------|--------|
| OBJ-001 | 修复 Graphify 知识图谱节点查询逻辑 | P0 |
| OBJ-002 | 打通供应商 CRUD 完整链路 | P0 |
| OBJ-003 | 修复状态机竞态条件 (R43-001) | P0 |
| OBJ-004 | 实现资质过期自动预警 (R43-002) | P1 |
| OBJ-005 | 批量操作增加事务回滚 (R43-003) | P1 |
| OBJ-006 | API 限流防护实现 (R43-004) | P1 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

| Phase | 描述 | 状态 | 本次迭代占比 |
|-------|------|------|--------------|
| Phase 1 | 基础设施搭建 | ✅ 已完成 | 0% |
| Phase 2 | 核心链路打通 | 🔄 本次主战场 | 80% |
| Phase 3 | 技术债修复 | 🔄 与 Phase 2 并行 | 20% |
| Phase 4 | 集成与验收 | ⏳ 后续迭代 | 0% |

### 2.2 Iteration 1 实施计划

#### 2.2.1 Sprint 规划 (5 days)

```
Day 1: 数据模型 + Repository 层（含技术债修复）
Day 2: Service 层（含状态机、批量事务）
Day 3: API 层 + 中间件（含限流、幂等）
Day 4: 前端集成 + Graphify 知识图谱对接
Day 5: 测试 + ATB 执行 + plan.md 更新
```

#### 2.2.2 关键技术修复点

**修复点 1: Graphify 知识图谱节点查询**
- 文件: `frontend/src/app/components/AssetDetailModal.tsx`
- 文件: `frontend/src/app/components/flow/CustomNodes.tsx`
- 目标: 实现真实的图谱节点查询，替代 mock 空结果

**修复点 2: 供应商状态机并发控制**
- 文件: `backend/src/main/java/com/ams/entity/Vendor.java`
- 文件: `backend/src/main/java/com/ams/service/VendorService.java`
- 目标: 增加乐观锁 (version 字段)

**修复点 3: 批量操作事务回滚**
- 文件: `backend/src/main/java/com/ams/service/VendorService.java`
- 目标: 使用 @Transactional 注解保证原子性

---

## 3. 边界约束

### 3.1 功能边界

| 约束类型 | 包含 | 排除 |
|----------|------|------|
| **范围边界** | vendor 实体、qualification 资质、risk_record 风险记录 | 财务结算、合同签署、第三方信用API |
| **数据边界** | 单次批量操作上限 100 条 | 超过 100 条需分批处理 |
| **状态边界** | pending → approved → active → suspended → terminated | 非定义状态跃迁拒绝 |

### 3.2 技术约束

| 约束类型 | 具体要求 |
|----------|----------|
| **事务策略** | 跨服务: Saga 模式；本服务内: ACID 事务 |
| **并发控制** | 状态变更采用乐观锁 (version)，重试上限 3 次 |
| **幂等性** | 所有写操作支持幂等，依赖 idempotency_key |
| **性能要求** | 单次查询 P99 < 200ms，批量操作 < 2s |

### 3.3 质量约束

| 约束类型 | 要求 |
|----------|------|
| **Critical/High 技术债** | 本次迭代必须 100% 关闭 |
| **变异测试覆盖率** | ≥ 85% |
| **回归测试通过率** | 100% |
| **文档要求** | 所有函数包含 docstring |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 供应商基础 CRUD

| 测试ID | 场景 | 期待结果 | 工具 |
|--------|------|----------|------|
| ATB-1.1 | 创建供应商成功 | HTTP 201, vendor_id 存在 | pytest |
| ATB-1.2 | 创建参数校验失败 | HTTP 422, 字段级错误 | pytest |
| ATB-1.3 | 查询供应商存在 | HTTP 200, 完整信息 | pytest |
| ATB-1.4 | 查询供应商不存在 | HTTP 404 | pytest |
| ATB-1.5 | 更新供应商信息 | HTTP 200, version+1 | pytest |
| ATB-1.6 | 删除供应商(软删除) | HTTP 204, is_deleted=True | pytest |

### 4.2 ATB-2: 供应商状态机

| 测试ID | 场景 | 期待结果 | 工具 |
|--------|------|----------|------|
| ATB-2.1 | 合法状态跃迁 | HTTP 200, version+1 | pytest |
| ATB-2.2 | 非法状态跃迁 | HTTP 400, invalid_transition | pytest |
| ATB-2.3 | 并发竞态修复验证 | 10并发→1成功+9冲突 | pytest+threading |
| ATB-2.4 | 状态变更事件发布 | EventBus 收到事件 | pytest+mock |

### 4.3 ATB-3: 资质管理

| 测试ID | 场景 | 期待结果 | 工具 |
|--------|------|----------|------|
| ATB-3.1 | 资质创建与关联 | HTTP 201, 正确关联 | pytest |
| ATB-3.2 | 资质过期自动预警 | 定时任务触发预警 | pytest+scheduler |
| ATB-3.3 | 资质过期阻断 | 过期资质无法交易 | pytest |

### 4.4 ATB-4: 批量操作事务

| 测试ID | 场景 | 期待结果 | 工具 |
|--------|------|----------|------|
| ATB-4.1 | 批量部分失败回滚 | 全部回滚，无修改 | pytest |
| ATB-4.2 | 批量全部成功 | HTTP 200, 全部更新 | pytest |
| ATB-4.3 | 批量超过上限 | HTTP 400, batch_size_exceeded | pytest |

### 4.5 ATB-5: API 限流

| 测试ID | 场景 | 期待结果 | 工具 |
|--------|------|----------|------|
| ATB-5.1 | 正常请求不触发 | 前100次正常 | pytest |
| ATB-5.2 | 超过阈值触发 | 第101次返回429 | pytest |
| ATB-5.3 | 限流响应格式 | Retry-After: 60 | pytest |

### 4.6 ATB-6: Graphify 知识图谱协同

| 测试ID | 场景 | 期待结果 | 工具 |
|--------|------|----------|------|
| ATB-6.1 | 资产关联节点查询 | 返回供应商节点 | jest |
| ATB-6.2 | 供应商节点渲染 | CustomNodes 正确显示 | playwright |
| ATB-6.3 | WorkflowDesigner 图谱 | 节点连线正确 | playwright |

### 4.7 关键测试断言

```python
# ATB-2.3 并发竞态测试
def test_concurrent_status_update():
    vendor_id = create_vendor()["vendor_id"]
    results = []
    
    def update_status():
        r = client.post(f"/api/v1/vendors/{vendor_id}/status", 
                       json={"status": "active"})
        results.append(r.status_code)
    
    threads = [threading.Thread(target=update_status) for _ in range(10)]
    for t in threads: t.start()
    for t in threads: t.join()
    
    # 严格断言：仅 1 成功，9 个 409 Conflict
    assert results.count(200) == 1
    assert results.count(409) == 9
```

```typescript
// ATB-6.1 Graphify 节点查询测试
describe('Graphify Integration', () => {
  it('should return vendor nodes for asset', async () => {
    const result = await graphifyService.search('asset-123');
    expect(result.nodes).toHaveLength.greaterThan(0);
    expect(result.nodes[0]).toMatchObject({
      type: 'vendor',
      label: expect.any(String)
    });
  });
});
```

---

## 5. 开发切入层级序列

### 5.1 层级 0: 数据模型层 (Day 1)

```
backend/src/main/java/com/ams/entity/
├── Vendor.java              # 供应商实体
│   ├── id: Long             # 主键
│   ├── vendorCode: String   # 供应商编码
│   ├── name: String         # 供应商名称
│   ├── status: VendorStatus # 状态枚举
│   ├── version: Long        # 乐观锁版本号 ⚠️ 新增
│   └── ...
├── Qualification.java      # 资质实体
└── RiskRecord.java          # 风险记录实体
```

**技术债修复**:
- Vendor 表增加 `version` 字段 (乐观锁)
- 增加状态枚举约束

### 5.2 层级 1: Repository 层 (Day 1)

```
backend/src/main/java/com/ams/mapper/
├── VendorMapper.java        # 供应商Mapper
└── QualificationMapper.java
```

**技术债修复**:
- 批量操作增加事务管理
- 状态变更增加乐观锁 WHERE 条件

### 5.3 层级 2: Service 层 (Day 2)

```
backend/src/main/java/com/ams/service/
├── VendorService.java       # 供应商服务
│   ├── createVendor()      # 创建
│   ├── updateVendor()      # 更新
│   ├── changeStatus()       # 状态变更 ⚠️ 竞态修复
│   ├── batchUpdate()       # 批量更新 ⚠️ 事务回滚
│   └── getVendor()          # 查询
└── QualificationService.java
    ├── createQualification()
    ├── checkExpiring()      # ⚠️ 资质过期预警
    └── validateQualification()
```

### 5.4 层级 3: API 层 (Day 3)

```
backend/src/main/java/com/ams/controller/
├── VendorController.java   # 供应商API
└── QualificationController.java

中间件:
├── RateLimiter.java         # ⚠️ 限流实现
├── IdempotencyFilter.java   # 幂等性
└── ExceptionHandler.java    # 统一异常
```

### 5.5 层级 4: 前端集成 (Day 4)

```
frontend/src/app/
├── components/
│   ├── flow/
│   │   └── CustomNodes.tsx  # ⚠️ Graphify 图谱节点
│   └── AssetDetailModal.tsx # ⚠️ Graphify 集成修复
├── pages/
│   └── WorkflowDesigner.tsx # ⚠️ 供应商可视化
└── services/
    └── inventoryService.ts  # 库存/供应商关联
```

### 5.6 层级 5: 测试套件 (Day 4-5)

```
tests/
├── unit/
│   ├── test_vendor_service.py
│   └── test_status_machine.py
├── integration/
│   ├── test_vendor_crud.py
│   └── test_batch_operations.py
└── mutation/
    └── test_round43_specific.py  # ⚠️ 变异测试
```

### 5.7 开发顺序依赖图

```
Day 1          Day 2          Day 3          Day 4          Day 5
  │              │              │              │              │
  ▼              ▼              ▼              ▼              ▼
┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│Entity  │──▶│Service │──▶│Controller│──▶│Frontend│──▶│Testing │
│+Mapper │   │+Repo   │   │+Middleware│ │+Graphify│  │+ATB    │
└────────┘   └────────┘   └────────┘   └────────┘   └────────┘
     │                                                    
     └─────────────────────────────────────────────────▶ plan.md 更新
```

---

## 6. 强制落地指令

### 6.1 代码开发后必须执行

完成代码开发后，**必须**执行以下收尾工作：

1. **定位计划文档**
   ```
   路径: /docs/plan.md 或 /plan.md
   ```

2. **更新进度标记**
   ```markdown
   ## SWARM-005: Squad Vendor 供应商闭环强攻
   
   ### Iteration 1 (Round 43/49)
   - [x] 完成时间: YYYY-MM-DD
   - [x] ATB 覆盖率: 100%
   - [x] Critical 技术债: R43-001, R43-002 已关闭
   - [x] High 技术债: R43-003, R43-004 已关闭
   - [x] AC-001 修复: Graphify 知识图谱节点查询已打通
   ```

3. **代码提交规范**
   ```bash
   git commit -m "[SWARM-005] feat: 供应商闭环链路打通 + 技术债修复
   
   - R43-001: 状态机乐观锁实现
   - R43-002: 资质过期预警机制
   - R43-003: 批量操作事务回滚
   - R43-004: API 限流防护
   - AC-001: Graphify 知识图谱集成"
   ```

### 6.2 禁止事项

| 禁止项 | 说明 |
|--------|------|
| ❌ | 代码提交后未经 plan.md 更新即退出任务 |
| ❌ | 未经测试验证即声称 AC 通过 |
| ❌ | 修改非 spec 指定的文件 |

### 6.3 验收确认清单

- [ ] 所有 Critical/High Severity 技术债已关闭
- [ ] ATB 测试用例 100% 通过
- [ ] 变异测试覆盖率 ≥ 85%
- [ ] 文档注释完整 (docstring)
- [ ] plan.md 已更新

---

## 7. 附录

### 7.1 状态机定义

```
PENDING ──────▶ APPROVED ──────▶ ACTIVE
   │                │                │
   │                │                ▼
   │                │           SUSPENDED
   │                │                │
   ▼                ▼                ▼
REJECTED       (锁死)          TERMINATED
```

### 7.2 变异测试结果追踪

| 测试轮次 | 日期 | 覆盖率 | 存活突变 | 状态 |
|----------|------|--------|----------|------|
| Round 42 | - | 78% | 12 | 已关闭 |
| **Round 43** | 本次 | **≥85%** | **≤5** | 进行中 |
| Round 44-49 | 后续 | 90% | 0 | 规划中 |

### 7.3 关键文件清单

| 优先级 | 文件路径 | 变更类型 | 说明 |
|--------|----------|----------|------|
| P0 | `frontend/src/app/components/AssetDetailModal.tsx` | 修改 | Graphify 集成修复 |
| P0 | `frontend/src/app/components/flow/CustomNodes.tsx` | 修改 | 图谱节点渲染 |
| P0 | `frontend/src/app/pages/WorkflowDesigner.tsx` | 修改 | 供应商可视化 |
| P0 | `endless_daemon.py` | 修改 | Graphify 核心服务 |
| P1 | `backend/src/main/java/com/ams/entity/Vendor.java` | 修改 | 乐观锁字段 |
| P1 | `backend/src/main/java/com/ams/service/VendorService.java` | 修改 | 事务+状态机 |
| P2 | `frontend/src/app/services/inventoryService.ts` | 修改 | 供应商关联 |

---

**文档版本**: v1.0  
**维护者**: SWARM-005 Team  
**下次审查**: Iteration 2 开始前