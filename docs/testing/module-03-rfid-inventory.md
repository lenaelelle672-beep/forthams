# 模块测试文档：RFID资产盘点

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 盘点任务列表 | 已覆盖 | `inventoryService.listTasks` 对接 `/inventory/tasks` | `RFIDInventory.tsx` |
| 创建盘点任务按钮 | 已覆盖 | 表单提交调用 `inventoryService.createTask` | `RFIDInventory.tsx` |
| 开始盘点按钮 | 已覆盖 | 调用 `inventoryService.updateTaskStatus` | `RFIDInventory.tsx` |
| RFID扫描提交 | 已覆盖 | 调用 `inventoryService.addScanResult`，字段已改为 `rfidTag/status/scanTime` | `RFIDInventory.tsx` |
| 盘点明细查询 | 已覆盖 | 调用 `inventoryService.getTaskDetails` | `InventoryController` |
| 账实差异处理 | 部分覆盖 | 后端记录 `inventory_detail.status`，前端展示差异区域 | `InventoryService#addScanResult` |

## 执行命令

```bash
cd frontend && npm test -- --run
cd frontend && npm run build
```

## 结果

通过。残留风险：RFID硬件接入未做，只实现模拟扫描与业务接口。
