# 模块测试文档：闲置资产管理

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 闲置资产列表 | 已覆盖 | `idleAssetService.list` 对接 `/idle-assets/list` | `IdleAssets.tsx` |
| 发布闲置公告按钮 | 已覆盖 | 调用 `idleAssetService.publish`，提交 `assetId/idleDays/reason` | `IdleAssets.tsx` |
| 资产认领按钮 | 已覆盖 | 普通用户调用 `idleAssetService.claim` 后进入 `CLAIM_PENDING` | `IdleAssetControllerTest` / `IdleAssetServiceTest` |
| 认领审批确认 | 已覆盖 | 资产管理员通过后状态变为 `CLAIMED`，并通过 `AssetLifecycleService` 分配资产；驳回后恢复公告中 | `IdleAssetControllerTest` / `IdleAssetServiceTest` |
| 取消公告按钮 | 已覆盖 | 调用 `idleAssetService.cancel` | `IdleAssets.tsx` |
| 删除记录 | 已覆盖 | 后端提供 `DELETE /idle-assets/{id}` | `IdleAssetController` |
| 处置记录管理 | 已覆盖 | 列表按状态聚合展示 | `IdleAssets.tsx` |

## 执行命令

```bash
cd backend && mvn test
cd frontend && npm run build
```

## 结果

通过。认领人由后端从当前登录用户解析；认领只提交申请，最终确认由具备 `idle:approve` 权限的资产管理员完成。
