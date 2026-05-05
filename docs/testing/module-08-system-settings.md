# 模块测试文档：系统设置

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 用户列表 | 已覆盖 | `userService.list` 对接 `/users/list` | `Settings.tsx` |
| 新增用户按钮 | 已覆盖 | 调用 `userService.create` | `Settings.tsx` |
| 用户启停按钮 | 已覆盖 | 调用 `userService.updateStatus` | `UserManagementController` |
| 重置密码 | 已覆盖 | 后端提供 `/users/{id}/reset-password` | `UserManagementService` |
| 角色列表/新增/编辑/删除 | 已覆盖 | `roleService` 对接 `/roles` | `RoleController` |
| 部门树/新增/删除 | 已覆盖 | `deptService` 对接 `/depts` | `DeptController` |
| 系统集成配置 | 部分覆盖 | 页面结构保留，未接外部系统配置表 | `Settings.tsx` |

## 执行命令

```bash
cd backend && mvn -q -DskipTests compile
cd frontend && npm run build
```

## 结果

通过。残留风险：外部系统集成配置需要明确第三方系统字段后再落库。
