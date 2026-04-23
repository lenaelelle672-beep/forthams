# forthAMS 业务路线图
# ⚠️ 本文件由人工维护，GSD 只读不可写。
# Autopilot 在生成新任务时以本文件为唯一业务锚点。
# 最后更新：2026-04-17

---

## ✅ 已完成（Sprint 1-4）

- [x] 资产 CRUD 核心功能（Asset Entity / Controller / Service）
- [x] 供应商管理模块（Vendor CRUD + 审计日志）
- [x] 位置层级管理模块（Location 树形结构）
- [x] 审计日志切面（AuditAspect + @Auditable 注解）
- [x] 工单模块基础框架（Work Order CRUD）
- [x] 细粒度权限系统（11 权限 + 3 角色 + usePermissions Hook）
- [x] 前端 ErrorBoundary 容错机制
- [x] 打印样式优化（Print CSS）
- [x] 全局导航搜索
- [x] Spring AOP + AspectJ 审计集成

---

## 🔥 下一阶段优先级（Sprint 5+）

### P0 — 核心业务闭环
1. [ ] 工单审批流程（前端审批页面 + 后端状态机 + 通知）
2. [x] 资产报废/退役流程（状态流转 + 审批链 + 历史记录）
3. [x] 资产折旧计算模块（直线法/双倍余额递减法 + 定时任务）

### P1 — 集成与安全
4. [ ] 多租户数据隔离（TenantContext + JWT tenant_id 提取）
5. [ ] 操作日志仪表板（审计数据可视化 + 趋势图表）

### P2 — 用户体验提升
6. [ ] 资产批量导入/导出（Excel/CSV 上传下载）
7. [ ] 仪表板数据看板（资产总览 + 分类统计 + 到期预警）

---

### P3 — 交付与发布验证
8. [ ] E2E 整体业务链路跑通测试（覆盖工单、报废等核心集成链路）
9. [ ] 发布机制冒烟测试（验证前后端打包、本地部署与运行是否正常）

---

## 🚫 不在本阶段范围内（Autopilot 禁止触碰）

- IAM 单点登录对接（交由人工或其他架构流处理）
- 移动端响应式适配
- Python 测试脚本修复（scripts/、tests/*.py）
- Docstring 补全或代码风格优化
- DeadCodeVisitor 静态分析工具维护
- 性能基准测试或技术债务清理
