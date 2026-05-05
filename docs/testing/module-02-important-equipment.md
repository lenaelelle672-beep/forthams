# 模块测试文档：重要设备管理

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 维护记录列表 | 已覆盖 | 前端调用 `maintenanceService.list`，后端接口编译通过 | `ImportantEquipment.tsx`、`MaintenanceController` |
| 智能保养提醒 | 已覆盖 | 前端调用 `maintenanceService.getUpcoming`，后端提供 `/maintenance/upcoming` | `MaintenanceService#getUpcomingMaintenance` |
| 新增维护按钮 | 已覆盖 | 表单提交调用 `maintenanceService.create` | `ImportantEquipment.tsx` |
| 编辑/保存维护 | 已覆盖 | 后端提供 `PUT /maintenance/{id}` | `MaintenanceController` |
| 删除维护记录 | 已覆盖 | 后端提供 `DELETE /maintenance/{id}` | `MaintenanceController` |
| 使用率图表 | 部分覆盖 | 前端图表数据保留展示结构 | `ImportantEquipment.tsx` |

## 执行命令

```bash
cd backend && mvn -q -DskipTests compile
cd frontend && npm run build
```

## 结果

通过。残留风险：设备使用率缺少独立数据表，目前为前端展示指标，后续可接入设备运行日志。
