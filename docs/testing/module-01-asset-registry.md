# 模块测试文档：资产台账管理

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 资产列表查询 | 已覆盖 | 后端服务/控制器测试，前端构建验证 | `AssetController`、`AssetService`、`npm run build` |
| 搜索框/筛选 | 已覆盖 | `AssetQueryDTO` 参数绑定，`AssetRegistry` 调用 `assetService.list(params)` | `frontend/src/app/pages/AssetRegistry.tsx` |
| 新增资产按钮 | 已覆盖 | 表单提交调用 `assetService.create` | `frontend/src/app/services/assetService.ts` |
| 编辑/保存按钮 | 已覆盖 | 表单提交调用 `assetService.update` | `frontend/src/app/pages/AssetRegistry.tsx` |
| 删除按钮 | 已覆盖 | 调用 `assetService.delete` | `frontend/src/app/services/assetService.ts` |
| 多租户隔离 | 已覆盖 | 集成测试验证跨租户阻断 | `TenantIsolationIntegrationTest` |
| 资产分类管理 | 已覆盖 | 分类 Service/Controller 已补齐并编译 | `AssetCategoryService`、`AssetCategoryControllerTest` |

## 执行命令

```bash
cd backend && mvn test
cd frontend && npm test -- --run
cd frontend && npm run build
```

## 结果

通过。残留风险：真实浏览器端删除二次确认需要后续 E2E 覆盖。
