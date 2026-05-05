# 模块测试文档：闲置资产管理

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 闲置资产列表 | 已覆盖 | `idleAssetService.list` 对接 `/idle-assets/list` | `IdleAssets.tsx` |
| 发布闲置公告按钮 | 已覆盖 | 调用 `idleAssetService.publish`，提交 `assetId/idleDays/reason` | `IdleAssets.tsx` |
| 资产认领按钮 | 已覆盖 | 调用 `idleAssetService.claim` | `IdleAssetControllerTest` |
| 取消公告按钮 | 已覆盖 | 调用 `idleAssetService.cancel` | `IdleAssets.tsx` |
| 删除记录 | 已覆盖 | 后端提供 `DELETE /idle-assets/{id}` | `IdleAssetController` |
| 处置记录管理 | 已覆盖 | 列表按状态聚合展示 | `IdleAssets.tsx` |

## 执行命令

```bash
cd backend && mvn test
cd frontend && npm run build
```

## 结果

通过。残留风险：认领人当前前端使用默认用户 ID，后续应接入登录用户信息。
