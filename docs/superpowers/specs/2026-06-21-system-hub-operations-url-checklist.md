# 后台设置 / 资产运营中枢逐页巡检 URL 清单

用途：用于浏览器或人工巡检时逐页打开 39 个后台设置正式菜单，验证页面是否符合“后台运营台式统一重排”目标。

基础路径：`/fixed-assets/workbench?menu=<menuId>`

不计入正式 39 页：

- `/fixed-assets/workbench?menu=system-hub-navigation-console`，系统运营中枢导航控制台。

## 组织权限（7）

| 序号 | 页面 | URL | 核心巡检点 |
| ---: | --- | --- | --- |
| 1 | 用户管理 | `/fixed-assets/workbench?menu=system-user-management` | 用户授权搜索、7000+ 人员承载、分页/表格滚动 |
| 2 | 角色权限 | `/fixed-assets/workbench?menu=system-role-permissions` | 权限范围、成员来源、角色包列表 |
| 3 | 菜单权限 | `/fixed-assets/workbench?menu=system-menu-permissions` | 菜单树、菜单路径、按钮权限 |
| 4 | 数据权限 | `/fixed-assets/workbench?menu=system-data-permissions` | 数据范围、有效期、越权策略 |
| 5 | 工作交接 | `/fixed-assets/workbench?menu=system-handover` | 交接任务、代理、待办转移 |
| 6 | 部门组织 | `/fixed-assets/workbench?menu=system-dept-org` | 200+ 部门树、部门路径、同步状态 |
| 7 | 岗位管理 | `/fixed-assets/workbench?menu=system-post-management` | 岗位列表、角色联动、交接策略 |

## 基础资料（6）

| 序号 | 页面 | URL | 核心巡检点 |
| ---: | --- | --- | --- |
| 1 | 资产分类 | `/fixed-assets/workbench?menu=system-asset-category` | 分类树、分类表、发布检查 |
| 2 | 编号规则 | `/fixed-assets/workbench?menu=system-numbering-rules` | 编号试算、冲突检测、回滚策略 |
| 3 | 位置管理 | `/fixed-assets/workbench?menu=system-location-management` | 位置树、位置表、数据权限 |
| 4 | 供应商管理 | `/fixed-assets/workbench?menu=system-vendor-management` | 供应商列表、交易反查、停用策略 |
| 5 | 自定义字段 | `/fixed-assets/workbench?menu=system-custom-fields` | 字段定义、校验、桌面/H5 布局 |
| 6 | 自定义字段集 | `/fixed-assets/workbench?menu=system-custom-field-sets` | 字段组合、表单复用、布局复用 |

## 流程平台（7）

| 序号 | 页面 | URL | 核心巡检点 |
| ---: | --- | --- | --- |
| 1 | 流程定义 | `/fixed-assets/workbench?menu=system-flow-definition` | 流程模板、版本基线、发布检查 |
| 2 | 流程设计器 | `/fixed-assets/workbench?menu=system-flow-designer` | 大画布、节点属性、保存/发布 |
| 3 | 表单配置 | `/fixed-assets/workbench?menu=system-form-config` | 字段、桌面/H5 布局、版本发布 |
| 4 | 表单存储 | `/fixed-assets/workbench?menu=system-form-storage` | 版本、实例数据、归档策略 |
| 5 | 审批规则 | `/fixed-assets/workbench?menu=system-approval-rules` | 交接、代理、节点权限、发布影响 |
| 6 | 待办字段配置 | `/fixed-assets/workbench?menu=system-todo-fields` | 字段来源、排序筛选、H5 显示 |
| 7 | SLA 配置 | `/fixed-assets/workbench?menu=system-sla-config` | 审批时限、升级规则、通知渠道 |

## 集成配置（5）

| 序号 | 页面 | URL | 核心巡检点 |
| ---: | --- | --- | --- |
| 1 | 外部系统配置 | `/fixed-assets/workbench?menu=system-external-systems` | 系统档案、认证策略、接口链路 |
| 2 | 接口配置 | `/fixed-assets/workbench?menu=system-interfaces` | 地址、方法、认证引用、调用日志 |
| 3 | 字段映射 | `/fixed-assets/workbench?menu=system-field-mapping` | 转换规则、样例校验、发布门禁 |
| 4 | 同步规则 | `/fixed-assets/workbench?menu=system-sync-rules` | 触发、重试、幂等、人工补发 |
| 5 | Webhook 配置 | `/fixed-assets/workbench?menu=system-webhook-config` | 订阅、签名校验、失败重放 |

## 消息与通知（8）

| 序号 | 页面 | URL | 核心巡检点 |
| ---: | --- | --- | --- |
| 1 | 邮件网关配置 | `/fixed-assets/workbench?menu=system-mail-gateway` | SMTP、认证安全、测试连接 |
| 2 | 流程邮件配置 | `/fixed-assets/workbench?menu=system-workflow-mail` | 节点邮件规则、收件人规则 |
| 3 | 邮件模板 | `/fixed-assets/workbench?menu=system-mail-templates` | 标题正文变量、版本说明 |
| 4 | 邮件日志 | `/fixed-assets/workbench?menu=system-mail-logs` | 发送批次、失败原因、重试动作 |
| 5 | 通知模板 | `/fixed-assets/workbench?menu=system-notification-templates` | 变量字典、渠道适配、发布校验 |
| 6 | 通知渠道 | `/fixed-assets/workbench?menu=system-notification-channels` | 限流策略、降级路由、健康状态 |
| 7 | 通知偏好 | `/fixed-assets/workbench?menu=system-notification-preferences` | 用户/角色/组织偏好、静默规则 |
| 8 | 流程通知开关 | `/fixed-assets/workbench?menu=system-workflow-notification-switch` | 节点事件、渠道组合、失败兜底 |

## 系统参数（6）

| 序号 | 页面 | URL | 核心巡检点 |
| ---: | --- | --- | --- |
| 1 | 基础参数 | `/fixed-assets/workbench?menu=system-base-params` | 参数表、默认值、发布门禁 |
| 2 | 安全策略 | `/fixed-assets/workbench?menu=system-security-policy` | 登录会话、脱敏、高危操作确认 |
| 3 | 文件存储配置 | `/fixed-assets/workbench?menu=system-file-storage` | 附件存储、归档、病毒扫描 |
| 4 | 导入导出配置 | `/fixed-assets/workbench?menu=system-import-export` | 模板、字段映射、水印、队列策略 |
| 5 | 缓存管理 | `/fixed-assets/workbench?menu=system-cache-management` | 缓存域、刷新策略、命中率 |
| 6 | 操作审计 | `/fixed-assets/workbench?menu=system-audit-log` | 风险等级、留存周期、导出取证 |

## 巡检通过标准

每个 URL 至少记录以下四项：

- 低噪声结构：多重卡片和重阴影不再主导页面。
- 主操作首屏可见：搜索、筛选、保存、发布、批量、分页等入口可见。
- 数据区可承载：表格、树、日志、队列可滚动或横向承载。
- 辅助信息不抢主区：证据、预览、推荐、runbook 可见但弱化。

结果回填位置：`docs/superpowers/specs/2026-06-21-system-hub-operations-inspection-results.json`。
