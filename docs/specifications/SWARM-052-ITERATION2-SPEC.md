# SWARM-052 前端集成-审批流程页面开发
## 规格指导文档 - Iteration 2

**任务编号**: SWARM-052  
**任务名称**: 前端集成-审批流程页面开发  
**迭代版本**: Iteration 2  
**核心交付物**: 完成审批流程前端集成，实现ApprovalService双向绑定，搭建审批状态流转UI组件与用户交互界面  
**本次聚焦文件**: `backend/src/main/java/com/ams/service/AuditService.java`

---

## 1. 需求与背景

### 1.1 任务概述

SWARM-052 旨在完成审批流程的前端集成工作，实现ApprovalService的双向绑定机制，并搭建审批状态流转的UI组件与用户交互界面。本次Iteration 2聚焦于修复已知问题并完善后端AuditService服务层实现。

### 1.2 业务上下文

审批流程模块作为资产管理系统(AMS)的核心业务链路，承担以下职责：
- **审计追溯**：记录所有资产变更的历史轨迹
- **变更追踪**：追踪字段级别的变更内容
- **知识图谱整合**：将审计数据转换为Graphify可视化的节点数据
- **双向同步**：确保前后端审计状态实时一致

### 1.3 技术栈基线

| 组件 | 技术选型 | 版本 |
|------|----------|------|
| 后端框架 | Spring Boot | 2.7.x |
| ORM框架 | MyBatis-Plus | 3.5.x |
| 数据库 | MySQL | 8.0.x |
| 单元测试 | JUnit 5 | 5.9.x |
| Mock框架 | Mockito | 4.8.x |

---

## 2. 当前Phase对应实施目标

### 2.1 Phase分解（基于plan.md）

| Phase | 名称 | 描述 | 状态 |
|-------|------|------|------|
| Phase 1 | 审计基础设施层 | 审计日志表结构、实体定义 | 已完成 |
| Phase 2 | AuditService服务实现 | **本次迭代核心** | 进行中 |
| Phase 3 | 前端Graphify集成 | 知识图谱组件对接 | 待后续 |
| Phase 4 | 双向绑定验证 | ApprovalService与前端状态同步 | 待后续 |

### 2.2 Iteration 2 核心目标

**Primary Goal**: 修复AuditService中的导入问题，完善审计日志查询与Graphify节点生成功能。

#### 2.2.1 功能性目标

| 目标ID | 描述 | 验收标准 |
|--------|------|----------|
| G-01 | 修复AuditService ImportError | 所有import语句正确，模块可正常加载 |
| G-02 | 实现审计日志分页查询 | 支持分页、排序、筛选条件 |
| G-03 | 实现Graphify节点生成 | `toGraphifyNodes()`方法正确返回节点数据 |
| G-04 | 完善变更记录关联 | 审计日志正确关联资产与用户信息 |

#### 2.2.2 非功能性目标

| 目标ID | 描述 | 阈值 |
|--------|------|------|
| NF-01 | 查询响应时间 | 单条审计日志查询 ≤ 100ms |
| NF-02 | 列表查询性能 | 100条数据分页查询 ≤ 500ms |
| NF-03 | 代码覆盖率 | 核心方法单元测试覆盖率 ≥ 80% |

---

## 3. 边界约束

### 3.1 职责边界

```
┌─────────────────────────────────────────────────────────────┐
│                      AuditService 边界                       │
├─────────────────────────────────────────────────────────────┤
│  ✓ 审计日志的CRUD操作                                        │
│  ✓ 审计日志查询与分页                                        │
│  ✓ Graphify节点数据转换                                      │
│  ✓ 变更字段格式化                                            │
│  ✓ 审计日志与资产/用户的关联查询                               │
├─────────────────────────────────────────────────────────────┤
│  ✗ 业务审批流程逻辑（ApprovalService负责）                    │
│  ✗ 前端UI组件渲染                                            │
│  ✗ WebSocket实时推送                                         │
│  ✗ 数据库表结构变更                                           │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 技术约束

| 约束ID | 类型 | 描述 |
|--------|------|------|
| C-01 | 禁止循环依赖 | AuditService不得直接或间接依赖自身 |
| C-02 | 事务边界 | 查询方法不加@Transactional，变更操作需标注 |
| C-03 | 异常处理 | 统一抛出`BusinessException`，禁止吞掉异常 |
| C-04 | 空值处理 | 禁止返回null列表，应返回空集合 |

### 3.3 数据边界

```java
// AuditService涉及的核心数据实体边界
AuditLog {
    Long id;                    // 审计日志ID
    String entityType;          // 实体类型(Asset/Approval等)
    String entityId;           // 实体ID
    String operation;           // 操作类型(CREATE/UPDATE/DELETE)
    Long userId;               // 操作人ID
    String userName;           // 操作人姓名
    Long timestamp;            // 操作时间戳
    Map<String, FieldChange> changes;  // 字段变更明细
}

GraphifyNode {
    String id;                 // 节点唯一标识
    String type;               // 节点类型
    String label;              // 节点标签
    Double x;                  // X坐标
    Double y;                  // Y坐标
    Map<String, Object> properties;  // 节点属性
}
```

---

## 4. 验收测试基准(ATB)

### 4.1 单元测试验收

**测试文件**: `backend/src/test/java/com/ams/service/AuditServiceTest.java`

#### 4.1.1 导入与加载测试

| Test ID | 描述 | 输入 | 预期输出 | 验证方式 |
|---------|------|------|----------|----------|
| UT-01 | 模块正常加载 | ApplicationContext启动 | AuditService Bean存在 | `@SpringBootTest` + `assertNotNull` |
| UT-02 | 依赖注入验证 | 构造器注入检查 | 所有依赖非空 | Mockito验证 |

#### 4.1.2 审计日志查询测试

| Test ID | 描述 | 输入 | 预期输出 | 验证方式 |
|---------|------|------|----------|----------|
| UT-03 | 分页查询审计日志 | `Pageable.of(0, 10)` | 返回10条记录，总数正确 | `assertEquals(10, result.getSize())` |
| UT-04 | 按实体类型筛选 | `entityType="Asset"` | 仅返回Asset相关日志 | `assertTrue(allMatch(e -> e.getEntityType().equals("Asset")))` |
| UT-05 | 按时间范围筛选 | 开始/结束时间 | 返回范围内的日志 | 时间戳比对 |
| UT-06 | 组合条件查询 | 实体+时间+操作人 | 返回满足所有条件的日志 | 多条件断言 |

#### 4.1.3 Graphify节点生成测试

| Test ID | 描述 | 输入 | 预期输出 | 验证方式 |
|---------|------|------|----------|----------|
| UT-07 | 空日志列表转换 | `List<AuditLog> emptyList` | 返回空节点数组 | `assertTrue(nodes.isEmpty())` |
| UT-08 | 单条日志转换 | 有效AuditLog | 返回包含1个节点的数组 | `assertEquals(1, nodes.size())` |
| UT-09 | 节点属性完整性 | AuditLog | 节点包含id/type/label/properties | 属性逐个断言 |
| UT-10 | 节点坐标计算 | 多条AuditLog | 节点均匀分布 | 距离计算验证 |

#### 4.1.4 变更记录处理测试

| Test ID | 描述 | 输入 | 预期输出 | 验证方式 |
|---------|------|------|----------|----------|
| UT-11 | 字段变更格式化 | `FieldChange(old="A", new="B")` | 返回可读字符串 | 字符串断言 |
| UT-12 | 敏感字段脱敏 | 密码/手机号等字段 | 脱敏后的值 | 正则匹配验证 |
| UT-13 | 变更差异计算 | 完整变更对象 | 返回差异摘要 | 内容比对 |

### 4.2 集成测试验收

**测试文件**: `backend/src/test/java/com/ams/controller/AuditControllerTest.java`

| Test ID | 描述 | 操作 | 预期结果 | 验证方式 |
|---------|------|------|----------|----------|
| IT-01 | 审计日志列表接口 | GET /api/audit/logs | 返回200+分页数据 | `status().isOk()` |
| IT-02 | 审计详情接口 | GET /api/audit/logs/{id} | 返回完整审计详情 | JSON路径断言 |
| IT-03 | Graphify节点接口 | GET /api/audit/graphify | 返回节点数组 | 响应结构验证 |
| IT-04 | 参数校验失败 | 传入非法分页参数 | 返回400错误 | 错误码断言 |

### 4.3 质量门禁

| 指标 | 要求 | 验证方式 |
|------|------|----------|
| 编译通过 | 无编译错误 | Maven compile |
| 单元测试通过率 | ≥ 90% | Maven test |
| 代码覆盖率 | ≥ 70% | JaCoCo报告 |
| 静态分析 | 无警告 | SonarQube |

---

## 5. 开发切入层级序列

### 5.1 依赖关系图

```
Layer 0: Spring Boot基础设施
    ↓ 依赖: Spring Context
Layer 1: 数据访问层
    ↓ 依赖: MyBatis-Plus, AuditLogRepository
Layer 2: 实体与DTO层
    ↓ 依赖: MyBatis-Plus实体
Layer 3: Service业务层 ← AUDITSERVICE
    ↓ 依赖: Layer 1, Layer 2
Layer 4: Controller接口层
    ↓ 依赖: Layer 3
Layer 5: 测试验证层
    ↓ 依赖: Layer 0-4
```

### 5.2 编码切入顺序

#### Phase 1: 环境与依赖检查 (0.5d)

| 序号 | 任务 | 交付物 | 前置依赖 |
|------|------|--------|----------|
| 1.1 | 验证项目编译 | `mvn clean compile` | 无 |
| 1.2 | 检查import语句 | `AuditService.java` | 无 |
| 1.3 | 验证依赖注入配置 | Spring Bean配置 | 1.1 |

#### Phase 2: AuditService核心实现 (2d)

| 序号 | 任务 | 交付物 | 前置依赖 |
|------|------|--------|----------|
| 2.1 | 完善审计日志查询方法 | `getAuditLogs(Pageable)` | 1.1 |
| 2.2 | 实现条件筛选查询 | `getAuditLogs(entityType, startTime, endTime)` | 2.1 |
| 2.3 | 实现单条日志查询 | `getAuditLogById(Long id)` | 2.1 |
| 2.4 | 实现Graphify节点生成 | `toGraphifyNodes(List<AuditLog>)` | 2.3 |
| 2.5 | 实现变更记录格式化 | `formatChanges(Map<String, FieldChange>)` | 2.4 |
| 2.6 | 添加docstring注释 | 所有public方法 | 2.1-2.5 |

#### Phase 3: 单元测试编写 (1.5d)

| 序号 | 任务 | 交付物 | 前置依赖 |
|------|------|--------|----------|
| 3.1 | 编写查询方法测试 | `AuditServiceTest.java` | 2.1-2.3 |
| 3.2 | 编写Graphify转换测试 | `AuditServiceTest.java` | 2.4 |
| 3.3 | 编写边界条件测试 | 异常/空值场景 | 2.1-2.5 |
| 3.4 | 执行测试并修复失败用例 | 测试报告 | 3.1-3.3 |

#### Phase 4: 集成验证 (0.5d)

| 序号 | 任务 | 交付物 | 前置依赖 |
|------|------|--------|----------|
| 4.1 | 对接Controller接口 | `AuditController.java` | 2.1-2.5 |
| 4.2 | 执行API集成测试 | Postman/自动测试 | 4.1 |
| 4.3 | 修复集成问题 | 测试报告 | 4.2 |

### 5.3 代码路径规范

```
backend/src/main/java/com/ams/
├── service/
│   └── AuditService.java              ← 本次核心修改文件
├── service/impl/
│   └── AuditServiceImpl.java           ← 实现类
├── repository/
│   └── AuditLogRepository.java         ← 数据访问层
├── entity/
│   └── AuditLog.java                  ← 审计日志实体
├── dto/
│   ├── AuditLogDTO.java                ← 审计日志DTO
│   └── GraphifyNodeDTO.java            ← Graphify节点DTO
├── controller/
│   └── AuditController.java            ← 审计控制器
└── enums/
    └── AuditOperation.java            ← 操作类型枚举
```

### 5.4 关键方法签名约束

```java
// AuditService.java - 必须实现的方法
public interface AuditService {
    
    /**
     * 分页查询审计日志
     * @param pageable 分页参数
     * @return 审计日志分页结果
     */
    Page<AuditLog> getAuditLogs(Pageable pageable);
    
    /**
     * 条件查询审计日志
     * @param entityType 实体类型
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 审计日志列表
     */
    Page<AuditLog> getAuditLogs(String entityType, Long startTime, Long endTime, Pageable pageable);
    
    /**
     * 根据ID获取审计日志详情
     * @param id 审计日志ID
     * @return 审计日志详情
     */
    AuditLog getAuditLogById(Long id);
    
    /**
     * 将审计日志列表转换为Graphify节点
     * @param auditLogs 审计日志列表
     * @return Graphify节点列表
     */
    List<GraphifyNode> toGraphifyNodes(List<AuditLog> auditLogs);
    
    /**
     * 格式化变更记录为可读字符串
     * @param changes 变更记录Map
     * @return 格式化的变更描述
     */
    String formatChanges(Map<String, FieldChange> changes);
}
```

---

## 6. AC验证矩阵

| AC ID | 描述 | 验证方法 | 通过标准 |
|-------|------|----------|----------|
| AC-001 | Graphify知识图谱集成验证 | 集成测试 | `toGraphifyNodes()`返回正确格式的节点数据 |
| AC-002 | 代码无语法错误 | AST静态分析 | 编译通过，无语法错误 |
| AC-003 | 函数包含docstring | 静态分析 | 10个修改函数全部包含文档注释 |
| AC-004 | 模块可正常导入 | pytest单元测试 | ImportError修复，模块加载正常 |

### 6.1 已知问题修复清单

| 问题ID | 描述 | 影响AC | 修复方案 |
|--------|------|--------|----------|
| P-001 | ImportError导致模块无法加载 | AC-004 | 检查并修正import语句 |
| P-002 | 10个函数缺少docstring | AC-003 | 补充完整文档注释 |
| P-003 | Graphify节点数据格式不匹配 | AC-001 | 修正节点属性结构 |

---

## 7. 附录

### 7.1 Graphify节点数据结构

```typescript
interface GraphifyNode {
  id: string;              // 格式: "audit-{logId}"
  type: string;           // 实体类型: "ASSET" | "APPROVAL" | "USER"
  label: string;          // 节点显示名称
  entityId: string;      // 关联实体ID
  x: number;              // 画布X坐标
  y: number;              // 画布Y坐标
  properties: {
    [key: string]: any;   // 扩展属性
  };
}
```

### 7.2 参考文档

| 文档 | 路径 |
|------|------|
| 后端接口设计 | `docs/api/audit-api-spec.md` |
| 前端Graphify组件 | `frontend/src/components/audit/GraphifyKnowledgeGraph.tsx` |
| 数据字典 | `docs/data-dictionary/audit-log-fields.md` |

---

**文档版本**: v2.0  
**编制日期**: 2024  
**适用迭代**: SWARM-052 Iteration 2  
**状态**: 草稿待评审
**聚焦文件**: `backend/src/main/java/com/ams/service/AuditService.java`