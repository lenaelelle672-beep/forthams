# spec.md

## 需求与背景
重建部门管理模块的核心 API 控制器 `DeptController`。基于 RESTful 规范重构对外暴露的 HTTP 端点，提供部门的平铺列表查询、树形结构查询、新增、更新以及删除功能。底层数据访问需严格绑定并使用 `SysDeptMapper` 执行 SQL 交互。

## 当前 Phase 对应实施目标
对准计划中的 **Phase 2: API Controller 层路由重建与基础 CRUD 实现**。
目标为完成 `DeptController` 类的创建，配置类级别的 `@RequestMapping("/depts")` 路由前缀，并严格实现 `GET /list`, `GET /tree`, `POST`, `PUT /{id}`, `DELETE /{id}` 五个核心端点，确保请求参数能与 `SysDeptMapper` 正确映射流转。

## 边界约束
1. **路由前缀约束**：Controller 类必须且只能使用 `@RequestMapping("/depts")` 作为基础路径。
2. **HTTP 动词约束**：
   - 列表查询：`GET /list`
   - 树形查询：`GET /tree`
   - 新增操作：`POST` 
   - 更新操作：`PUT /{id}`（`id` 必须作为路径参数）
   - 删除操作：`DELETE /{id}`（`id` 必须作为路径参数）
3. **依赖约束**：数据访问层仅允许通过注入 `SysDeptMapper` 进行交互，严禁混用其他 Mapper 或硬编码数据。
4. **数据转换约束**：`GET /tree` 端点返回的数据结构必须是具备层级嵌套关系的 JSON（如 `children` 字段），不可返回平铺结构。

## 验收测试基准 (ATB) - **必须说明每一步功能对应的物理测试期待(如pytest或playwright)**
以下测试基准需通过 `pytest` 结合 `requests` 库（或同等级别的 HTTP 驱动测试框架）对被测服务发起物理级请求验证：

1. **ATB-01 (GET /depts/list 平铺查询)**:
   - **测试动作**：向 `http://{host}:{port}/depts/list` 发起 HTTP GET 请求。
   - **期待结果**：HTTP 状态码为 `200 OK`。响应体 JSON 解析成功，且结构为 `Array`，数组内包含数据库中现存的平铺部门对象，无 `children` 层级嵌套结构。
2. **ATB-02 (GET /depts/tree 树形查询)**:
   - **测试动作**：向 `http://{host}:{port}/depts/tree` 发起 HTTP GET 请求。
   - **期待结果**：HTTP 状态码为 `200 OK`。响应体 JSON 解析成功，顶层为根节点数组，各节点包含正确的 `children` 属性及子节点列表，父子级关系与数据库 `parent_id` 映射完全一致。
3. **ATB-03 (POST /depts 新增部门)**:
   - **测试动作**：向 `http://{host}:{port}/depts` 发起 HTTP POST 请求，携带合法的 JSON 格式部门数据负载（如 `{"name": "test_dept"}`）。
   - **期待结果**：HTTP 状态码为 `200`（或 `201 Created`）。断言执行后查询数据库相关表，成功新增一条对应记录。
4. **ATB-04 (PUT /depts/{id} 更新部门)**:
   - **测试动作**：选取已存在的合法部门 ID（假设为 1），向 `http://{host}:{port}/depts/1` 发起 HTTP PUT 请求，携带包含更新信息的 JSON 负载。
   - **期待结果**：HTTP 状态码为 `200 OK`。断言数据库中 ID 为 1 的记录对应字段已变更为请求中的最新值。
5. **ATB-05 (DELETE /depts/{id} 删除部门)**:
   - **测试动作**：选取待删除的部门 ID（假设为 2），向 `http://{host}:{port}/depts/2` 发起 HTTP DELETE 请求。
   - **期待结果**：HTTP 状态码为 `200 OK`。断言数据库中 ID 为 2 的记录已被成功移除（或逻辑删除字段已生效）。

## 开发切入层级序列
1. **Mapper 层审查**：确认 `SysDeptMapper` 具备基础的 CRUD 方法（如 `selectAll`, `insert`, `updateById`, `deleteById`），确保基建可用。
2. **骨架建立**：创建 `DeptController` 类，添加类注解 `@RestController` 与 `@RequestMapping("/depts")`，并注入 `SysDeptMapper` 依赖。
3. **基础读取实现**：开发 `GET /list` 接口，直接调用 Mapper 获取并返回全部实体列表。
4. **高阶读取实现**：开发 `GET /tree` 接口，获取平铺列表后，编写树形结构组装逻辑（或使用 Hutool/自定义递归方法）生成并返回树状结构。
5. **写入操作实现**：开发 `POST` 接口，使用 `@RequestBody` 接收参数，调用 Mapper 的插入方法。
6. **变更操作实现**：开发 `PUT /{id}` 接口，结合 `@PathVariable` 获取 ID 与 `@RequestBody` 获取更新负载，调用 Mapper 的更新方法。
7. **删除操作实现**：开发 `DELETE /{id}` 接口，接收路径变量 ID，调用 Mapper 的删除方法完成闭环。