# 模块测试文档：资产赔偿管理

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 赔偿列表 | 已覆盖 | `compensationService.list` 对接 `/compensations/list` | `Compensation.tsx` |
| 搜索/筛选 | 已覆盖 | 前端筛选状态，后端支持 `status/assetId` 参数 | `CompensationService` |
| 新建赔偿申请 | 已覆盖 | 表单提交调用 `compensationService.create` | `AssetCompensationForm.tsx` |
| 编辑/保存赔偿 | 已覆盖 | 后端提供 `PUT /compensations/{id}` | `CompensationController` |
| 状态更新 | 已覆盖 | 后端提供 `PUT /compensations/{id}/status` | `CompensationServiceTest` |
| 赔偿审批流程 | 已覆盖 | 提交前校验已发布 `ASSET_COMPENSATION` 流程 | `CompensationServiceTest`、`WorkflowDefinitionServiceTest` |
| 系统估值 | 已覆盖 | 后端提供 `POST /compensations/valuation`；缺赔偿金额时按资产当前价值/原值自动估值 | `CompensationServiceTest`、`CompensationService` |

## 执行命令

```bash
cd backend && mvn test
cd backend && mvn -q -Dtest=CompensationServiceTest,WorkflowDefinitionServiceTest test
cd frontend && npm run build
```

## 结果

通过。当前已支持系统估值和人工覆盖。残留风险：损坏比例、市场残值、超过净值限制、人工覆盖审批留痕等精细业务规则仍需产品确认。
