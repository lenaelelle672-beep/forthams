# [REBUILD-002] DeptController 重建规格文档

**迭代版本**: 3  
**文档状态**: Active  
**最后更新**: 2025-01-27

---

## 需求与背景

系统中原有的部门管理控制器（`DeptController`）存在架构耦合、接口语义不清、缺失树形结构查询等问题，无法满足当前组织架构管理的前端交互需求。本次任务要求从零重建 `DeptController`，以 `/depts` 为基础路径，提供列表查询、树形查询、新建、修改、删除五项标准 RESTful 端点，底层持久化层必须绑定 `SysDeptMapper`，不得引入其他 Mapper 依赖。

### 历史指导经验（Iteration 1-2 遗留）

| 迭代 | 教训 / 约束 |
|------|------------|
| Iter 1 | 树形构建逻辑应内聚于 Service 层而非 Controller，避免递归溢出 |
| Iter 2 | DELETE 操作须校验子部门与关联用户存在性，禁止级联盲删 |

---

## 当前 Phase 对应实施目标

**对准 Phase**: Phase 2 — Controller & Service Layer Rebuild（参照 plan.md）

本次 spec 精确对准 Phase 2 中「部门管理模块」子任务。Phase 2 的整体目标是：在 Mapper 层（Phase 1 已交付）已就绪的前提下，重建 Controller + Service 两层，使部门 CRUD 全链路可通。

**本次交付范围**:

```
DeptController (REST 端点定义 + 参数校验委托)
    └── DeptService (业务逻辑编排)
         └── SysDeptMapper (数据访问，已由 Phase 1 交付)
```

**不在本次范围内**:
- SysDeptMapper 本身的增删改查 SQL 实现（Phase 1 已完成）
- 前端页面 / 组件开发
- 权限注解 `@RequiresPermissions` 的具体权限码配置（仅预留注解位置）

---

## 边界约束

### 1. 技术栈硬约束

| 项目 | 约束值 |
|------|--------|
| 框架 | Spring Boot 2.7+ / Spring MVC |
| 持久层 | MyBatis / MyBatis-Plus |
| Mapper | 仅允许注入 `SysDeptMapper`，禁止注入其他 Mapper |
| 参数校验 | `javax.validation` / `spring-boot-starter-validation` |
| 返回体 | 统一使用 `R<T>` 或项目约定的通用响应包装类 |
| 日志 | SLF4J + Logback，关键操作记录 INFO 级别日志 |

### 2. 接口契约约束

#### GET /depts/list

```
描述: 获取部门平铺列表
入参: DeptQueryParam (可选筛选字段: deptName, status, parentId)
出参: R<List<DeptVO>>
排序: 按 orderNum ASC, createTime DESC
```

#### GET /depts/tree

```
描述: 获取部门树形结构
入参: 无必填参数，可选 DeptQueryParam 用于筛选后构建子树
出参: R<List<DeptTreeVO>>
树构建规则:
  - 顶层节点: parentId == 0 OR parentId IS NULL
  - 递归策略: Service 层一次查询全量，内存中组装树（禁止 N+1 查询）
  - 空子节点 children 字段返回空列表 []，不返回 null
```

#### POST /depts

```
描述: 新建部门
入参: @RequestBody @Validated DeptCreateParam
出参: R<Void>
前置校验:
  - deptName 在同一 parentId 下不可重复
  - parentId 对应的父部门必须存在（parentId > 0 时）
  - orderNum 若为空，默认取同级最大值 + 1
后置操作: 记录操作日志
```

#### PUT /depts/{id}

```
描述: 修改部门
入参: @PathVariable Long id, @RequestBody @Validated DeptUpdateParam
出参: R<Void>
前置校验:
  - id 对应部门必须存在
  - 不允许将自身设为自身的父部门（parentId != id）
  - 不允许将自身设为自身后代的子部门（防止环形引用）
  - deptName 在同一 parentId 下不可重复（排除自身）
后置操作: 记录操作日志
```

#### DELETE /depts/{id}

```
描述: 删除部门
入参: @PathVariable Long id
出参: R<Void>
前置校验:
  - id 对应部门必须存在
  - 该部门下不可存在子部门（查询 count WHERE parentId = id）
  - 该部门下不可存在关联用户（由 Service 调用 SysDeptMapper 内联查询或约定接口）
后置操作: 记录操作日志
```

### 3. 参数对象字段约束

**DeptQueryParam**:

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|----------|
| deptName | String | 否 | max=50 |
| status | Integer | 否 | 值域 [0, 1] |
| parentId | Long | 否 | min=0 |

**DeptCreateParam**:

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|----------|
| parentId | Long | 是 | min=0 |
| deptName | String | 是 | @NotBlank, max=50 |
| orderNum | Integer | 否 | min=0 |
| leader | String | 否 | max=50 |
| phone | String | 否 | 正则: `^$|^[0-9]{7,15}$` |
| email | String | 否 | @Email |
| status | Integer | 是 | 值域 [0, 1] |

**DeptUpdateParam** (继承 CreateParam 并追加):

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|----------|
| (所有 CreateParam 字段) | — | — | — |
| id | Long | 是（通过 @PathVariable） | min=1 |

### 4. 领域规则硬约束

```
[CONSTRAINT-001] 部门名称同级唯一性: 同一 parentId 下 deptName 不重复
[CONSTRAINT-002] 树形完整性: 禁止产生孤儿节点（parentId 指向不存在的记录）
[CONSTRAINT-003] 环形防护: 修改 parentId 时必须检测祖先链，禁止形成环
[CONSTRAINT-004] 删除安全性: 存在子部门或关联用户时拒绝删除并返回明确错误信息
[CONSTRAINT-005] Mapper 单一性: Service 层仅注入 SysDeptMapper，关联用户查询通过 SysDeptMapper 中声明的关联查询方法实现
```

### 5. 异常响应约定

| 场景 | HTTP Status | errorCode | errorMessage 模板 |
|------|-------------|-----------|-------------------|
| 部门不存在 | 200 | 404001 | "部门[{id}]不存在" |
| 同级名称重复 | 200 | 409001 | "同级下已存在名称为[{deptName}]的部门" |
| 存在子部门禁止删除 | 200 | 409002 | "该部门下存在[{count}]个子部门，不可删除" |
| 存在关联用户禁止删除 | 200 | 409003 | "该部门下存在[{count}]个用户，不可删除" |
| 父部门不存在 | 200 | 404002 | "父部门[{parentId}]不存在" |
| 环形引用 | 200 | 409004 | "不允许将部门[{id}]设置为自身或其后代的子部门" |
| 参数校验失败 | 200 | 400001 | 由 Validation 框架自动生成 |

> 注：所有业务异常统一通过 `R.fail(errorCode, message)` 返回 HTTP 200，前端根据 code 判断。框架级异常（404、500 等）由全局异常处理器兜底。

---

## 验收测试基准 (ATB)

### 测试框架选型

- **单元测试**: JUnit 5 + Mockito（Service 层）
- **集成测试**: Spring Boot Test + `@AutoConfigureMockMvc`（Controller 层全链路）
- **物理执行命令**: `mvn test -pl <module> -Dtest="DeptController*Test"`

---

### ATB-001: GET /depts/list — 平铺列表查询

```
[Precondition]  数据库中预插入 3 条部门记录:
                 Dept(id=1, parentId=0, deptName="总部", orderNum=1, status=0)
                 Dept(id=2, parentId=1, deptName="研发部", orderNum=1, status=0)
                 Dept(id=3, parentId=1, deptName="市场部", orderNum=2, status=1)

[Step 1] GET /depts/list (无参数)
[Expect 1] HTTP 200, code=200, data.size == 3
           排序验证: data[0].orderNum <= data[1].orderNum

[Step 2] GET /depts/list?deptName=研发
[Expect 2] HTTP 200, code=200, data.size == 1, data[0].deptName == "研发部"

[Step 3] GET /depts/list?status=0
[Expect 3] HTTP 200, code=200, data.size == 2 (总部 + 研发部)

[Step 4] GET /depts/list?parentId=1
[Expect 4] HTTP 200, code=200, data.size == 2 (研发部 + 市场部)
```

### ATB-002: GET /depts/tree — 树形结构查询

```
[Precondition]  同 ATB-001 数据

[Step 1] GET /depts/tree
[Expect 1] HTTP 200, code=200, data.size == 1 (顶层只有"总部")
           data[0].deptName == "总部"
           data[0].children.size == 2
           data[0].children[0].deptName == "研发部"
           data[0].children[0].children == [] (空列表非null)
           data[0].children[1].deptName == "市场部"

[Step 2] 验证空数据库场景
[Expect 2] 插入前查询: data.size == 0, data == [] (非null)
```

### ATB-003: POST /depts — 新建部门

```
[Precondition]  数据库中存在 Dept(id=1, parentId=0, deptName="总部")

[Step 1] POST /depts, body={"parentId":1, "deptName":"测试部", "status":0}
[Expect 1] HTTP 200, code=200
           数据库验证: 新记录存在且 deptName=="测试部", parentId==1
           日志验证: INFO 级别日志包含 "新建部门" 关键词

[Step 2] POST /depts, body={"parentId":1, "deptName":"测试部", "status":0} (重复)
[Expect 2] HTTP 200, code=409001
           errorMessage 包含 "同级下已存在"

[Step 3] POST /depts, body={"parentId":999, "deptName":"孤儿部", "status":0}
[Expect 3] HTTP 200, code=404002
           errorMessage 包含 "父部门[999]不存在"

[Step 4] POST /depts, body={"parentId":1, "deptName":"", "status":0}
[Expect 4] HTTP 200, code=400001 (参数校验失败)

[Step 5] POST /depts, body={"parentId":1, "deptName":"默认排序部", "status":0} (不传 orderNum)
[Expect 5] 新记录的 orderNum 应为同级最大值 + 1（即本例中为 1，因同级无其他部门）
```

### ATB-004: PUT /depts/{id} — 修改部门

```
[Precondition]
  Dept(id=1, parentId=0, deptName="总部")
  Dept(id=2, parentId=1, deptName="研发部")
  Dept(id=3, parentId=1, deptName="市场部")

[Step 1] PUT /depts/2, body={"parentId":1, "deptName":"研发中心", "status":0}
[Expect 1] HTTP 200, code=200
           数据库验证: deptName 已更新为 "研发中心"

[Step 2] PUT /depts/999, body={"parentId":1, "deptName":"不存在部", "status":0}
[Expect 2] HTTP 200, code=404001

[Step 3] PUT /depts/2, body={"parentId":1, "deptName":"市场部", "status":0} (名称冲突)
[Expect 3] HTTP 200, code=409001 (同级下名称重复，排除自身)

[Step 4] PUT /depts/1, body={"parentId":2, "deptName":"总部", "status":0} (环形: 总部→研发部的子部门)
[Expect 4] HTTP 200, code=409004 (环形引用拒绝)

[Step 5] PUT /depts/1, body={"parentId":1, "deptName":"总部", "status":0} (自身设为自身的子部门)
[Expect 5] HTTP 200, code=409004
```

### ATB-005: DELETE /depts/{id} — 删除部门

```
[Precondition]
  Dept(id=1, parentId=0, deptName="总部")
  Dept(id=2, parentId=1, deptName="研发部")

[Step 1] DELETE /depts/2 (无子部门、无关联用户)
[Expect 1] HTTP 200, code=200
           数据库验证: id=2 的记录已不存在

[Step 2] DELETE /depts/999
[Expect 2] HTTP 200, code=404001

[Step 3] DELETE /depts/1 (存在子部门 id=2)
[Expect 3] HTTP 200, code=409002
           errorMessage 包含子部门数量

[Step 4] DELETE /depts/2, 前置: sys_user 表中存在 dept_id=2 的用户记录
[Expect 4] HTTP 200, code=409003
           errorMessage 包含关联用户数量
```

### ATB-006: SysDeptMapper 单一注入验证

```
[Step 1] 通过反射或代码审查验证 DeptServiceImpl 的注入字段
[Expect 1] DeptServiceImpl 中仅存在一个 Mapper 类型字段: SysDeptMapper
           不存在 SysUserMapper、SysUserRoleMapper 等其他 Mapper 注入
```

### ATB-007: 接口路由完整性验证

```
[Step 1] GET  /depts/list      → HTTP 200
[Step 2] GET  /depts/tree      → HTTP 200
[Step 3] POST /depts           → HTTP 200 (正常参数)
[Step 4] PUT  /depts/1         → HTTP 200 (正常参数)
[Step 5] DELETE /depts/1       → HTTP 200
[Expect] 上述 5 个路由均可到达对应 Controller 方法，无 404
```

---

## 开发切入层级序列

```
开发顺序严格自底向上，每步产出对应一个可编译提交:

Phase 2.1 [DTO 层] — 参数对象与视图对象
  │
  ├── [1] DeptQueryParam.java        — 列表/树形查询入参
  ├── [2] DeptCreateParam.java       — 新建入参（含 validation 注解）
  ├── [3] DeptUpdateParam.java       — 修改入参（继承或组合 CreateParam）
  ├── [4] DeptVO.java                — 列表展示视图对象
  ├── [5] DeptTreeVO.java            — 树形节点视图对象（含 List<DeptTreeVO> children）
  │
Phase 2.2 [Mapper 验证层] — 确认 SysDeptMapper 方法签名
  │
  ├── [6] SysDeptMapper 方法清单确认:
  │       - selectDeptList(DeptQueryParam): List<SysDept>
  │       - selectDeptList(): List<SysDept> (全量，供树构建)
  │       - selectDeptById(Long): SysDept
  │       - insertDept(SysDept): int
  │       - updateDept(SysDept): int
  │       - deleteDeptById(Long): int
  │       - countChildDept(Long parentId): int
  │       - countUserInDept(Long deptId): int
  │       - checkDeptNameUnique(String deptName, Long parentId, Long excludeId): int
  │
Phase 2.3 [Service 层] — 核心业务逻辑
  │
  ├── [7] DeptService.java           — 接口定义（5 个方法）
  ├── [8] DeptServiceImpl.java       — 实现:
  │       ├── listDepts(DeptQueryParam)      → 调 mapper.selectDeptList
  │       ├── listDeptTree(DeptQueryParam)   → 调 listDepts → 内存构建树
  │       ├── createDept(DeptCreateParam)    → 校验 → 转换 → insert
  │       ├── updateDept(Long id, DeptUpdateParam) → 存在性 → 环形 → 唯一 → update
  │       └── deleteDept(Long id)            → 存在性 → 子部门 → 关联用户 → delete
  │
  │   关键私有方法:
  │       ├── buildDeptTree(List<SysDept>)   — 一次性查询全量，Map<parentId, List> 分组组装
  │       ├── checkDeptNameUnique(...)       — 同级名称唯一性
  │       └── checkCircularReference(Long id, Long newParentId) — 递归查祖先链
  │
Phase 2.4 [Controller 层] — REST 端点暴露
  │
  ├── [9] DeptController.java
          @RestController
          @RequestMapping("/depts")
          ├── @GetMapping("/list")    → listDepts
          ├── @GetMapping("/tree")    → listDeptTree
          ├── @PostMapping            → createDept
          ├── @PutMapping("/{id}")    → updateDept
          └── @DeleteMapping("/{id}") → deleteDept
  │
Phase 2.5 [测试层] — 按 ATB 编写集成测试
  │
  ├── [10] DeptControllerListTest.java     — ATB-001
  ├── [11] DeptControllerTreeTest.java     — ATB-002
  ├── [12] DeptControllerCreateTest.java   — ATB-003
  ├── [13] DeptControllerUpdateTest.java   — ATB-004
  ├── [14] DeptControllerDeleteTest.java   — ATB-005
  └── [15] DeptControllerRouteTest.java    — ATB-007

Phase 2.6 [验收门禁]
  │
  └── [16] 执行全量测试: mvn test -Dtest="DeptController*Test"
           全部通过 → 可交付合并
```

---

## 附录: 树构建算法参考实现

```java
/**
 * 内存树构建 — O(n) 时间复杂度
 * 禁止使用递归查库（N+1 问题）
 */
private List<DeptTreeVO> buildDeptTree(List<SysDept> allDepts) {
    // 按 parentId 分组
    Map<Long, List<DeptTreeVO>> grouped = allDepts.stream()
        .map(DeptConvertor::toTreeVO)
        .collect(Collectors.groupingBy(DeptTreeVO::getParentId));

    // 为每个节点填充 children
    grouped.values().forEach(list ->
        list.forEach(node ->
            node.setChildren(
                grouped.getOrDefault(node.getId(), Collections.emptyList())
            )
        )
    );

    // 返回顶层 (parentId == 0)
    return grouped.getOrDefault(0L, Collections.emptyList());
}
```

---

*文档结束 — 本 spec 为唯一实施依据，任何偏离须以变更单形式记录并经评审确认。*