# forthAMS 对接 RuoYi RBAC 业务设计详细方案

## 1. 结论

最佳路线不是“接入 RuoYi 项目”或“替换 forthAMS 技术栈”，而是：**参考 RuoYi 成熟的 RBAC 业务模型，用 forthAMS 当前技术栈重写实现**。

最终选型：

| 维度 | 决策 |
| --- | --- |
| 认证 | 保留 Spring Security 6 + JWT |
| 授权 | RuoYi `perms` 翻译为 Spring Security `GrantedAuthority` |
| 权限注解 | Shiro `@RequiresPermissions` 翻译为 `@PreAuthorize("@ss.hasPermi('xxx')")` |
| 菜单模型 | 参考 RuoYi `M目录 / C菜单 / F按钮` |
| 权限来源 | 以 `sys_menu.perms` 作为主权限源，`sys_permission` 暂保留兼容 |
| 数据权限 | 参考 RuoYi 五级模型，但实现为 MyBatis-Plus `DataPermissionInterceptor` |
| 前端路由 | 第一期用“后端授权菜单 + 前端 route map”，不做完全动态路由 |
| 不引入 | Shiro、Sa-Token、Session、Thymeleaf、PageHelper、`del_flag`、RuoYi 主键命名 |

## 2. 蜂群共识

### 2.1 可以直接借鉴 RuoYi 的设计

| RuoYi 能力 | 集成方式 |
| --- | --- |
| `sys_menu` 菜单权限树 | 新增 `sys_menu`，保留 forthAMS `id/sort_order/deleted` 命名 |
| `sys_role_menu` | 新增角色菜单关联表，角色授权包含页面和按钮 |
| `sys_role.data_scope` | 新增到 forthAMS `sys_role` |
| `sys_role_dept` | 新增，用于自定义数据权限 |
| `sys_dept.ancestors` | 新增，用于部门及以下范围查询 |
| 权限编码规范 | 采用 `模块:资源:动作`，例如 `system:user:list` |
| 数据权限五级模型 | `1全部 / 2自定义 / 3本部门 / 4本部门及以下 / 5仅本人` |

### 2.2 必须翻译实现的部分

| RuoYi 原始实现 | forthAMS 实现 |
| --- | --- |
| Shiro `UserRealm` | Spring Security `UserDetailsServiceImpl` |
| `@RequiresPermissions` | `@PreAuthorize("@ss.hasPermi('xxx')")` |
| Session/Cookie | JWT + `JwtAuthenticationFilter` |
| MyBatis XML | MyBatis-Plus Mapper + Wrapper + 少量 XML/注解 SQL |
| `${params.dataScope}` | MyBatis-Plus `DataPermissionInterceptor` |
| Thymeleaf/Vue 页面 | React + shadcn/ui 管理页 |

### 2.3 不建议引入的部分

| 不引入项 | 原因 |
| --- | --- |
| Shiro | 与 Spring Security 6 冲突，替换成本高 |
| Sa-Token | 用户明确要求保留 Spring Security |
| MD5 + Salt | forthAMS 已使用 BCrypt，不能降级 |
| `del_flag` | forthAMS 已统一 `deleted` + `@TableLogic` |
| `user_id/role_id/menu_id` 主键列 | forthAMS 统一 `id`，重命名会造成大面积破坏 |
| PageHelper | forthAMS 使用 MyBatis-Plus 分页 |
| 完全动态前端路由 | 一期改动面过大，容易破坏现有 React Router |

## 3. 当前差距清单

| 能力 | forthAMS 现状 | 需要补齐 |
| --- | --- | --- |
| 用户 | 已有 `sys_user`、`UserManagementService` | 返回角色、权限、部门上下文；补登录追踪字段 |
| 部门 | 已有 `sys_dept`、树形查询 | 补 `ancestors/email`，维护祖级路径 |
| 角色 | 已有 `sys_role`、基础 CRUD | 补 `data_scope/menu_check_strictly/dept_check_strictly` |
| 用户角色 | 已有 `sys_user_role` | 保留 |
| 权限 | 有孤立 `sys_permission` | 迁移/兼容到 `sys_menu.perms` |
| 菜单 | 缺失 | 新增 `sys_menu` |
| 角色菜单 | 缺失 | 新增 `sys_role_menu` |
| 角色部门 | 缺失 | 新增 `sys_role_dept` |
| 后端权限加载 | 只加载 `ROLE_xxx` | 同时加载 `sys_menu.perms` |
| 方法级权限 | 有 `@EnableMethodSecurity`，未系统使用 | 给管理接口补 `@PreAuthorize` |
| 数据权限 | 缺失 | 新增 `@DataScope` + DataPermission 插件 |
| 前端权限 | Hook 雏形与 AuthUser 类型不一致 | 补 `permissions`、菜单、按钮权限闭环 |

## 4. 数据库对接方案

### 4.1 命名与兼容原则

1. 继续使用 forthAMS 命名：`id`、`sort_order`、`deleted`。
2. 不改已有表主键和已有字段名。
3. 所有 DDL 走增量迁移。
4. 生产迁移脚本用 `information_schema` guard 保证幂等，避免重复执行失败。
5. `status` 语义统一为 `1=启用/正常`、`0=停用/禁用`，不采用 RuoYi 的 `0正常/1停用`。

### 4.2 必做 ALTER TABLE

```sql
-- sys_role：补 RuoYi 数据权限核心字段
ALTER TABLE sys_role
    ADD COLUMN data_scope TINYINT DEFAULT 1 COMMENT '数据范围:1全部 2自定义 3本部门 4本部门及以下 5仅本人',
    ADD COLUMN menu_check_strictly TINYINT DEFAULT 1 COMMENT '菜单树父子联动:1严格 0非严格',
    ADD COLUMN dept_check_strictly TINYINT DEFAULT 1 COMMENT '部门树父子联动:1严格 0非严格';

-- sys_dept：补祖级路径，支撑本部门及以下
ALTER TABLE sys_dept
    ADD COLUMN ancestors VARCHAR(512) DEFAULT '0' COMMENT '祖级列表',
    ADD COLUMN email VARCHAR(128) COMMENT '邮箱';

-- sys_user：补登录追踪和备注，不改变登录逻辑
ALTER TABLE sys_user
    ADD COLUMN login_ip VARCHAR(128) COMMENT '最后登录IP',
    ADD COLUMN login_date DATETIME COMMENT '最后登录时间',
    ADD COLUMN remark VARCHAR(512) COMMENT '备注';
```

生产脚本建议使用当前 `schema.sql` 已采用的 `information_schema.columns` + `PREPARE stmt` 风格包装，确保重放安全。

### 4.3 新增 sys_menu

```sql
CREATE TABLE IF NOT EXISTS sys_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    menu_name VARCHAR(64) NOT NULL COMMENT '菜单名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父菜单ID',
    sort_order INT DEFAULT 0 COMMENT '显示顺序',
    path VARCHAR(255) COMMENT '前端路由路径',
    component VARCHAR(255) COMMENT '前端组件Key或组件路径',
    query_param VARCHAR(255) COMMENT '路由参数',
    route_name VARCHAR(64) COMMENT '前端路由名称',
    menu_type CHAR(1) NOT NULL COMMENT 'M目录 C菜单 F按钮',
    visible TINYINT DEFAULT 1 COMMENT '1显示 0隐藏',
    status TINYINT DEFAULT 1 COMMENT '1启用 0禁用',
    perms VARCHAR(128) COMMENT '权限标识，如 system:user:list',
    icon VARCHAR(128) COMMENT '图标',
    is_frame TINYINT DEFAULT 0 COMMENT '是否外链:1是 0否',
    is_cache TINYINT DEFAULT 1 COMMENT '是否缓存:1缓存 0不缓存',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_menu_perms (perms),
    INDEX idx_parent_sort (parent_id, sort_order),
    INDEX idx_menu_type (menu_type),
    INDEX idx_status_deleted (status, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表';
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `menu_type` | `M` 目录、`C` 页面菜单、`F` 按钮权限 |
| `perms` | Spring Security authority，例如 `system:user:add` |
| `path` | 前端路径，例如 `/system/users` |
| `component` | 第一期作为前端 route map key，不直接动态 import |
| `visible` | 是否在侧边栏显示，按钮节点默认不显示 |
| `status` | 停用后不参与菜单树和权限加载 |

### 4.4 新增 sys_role_menu

```sql
CREATE TABLE IF NOT EXISTS sys_role_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    menu_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_menu (role_id, menu_id),
    INDEX idx_role_id (role_id),
    INDEX idx_menu_id (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联表';
```

### 4.5 新增 sys_role_dept

```sql
CREATE TABLE IF NOT EXISTS sys_role_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_dept (role_id, dept_id),
    INDEX idx_role_id (role_id),
    INDEX idx_dept_id (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色部门关联表';
```

### 4.6 可选岗位表

岗位不是 RBAC 闭环必需项。仅当产品明确需要“岗位管理、岗位筛选、岗位审批流转”时新增。

```sql
CREATE TABLE IF NOT EXISTS sys_post (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_code VARCHAR(64) NOT NULL,
    post_name VARCHAR(64) NOT NULL,
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    remark VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_post_code (post_code),
    INDEX idx_status_deleted (status, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位信息表';

CREATE TABLE IF NOT EXISTS sys_user_post (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_post (user_id, post_id),
    INDEX idx_user_id (user_id),
    INDEX idx_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户岗位关联表';
```

### 4.7 初始数据策略

必须保证上线后 admin 不被锁死。

1. 初始化系统管理菜单：系统管理、用户管理、角色管理、部门管理、菜单管理。
2. 初始化按钮权限：查询、新增、编辑、删除、重置密码、菜单授权、数据权限。
3. `SUPER_ADMIN` 角色授权所有 `sys_menu` 节点。
4. `USER` 角色仅授权基础菜单，默认 `data_scope=5` 或 `data_scope=3`，按业务确定。
5. `SUPER_ADMIN` 角色 `data_scope=1`。
6. 给 `sys_dept.id=1` 补 `ancestors='0'`。

示例：

```sql
UPDATE sys_role SET data_scope = 1 WHERE role_code = 'SUPER_ADMIN';
UPDATE sys_role SET data_scope = 5 WHERE role_code <> 'SUPER_ADMIN' AND data_scope IS NULL;
UPDATE sys_dept SET ancestors = '0' WHERE parent_id = 0 AND (ancestors IS NULL OR ancestors = '');

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
JOIN sys_menu m ON m.deleted = 0
WHERE r.role_code = 'SUPER_ADMIN'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);
```

### 4.8 `sys_permission` 兼容策略

短期：保留 `sys_permission`，不删除、不强依赖。

中期：以 `sys_menu.perms` 作为主授权来源。若 `sys_permission.permission_code` 已有数据，迁移为 `sys_menu.menu_type='F'` 的按钮节点。

长期：`sys_permission` 可变成“权限字典/权限审计表”，或在完全无引用后废弃。

不建议同时引入 `sys_role_permission`，否则会形成两套授权来源：`role -> menu.perms` 与 `role -> permission`。

## 5. 权限编码规范

格式：`模块:资源:动作`。

系统管理：

| 权限码 | 说明 |
| --- | --- |
| `system:user:list` | 用户列表 |
| `system:user:query` | 用户详情 |
| `system:user:add` | 新增用户 |
| `system:user:edit` | 编辑用户 |
| `system:user:delete` | 删除用户 |
| `system:user:resetPwd` | 重置密码 |
| `system:user:role` | 分配角色 |
| `system:role:list` | 角色列表 |
| `system:role:add` | 新增角色 |
| `system:role:edit` | 编辑角色 |
| `system:role:delete` | 删除角色 |
| `system:role:menu` | 分配菜单 |
| `system:role:dataScope` | 设置数据权限 |
| `system:dept:list` | 部门列表 |
| `system:dept:add` | 新增部门 |
| `system:dept:edit` | 编辑部门 |
| `system:dept:delete` | 删除部门 |
| `system:menu:list` | 菜单列表 |
| `system:menu:add` | 新增菜单 |
| `system:menu:edit` | 编辑菜单 |
| `system:menu:delete` | 删除菜单 |

业务模块示例：

| 权限码 | 说明 |
| --- | --- |
| `asset:ledger:list` | 资产台账列表 |
| `asset:ledger:add` | 新增资产 |
| `asset:ledger:edit` | 编辑资产 |
| `asset:ledger:delete` | 删除资产 |
| `asset:ledger:import` | 导入资产 |
| `asset:ledger:export` | 导出资产 |
| `workorder:order:list` | 工单列表 |
| `workorder:order:add` | 新建工单 |
| `workorder:order:edit` | 编辑工单 |
| `workflow:definition:publish` | 发布流程定义 |

通配规则：

| 权限 | 行为 |
| --- | --- |
| `*:*:*` | 所有权限 |
| `system:user:*` | 用户模块所有动作 |
| `system:*:*` | 系统管理所有权限 |
| `ROLE_SUPER_ADMIN` | 直接通过 `@ss.hasPermi` |

## 6. 后端模型与服务方案

### 6.1 Entity 改造与新增

改造：

| 文件 | 改动 |
| --- | --- |
| `entity/Role.java` | 增加 `sortOrder`、`dataScope`、`menuCheckStrictly`、`deptCheckStrictly` |
| `entity/Dept.java` | 增加持久化 `deptCode`、`ancestors`、`email`，保留 `children` 非持久化 |
| `entity/User.java` | 增加 `loginIp`、`loginDate`、`remark` |
| `entity/SysPermission.java` | 暂保留，可后续增加 `permType` |

新增：

| Entity | 表 |
| --- | --- |
| `SysMenu` 或 `Menu` | `sys_menu` |
| `RoleMenu` | `sys_role_menu` |
| `RoleDept` | `sys_role_dept` |
| `SysPost` | `sys_post`，二期可选 |
| `UserPost` | `sys_user_post`，二期可选 |

命名建议：为了贴近现有 `SysPermission`，菜单实体建议叫 `SysMenu`，避免与前端/Java `Menu` 概念混淆。

### 6.2 DTO/VO 清单

| DTO/VO | 用途 |
| --- | --- |
| `MenuCreateRequest` | 新增菜单 |
| `MenuUpdateRequest` | 编辑菜单 |
| `MenuTreeVO` | 菜单树返回 |
| `CurrentMenuVO` | 当前用户授权菜单 |
| `RoleMenuUpdateRequest` | 角色菜单授权 |
| `RoleDataScopeRequest` | 角色数据权限设置 |
| `CurrentUserVO` | 当前用户信息、角色、权限、菜单 |
| `UserRoleUpdateRequest` | 用户角色分配 |
| `DeptTreeVO` | 部门树 |

### 6.3 Mapper 清单

| Mapper | 必要方法 |
| --- | --- |
| `SysMenuMapper` | `selectMenusByUserId`、`selectPermsByUserId`、`selectMenuTreeByRoleId` |
| `RoleMenuMapper` | `deleteByRoleId`、`insertBatch`、`selectMenuIdsByRoleId` |
| `RoleDeptMapper` | `deleteByRoleId`、`insertBatch`、`selectDeptIdsByRoleId`、`selectDeptIdsByUserId` |
| `UserRoleMapper` | 保留 `selectRoleCodesByUserId`，新增角色状态过滤 |
| `DeptMapper` | `selectDescendantIdsByAncestors`、`updateChildrenAncestors` |

权限查询建议 SQL：

```sql
SELECT DISTINCT m.perms
FROM sys_menu m
JOIN sys_role_menu rm ON rm.menu_id = m.id
JOIN sys_user_role ur ON ur.role_id = rm.role_id
JOIN sys_role r ON r.id = ur.role_id
WHERE ur.user_id = #{userId}
  AND r.status = 1
  AND r.deleted = 0
  AND m.status = 1
  AND m.deleted = 0
  AND m.perms IS NOT NULL
  AND m.perms <> '';
```

### 6.4 Service 清单

| Service | 职责 |
| --- | --- |
| `SysMenuService` | 菜单 CRUD、树构建、当前用户菜单、权限码查询、删除校验 |
| `RoleMenuService` | 角色菜单授权、授权菜单 ID 查询 |
| `RoleDeptService` | 角色部门授权、数据权限部门查询 |
| `SecurityService` | `hasPermi`、`hasRole`、通配符匹配、超级管理员短路 |
| `CurrentUserService` | 当前用户上下文统一读取 |
| `DataScopeDecisionService` | 计算用户最终数据范围 |

现有 Service 改造：

| 文件 | 改造 |
| --- | --- |
| `UserManagementService` | 返回 `roleIds/roles/permissions`，支持角色分配 |
| `RoleService` | 支持菜单授权、数据权限设置、禁止删除内置超级管理员角色 |
| `DeptService` | 维护 `ancestors`，移动部门时事务更新子树 |
| `AuthService` | 登录响应增加 `roles/permissions/menus` 或至少增加 `permissions` |

### 6.5 Controller/API 契约

统一建议使用 `/api/v1` 前缀。如果现有前端仍走 `/api` baseURL，则通过环境变量统一，不要在调用处混用。

当前用户与认证：

| 方法 | 路径 | 响应/说明 |
| --- | --- | --- |
| `POST` | `/auth/login` | 返回 token、user、roles、permissions |
| `GET` | `/users/me` | 当前用户、部门、角色、权限 |
| `GET` | `/menus/current` | 当前用户菜单树和权限码 |

用户管理：

| 方法 | 路径 | 权限码 |
| --- | --- | --- |
| `GET` | `/users` | `system:user:list` |
| `GET` | `/users/{id}` | `system:user:query` |
| `POST` | `/users` | `system:user:add` |
| `PUT` | `/users/{id}` | `system:user:edit` |
| `DELETE` | `/users/{id}` | `system:user:delete` |
| `PUT` | `/users/{id}/status` | `system:user:edit` |
| `PUT` | `/users/{id}/reset-password` | `system:user:resetPwd` |
| `GET` | `/users/{id}/roles` | `system:user:query` |
| `PUT` | `/users/{id}/roles` | `system:user:role` |

角色管理：

| 方法 | 路径 | 权限码 |
| --- | --- | --- |
| `GET` | `/roles` | `system:role:list` |
| `GET` | `/roles/all` | `system:role:query` |
| `GET` | `/roles/{id}` | `system:role:query` |
| `POST` | `/roles` | `system:role:add` |
| `PUT` | `/roles/{id}` | `system:role:edit` |
| `DELETE` | `/roles/{id}` | `system:role:delete` |
| `GET` | `/roles/{id}/menus` | `system:role:query` |
| `PUT` | `/roles/{id}/menus` | `system:role:menu` |
| `GET` | `/roles/{id}/data-scope` | `system:role:query` |
| `PUT` | `/roles/{id}/data-scope` | `system:role:dataScope` |

菜单管理：

| 方法 | 路径 | 权限码 |
| --- | --- | --- |
| `GET` | `/menus/tree` | `system:menu:list` |
| `GET` | `/menus/{id}` | `system:menu:query` |
| `POST` | `/menus` | `system:menu:add` |
| `PUT` | `/menus/{id}` | `system:menu:edit` |
| `DELETE` | `/menus/{id}` | `system:menu:delete` |
| `GET` | `/menus/role-menu-tree/{roleId}` | `system:menu:list` |

部门管理：

| 方法 | 路径 | 权限码 |
| --- | --- | --- |
| `GET` | `/depts/tree` | `system:dept:list` |
| `GET` | `/depts/{id}` | `system:dept:query` |
| `POST` | `/depts` | `system:dept:add` |
| `PUT` | `/depts/{id}` | `system:dept:edit` |
| `DELETE` | `/depts/{id}` | `system:dept:delete` |
| `GET` | `/depts/role-dept-tree/{roleId}` | `system:dept:list` |

## 7. Spring Security 对接方案

### 7.1 保持不变

1. `SecurityConfig` 保留 `STATELESS`。
2. 保留 `JwtAuthenticationFilter`。
3. 保留 `DaoAuthenticationProvider`。
4. 保留 `BCryptPasswordEncoder`。
5. 保留 `@EnableMethodSecurity`。
6. 保留登录和公开接口 `permitAll`。

### 7.2 UserDetailsService 改造

当前只加载 `ROLE_xxx`。改造后同时加载角色和权限。

流程：

1. 查询 `sys_user`，校验 `status=1`、`deleted=0`。
2. 查询启用角色，生成 `ROLE_` + `role_code`。
3. 查询 `sys_menu.perms`，生成普通 authority。
4. 若包含 `ROLE_SUPER_ADMIN`，在 `SecurityService` 中短路，不需要真实落库所有权限。
5. 返回自定义 `LoginUser implements UserDetails`，携带 `userId/deptId/tenantId/roles/permissions`。

建议新增：

```java
public class LoginUser implements UserDetails {
    private Long userId;
    private Long deptId;
    private String tenantId;
    private String username;
    private String password;
    private List<String> roles;
    private List<String> permissions;
    private Collection<? extends GrantedAuthority> authorities;
}
```

### 7.3 `@ss.hasPermi` 权限表达式

新增 Spring Bean：

```java
@Service("ss")
public class SecurityService {
    public boolean hasPermi(String permission) { ... }
    public boolean hasAnyPermi(String permissions) { ... }
    public boolean hasAllPermi(String permissions) { ... }
    public boolean hasRole(String role) { ... }
}
```

规则：

1. 未登录返回 false。
2. `ROLE_SUPER_ADMIN` 直接 true。
3. `*:*:*` 直接 true。
4. 精确匹配 permission。
5. 支持通配符：`system:user:*`、`system:*:*`。
6. 空 permission 默认 false。

Controller 注解示例：

```java
@PreAuthorize("@ss.hasPermi('system:user:list')")
@GetMapping("/users")
public Result<PageResult<UserVO>> list(UserQuery query) { ... }
```

### 7.4 动态 URL 权限表是否引入

MVP 不引入。

原因：

1. RuoYi 原始版也是注解权限为主。
2. forthAMS 已启用方法级权限。
3. 动态 URL 表会引入路径优先级、缓存刷新、匿名路径、HTTP method 匹配等额外复杂度。

二期如果需要“后台配置接口权限”，再新增类似 `sys_resource` 表和 Spring Security `AuthorizationManager`。

### 7.5 权限变更生效策略

MVP：`JwtAuthenticationFilter` 每次请求重新加载 `UserDetails`，权限变更下次请求生效。

优化版：加入权限缓存和失效机制。

| 事件 | 失效对象 |
| --- | --- |
| 修改角色菜单 | 拥有该角色的用户权限缓存 |
| 修改用户角色 | 该用户权限缓存 |
| 禁用角色 | 拥有该角色的用户权限缓存 |
| 禁用菜单 | 全部相关权限缓存 |

## 8. 数据权限方案

### 8.1 实现方式

采用：`@DataScope` + AOP 上下文 + MyBatis-Plus `DataPermissionInterceptor` + JSQLParser。

不采用 RuoYi `${params.dataScope}`，因为 forthAMS 主要使用 MyBatis-Plus Wrapper，强行改 XML 会扩大改动面并增加 SQL 注入风险。

### 8.2 类清单

| 类 | 职责 |
| --- | --- |
| `annotation/DataScope.java` | 标记需要数据权限的方法 |
| `datascope/DataScopeType.java` | 五种数据权限枚举 |
| `datascope/DataScopeMeta.java` | 注解元数据 |
| `datascope/DataScopeContextHolder.java` | ThreadLocal 保存当前方法的数据权限配置 |
| `datascope/DataScopeAspect.java` | 拦截 `@DataScope`，设置/清理上下文 |
| `datascope/DataScopeDecisionService.java` | 根据当前用户角色计算可见范围 |
| `datascope/DataScopeTableRegistry.java` | 表名到 dept/user 字段的映射 |
| `datascope/AmsDataPermissionHandler.java` | 生成 JSQLParser 表达式 |
| `config/MyBatisPlusConfig.java` | 注册 `DataPermissionInterceptor` |

注解建议：

```java
@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface DataScope {
    String tableAlias() default "";
    String deptColumn() default "dept_id";
    String userColumn() default "create_by";
    String resource() default "";
    boolean enabled() default true;
}
```

### 8.3 数据权限 SQL 规则

租户隔离永远优先，数据权限只能在租户内缩小范围。

正确：

```sql
WHERE tenant_id = 'dept:1'
  AND (dept_id IN (1, 2, 3) OR create_by = 1001)
```

错误：

```sql
WHERE tenant_id = 'dept:1' OR dept_id IN (1, 2, 3)
```

五级规则：

| `data_scope` | 规则 |
| --- | --- |
| `1` 全部 | 不追加部门/本人条件，但保留 tenant 条件 |
| `2` 自定义 | `dept_column IN (sys_role_dept 指定部门)` |
| `3` 本部门 | `dept_column = 当前用户 deptId` |
| `4` 本部门及以下 | `dept_column IN (当前部门 + 子部门)` |
| `5` 仅本人 | `user_column = 当前用户 id` |

多角色合并：

1. `SUPER_ADMIN` 或任意角色 `data_scope=1`，结果为全部。
2. 其他角色取并集，用 `OR` 合并。
3. 自定义部门取所有角色的部门集合并集。

### 8.4 业务表映射

P0：

| 表 | dept 字段 | user 字段 | 说明 |
| --- | --- | --- | --- |
| `asset` | `dept_id` | `create_by` | 第一批试点 |
| `work_order` | `dept_id` | `reporter_id` | 工单可见性 |
| `retirement_application` | `dept_id` | `applicant_id` | 报废/退役申请 |

P1：

| 表 | dept 字段 | user 字段 | 说明 |
| --- | --- | --- | --- |
| `approval_process` | 无 | `applicant_id` | 需结合审批人规则 |
| `approval_record` | 无 | `approver_id` | 需结合流程规则 |
| `asset_compensation` | `responsible_dept_id` | `responsible_user_id` | 业务含义需确认 |

P2：

| 表 | 处理建议 |
| --- | --- |
| `inventory_task` | 现有 `dept_ids TEXT` 不适合索引过滤，建议二期拆 `inventory_task_dept` |
| `inventory_detail` | 通过 task 或 asset 间接继承权限 |
| `notification` | 当前按 `user_id` 过滤，不套部门权限 |
| 报表/Dashboard | 聚合 SQL 复杂，等核心模块稳定后逐个接入 |

### 8.5 部门 ancestors 维护

新增部门：

1. 父部门为 0：`ancestors='0'`。
2. 有父部门：`ancestors = parent.ancestors + ',' + parent.id`。

移动部门：

1. 校验不能移动到自己或子孙节点下。
2. 事务更新当前部门 `parent_id/ancestors`。
3. 递归更新所有子部门 ancestors。
4. 移动后清理部门 descendants 缓存。

删除部门：

1. 有子部门禁止删除。
2. 有用户绑定禁止删除。
3. 有角色数据权限引用时禁止删除或先解除引用。

## 9. 前端对接方案

### 9.1 第一阶段原则

不做完全动态路由。采用“后端授权菜单树 + 前端 route map 映射”。

理由：现有 `router/index.tsx` 已有大量静态 lazy 路由，完全动态会影响面过大。

### 9.2 类型与认证上下文

`AuthUser` 需要增加：

```ts
interface AuthUser {
  userId: number;
  username: string;
  realName: string;
  deptId?: number;
  deptName?: string;
  roles: string[];
  permissions: string[];
}
```

菜单类型：

```ts
type MenuType = 'M' | 'C' | 'F';

interface MenuNode {
  id: number;
  parentId: number;
  menuName: string;
  menuType: MenuType;
  path?: string;
  component?: string;
  perms?: string;
  icon?: string;
  sortOrder: number;
  visible: boolean;
  status: number;
  children?: MenuNode[];
}
```

### 9.3 API 封装

新增 `frontend/src/api/system.ts` 或按模块拆分：

| 函数 | API |
| --- | --- |
| `getCurrentUser()` | `GET /users/me` |
| `getCurrentMenus()` | `GET /menus/current` |
| `getMenuTree()` | `GET /menus/tree` |
| `createMenu()` | `POST /menus` |
| `updateMenu()` | `PUT /menus/{id}` |
| `deleteMenu()` | `DELETE /menus/{id}` |
| `getRoleMenus()` | `GET /roles/{id}/menus` |
| `updateRoleMenus()` | `PUT /roles/{id}/menus` |
| `getRoleDataScope()` | `GET /roles/{id}/data-scope` |
| `updateRoleDataScope()` | `PUT /roles/{id}/data-scope` |

### 9.4 菜单渲染

前端维护：

```ts
const ROUTE_META_MAP = {
  '/dashboard': { icon: LayoutDashboard },
  '/assets': { icon: Package },
  '/system/users': { icon: Users },
  '/system/roles': { icon: Shield },
  '/system/depts': { icon: Building2 },
  '/system/menus': { icon: MenuIcon }
};
```

渲染规则：

1. `M/C` 节点参与侧边栏。
2. `F` 节点只进入 `permissions`，不显示在侧边栏。
3. `visible=0` 不显示。
4. `status=0` 不显示也不授权。
5. 后端返回的 `path` 不在 route map 中时，开发环境告警，生产环境跳过。
6. 菜单接口失败时，可临时 fallback 到静态菜单，避免白屏。

### 9.5 按钮权限

新增或修正：

```ts
function usePermission() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');

  return {
    hasPermission: (perm: string) => isSuperAdmin || permissions.includes(perm),
    hasAnyPermission: (perms: string[]) => isSuperAdmin || perms.some((p) => permissions.includes(p)),
    hasAllPermissions: (perms: string[]) => isSuperAdmin || perms.every((p) => permissions.includes(p))
  };
}
```

组件：

```tsx
<PermissionGate perms={["system:user:add"]}>
  <Button>新增用户</Button>
</PermissionGate>
```

后端仍必须校验。前端按钮隐藏只是用户体验。

### 9.6 页面清单

MVP：

| 页面 | 路径建议 | 功能 |
| --- | --- | --- |
| 用户管理 | `/system/users` | CRUD、角色分配、重置密码、状态切换 |
| 角色管理 | `/system/roles` | CRUD、菜单授权、数据权限设置 |
| 部门管理 | `/system/depts` | 树表、CRUD、排序、状态 |
| 菜单管理 | `/system/menus` | M/C/F 树维护、权限码维护 |
| 403 页面 | `/403` | 无权限提示 |

二期：

| 页面 | 条件 |
| --- | --- |
| 岗位管理 | 业务确认需要岗位 |
| 权限字典 | `sys_permission` 确认为长期保留 |
| 操作日志 | 需要 RuoYi 风格审计后台 |
| 字典/参数配置 | 枚举和配置膨胀后再做 |

## 10. 迁移、灰度与回滚

### 10.1 上线顺序

1. 上线新增表和字段，不启用新权限注解。
2. 初始化系统菜单和超级管理员授权。
3. 后端增加权限加载，但不阻断现有接口。
4. 前端读取 `permissions/menus`，先只控制新增系统管理页面。
5. 给系统管理接口补 `@PreAuthorize`。
6. 灰度给业务接口补权限注解。
7. 启用数据权限，先资产模块试点。

### 10.2 防锁死策略

1. `SUPER_ADMIN` 永远短路通过。
2. 初始迁移必须给角色 1 或 `SUPER_ADMIN` 绑定所有菜单。
3. `@ss.hasPermi` 对 `ROLE_SUPER_ADMIN` 返回 true。
4. 首次部署前不要给登录、当前用户、当前菜单接口加会阻断自身加载的权限。

### 10.3 `sys_permission` 迁移

1. 扫描现有 `sys_permission.permission_code`。
2. 按编码前两段匹配已有菜单节点。
3. 能匹配的生成 `F` 按钮节点。
4. 不能匹配的进入“未归类权限”父菜单，人工整理。
5. 迁移后权限加载只从 `sys_menu.perms` 读取。
6. 旧 `sys_permission` 保留至少一个版本周期。

### 10.4 JWT tenant 兼容

现状 `AuthService.resolveTenantId` 使用 `dept:{deptId}`。该逻辑暂不改变。

数据权限接入原则：

1. 继续保留现有 tenant 查询条件。
2. 数据权限只在 tenant 内缩小范围。
3. 不允许数据权限生成跨 tenant 的 OR 条件。
4. 后续若要从“部门伪租户”升级为真正租户，需要另立迁移方案。

### 10.5 回滚

MVP 改造以新增为主，回滚风险较低。

回滚步骤：

1. 关闭前端动态菜单，回退静态菜单。
2. 移除或禁用新增 `@PreAuthorize` 注解提交。
3. 保留新增表不删除，避免数据丢失。
4. 如必须回滚 DDL，先备份，再 drop `sys_menu/sys_role_menu/sys_role_dept`，并 drop 新增列。
5. 数据权限插件必须可通过配置开关关闭。

## 11. 实施计划与工时

### 11.1 MVP 阶段：菜单权限闭环

目标：完成 RuoYi 风格菜单、角色菜单、按钮权限、前端管理页基础闭环。

| 任务 | 工时 |
| --- | ---: |
| DDL 与初始化数据 | 1-2 天 |
| `SysMenu/RoleMenu/RoleDept` 实体和 Mapper | 1 天 |
| 菜单 Service/Controller | 1-2 天 |
| RoleService 增加菜单授权 | 1 天 |
| UserDetailsService 加载权限 | 0.5-1 天 |
| `SecurityService @ss` | 0.5 天 |
| 当前用户接口返回 permissions/menus | 0.5-1 天 |
| 前端 AuthUser/权限 Hook/PermissionGate | 1 天 |
| 用户/角色/部门/菜单管理页面基础版 | 4-6 天 |
| 系统管理接口权限注解与测试 | 1-2 天 |

MVP 合计：**12-18 人天**。

### 11.2 数据权限阶段

目标：接入 RuoYi 五级数据权限，先覆盖资产、工单、报废。

| 任务 | 工时 |
| --- | ---: |
| `data_scope`、`sys_role_dept` 管理闭环 | 1 天 |
| `@DataScope`、AOP、Context | 1 天 |
| DataPermissionHandler + 表字段 registry | 2-3 天 |
| Dept ancestors 维护与 descendants 缓存 | 1-2 天 |
| 资产模块试点 | 1-2 天 |
| 工单/报废模块接入 | 2-3 天 |
| 集成测试和 SQL 回归 | 2-3 天 |

数据权限阶段合计：**10-15 人天**。

### 11.3 二期增强

| 能力 | 条件 |
| --- | --- |
| 岗位管理 | 业务需要岗位维度 |
| 操作日志后台 | 审计要求提升 |
| 动态 URL 权限表 | 需要后台配置接口 ACL |
| 完全动态路由 | 菜单模型稳定后 |
| 权限缓存 | 权限查询成为性能瓶颈 |
| 字典/参数配置 | 枚举/配置增长明显 |

## 12. 验收与测试清单

### 12.1 数据库验收

1. 新增表存在且索引正确。
2. 新增列存在且默认值正确。
3. 重复执行迁移脚本不报错。
4. admin 角色拥有所有 `sys_menu`。
5. 普通角色默认不拥有系统管理写权限。
6. `sys_dept.ancestors` 根节点为 `0`。

### 12.2 权限验收

1. 登录返回 `roles` 和 `permissions`。
2. `/users/me` 返回 `deptId/deptName/roles/permissions`。
3. `/menus/current` 返回授权菜单和权限码。
4. 没有 `system:user:list` 的用户访问用户列表返回 403。
5. 拥有 `system:user:list` 的用户访问用户列表返回 200。
6. `SUPER_ADMIN` 无需逐条权限即可访问所有受控接口。
7. 禁用角色后对应权限不再生效。
8. 禁用菜单后对应权限不再生效。

### 12.3 前端验收

1. 未登录跳转登录页。
2. 登录后侧边栏只显示授权菜单。
3. 无权限按钮不显示。
4. 直接访问未授权页面进入 403。
5. 菜单接口失败时不白屏，有兜底或错误提示。
6. 后端路径与前端 route map 不匹配时开发环境有告警。

### 12.4 数据权限验收

1. 全部数据角色可见当前 tenant 内所有数据。
2. 本部门角色只能看本部门数据。
3. 本部门及以下角色能看子部门数据。
4. 自定义角色只能看指定部门数据。
5. 仅本人角色只能看本人相关数据。
6. 跨 tenant 数据不可见。
7. 分页列表和 count SQL 都带数据权限。
8. 搜索、导出与列表使用同一数据权限规则。

### 12.5 兼容验收

1. 现有登录不破坏。
2. 现有 `/users`、`/roles`、`/depts` 基础调用不破坏。
3. 现有资产、工单、审批业务不因 RBAC MVP 失效。
4. 现有 JWT tenant claim 不变。
5. 原有 `sys_permission` 数据不丢失。

### 12.6 安全验收

1. 所有新增、编辑、删除、授权、导出接口都有后端权限注解。
2. 前端按钮隐藏不是唯一安全控制。
3. 篡改 JWT 返回 401。
4. 禁用用户无法登录。
5. 空权限码默认拒绝。
6. 数据权限永远不会生成 `tenant_id OR ...` 条件。

### 12.7 性能验收

1. 登录权限加载常规数据量小于 300ms。
2. 当前菜单加载小于 200ms。
3. 菜单树构建支持 500 个节点以内稳定响应。
4. 部门 descendants 查询有缓存或索引支撑。
5. 资产列表接入数据权限后分页性能可接受。

## 13. 风险与应对

| 风险 | 等级 | 应对 |
| --- | --- | --- |
| Shiro 到 Spring Security 语义偏差 | 高 | 不复制 Shiro，只复制权限编码模型；用 `@ss.hasPermi` 复刻通配规则 |
| 权限双轨 | 高 | `sys_menu.perms` 为主，`sys_permission` 只兼容不扩展 |
| admin 被锁死 | 高 | `SUPER_ADMIN` 短路 + 初始化全菜单授权 |
| 前端菜单配置错导致打不开 | 中 | route map 白名单 + 开发告警 + 生产跳过 |
| 数据权限误放大租户范围 | 高 | tenant 条件保持独立，数据权限只追加 AND 子句 |
| MyBatis-Plus 插件影响复杂 SQL | 中高 | 白名单接入，先资产试点，再逐模块扩展 |
| 角色权限变更不生效 | 中 | MVP 每次请求加载权限，二期加缓存失效 |
| `ancestors` 维护错误 | 中 | 部门移动必须事务更新子树并测试 |
| 工期失控 | 中 | 先交付 MVP，再做数据权限和二期增强 |

## 14. 最终交付顺序

推荐严格按以下顺序推进：

1. 数据库迁移：`sys_menu`、`sys_role_menu`、`sys_role_dept`、`data_scope`、`ancestors`。
2. 初始菜单和 SUPER_ADMIN 授权 seed。
3. 后端菜单实体、Mapper、Service、Controller。
4. 角色菜单授权和角色数据权限接口。
5. `LoginUser`、`UserDetailsServiceImpl`、`SecurityService @ss`。
6. 登录和当前用户接口返回 `permissions/menus`。
7. 系统管理接口补 `@PreAuthorize`。
8. 前端 `AuthUser`、`usePermission`、`PermissionGate`。
9. 前端菜单渲染接入 `/menus/current`。
10. 前端用户/角色/部门/菜单管理页面。
11. 数据权限基础设施。
12. 资产模块数据权限试点。
13. 工单、报废、审批逐步接入。
14. 全量测试、性能验证、回滚预案演练。

## 15. 不遗漏确认

本方案已覆盖：

| 范围 | 状态 |
| --- | --- |
| RuoYi 与 forthAMS 技术差异 | 已覆盖 |
| 可借鉴/不可引入边界 | 已覆盖 |
| 字段级 DDL | 已覆盖 |
| 初始数据 | 已覆盖 |
| `sys_permission` 兼容 | 已覆盖 |
| 后端 Entity/Mapper/Service/Controller | 已覆盖 |
| Spring Security 6 改造 | 已覆盖 |
| 数据权限类与 SQL 规则 | 已覆盖 |
| 前端 API/页面/路由/按钮权限 | 已覆盖 |
| 迁移、灰度、回滚 | 已覆盖 |
| 测试验收 | 已覆盖 |
| 风险矩阵 | 已覆盖 |
