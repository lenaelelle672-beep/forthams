# i18n 国际化迁移指南

## 架构说明

本项目使用 **i18next** 作为国际化核心库，**react-i18next** 作为 React 绑定。

### 技术栈

| 组件 | 版本 | 说明 |
|------|------|------|
| i18next | ^24.2.3 | 国际化核心框架 |
| react-i18next | ^15.7.4 | React 绑定 |
| i18next-browser-languagedetector | ^8.2.1 | 浏览器语言检测（可选） |

### 初始化流程

1. `frontend/src/i18n/index.ts` — i18next 初始化配置
2. `frontend/src/i18n/types.ts` — i18n 类型声明
3. `frontend/src/main.tsx` — 导入 `./i18n` 确保 React 渲染前完成初始化

### 目录结构

```
frontend/src/i18n/
├── index.ts                    # i18next 初始化配置
├── types.ts                    # 类型声明（可选）
└── locales/
    ├── zh-CN/                  # 中文简体
    │   ├── common.ts           # 通用文案（按钮、状态、提示）
    │   ├── workorder.ts        # 工单管理模块
    │   ├── inventory.ts        # 盘点管理模块
    │   ├── asset.ts            # 资产管理模块
    │   ├── approval.ts         # 审批管理模块
    │   └── user.ts             # 用户管理模块
    └── en/                     # 英文
        ├── common.ts
        ├── workorder.ts
        ├── inventory.ts
        ├── asset.ts
        ├── approval.ts
        └── user.ts
```

### 后端国际化

后端使用 Spring Boot `MessageSource` 机制：

```
backend/src/main/resources/
├── messages.properties         # 默认消息（中文简体）
└── messages_en.properties      # 英文消息
```

GlobalExceptionHandler 通过 `LocaleContextHolder.getLocale()` 获取当前语言环境。

## 模块键命名规范

### 命名规则

```
模块名:层级1.层级2.层级3
```

### 示例

| Key | 值 |
|-----|-----|
| `common:actions.save` | 保存 |
| `common:messages.loading` | 加载中… |
| `asset:list.title` | 资产台账 |
| `asset:form.fields.assetName` | 资产名称 |
| `workorder:columns.priority` | 优先级 |
| `workorder:messages.createSuccess` | 工单创建成功 |
| `user:stats.totalUsers` | 用户总量 |
| `approval:statusOptions.PENDING` | 待审批 |
| `inventory:taskList.status` | 状态 |

### 模块划分

| 模块名 | 命名空间 | 说明 |
|--------|---------|------|
| 通用 | `common` | 按钮、状态、提示、表格等通用文案 |
| 工单管理 | `workorder` | 工单列表、表单、详情、SLA |
| 资产管理 | `asset` | 资产台账、详情、表单、仪表盘 |
| 盘点管理 | `inventory` | 盘点任务、进度、明细 |
| 审批管理 | `approval` | 审批列表、详情、状态 |
| 用户管理 | `user` | 用户列表、表单、角色、岗位 |

## 迁移模式

### 函数组件中使用

```tsx
import { useTranslation } from 'react-i18next';

export default function MyComponent() {
  const { t } = useTranslation(['module', 'common']); // 加载多个 namespace

  return (
    <div>
      <h1>{t('module:list.title')}</h1>
      <button>{t('common:actions.save')}</button>
      <p>{t('module:messages.loadFailed')}</p>
      <span>{t('module:statusOptions.ACTIVE')}</span>
    </div>
  );
}
```

### 外部常量处理

对于组件外部的常量定义使用的中文，有以下处理方式：

1. **将常量迁移到组件内部** — 使用 `useTranslation` hook
2. **使用 i18n 实例** — 直接通过 `import i18n from './i18n'` 调用 `i18n.t()`
3. **延迟翻译** — 在渲染时通过 `t()` 函数调用

```tsx
// 方式 1：组件内部常量（推荐）
export default function MyPage() {
  const { t } = useTranslation('module');
  const OPTIONS = [
    { value: 'A', label: t('module:options.A') },
    { value: 'B', label: t('module:options.B') },
  ];
  // ...
}
```

```tsx
// 方式 2：外部常量使用 i18n 实例（适用于简单场景）
import i18n from '../i18n';

const STATUS_CONFIG = {
  active: { label: i18n.t('common:status.active') },
  inactive: { label: i18n.t('common:status.inactive') },
};
```

### Zod Schema 验证消息

Zod schema 中的验证消息建议使用动态方式：

```tsx
const schema = z.object({
  name: z.string().min(1, '名称不能为空'), // 保持硬编码，在组件内覆盖错误消息
});

// 在组件中：
const errorMessages = {
  '名称不能为空': t('module:validation.nameRequired'),
};
```

### Toast 消息

```tsx
// 替换前
toast.success('操作成功');

// 替换后
toast.success(t('module:messages.operationSuccess'));
```

## 部署与切换

### 语言切换

在应用初始化时设置 `i18n.changeLanguage()`：

```tsx
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
      <option value="zh-CN">中文</option>
      <option value="en">English</option>
    </select>
  );
}
```

### 默认语言

当前默认语言为 `zh-CN`，后备语言也为 `zh-CN`（英文翻译未完成时显示中文）。

## 剩余页面分批迁移计划

### 批量 1 — 核心页面（已完成）

| 页面 | 状态 |
|------|------|
| AssetListPage | ✅ 已完成 |
| AssetDetailPage | ✅ 已完成 |
| AssetFormPage | ✅ 已完成 |
| WorkOrderListPage | ✅ 已完成 |
| WorkOrderFormPage | ✅ 已完成 |
| UserManagement | ✅ 已完成 |
| InventoryTasksPage | ✅ 已完成 |

### 批量 2 — 扩展模块（待处理）

| 页面 | 优先级 | 估计工时 |
|------|--------|---------|
| InventoryDetailPage | 中 | 20 分钟 |
| ApprovalListPage | 低 | 15 分钟 |
| ApprovalDetailPage | 低 | 15 分钟 |
| DeptManagement | 低 | 20 分钟 |
| RoleManagement | 低 | 20 分钟 |

### 批量 3 — 全量覆盖（长期）

| 页面 | 优先级 | 估计工时 |
|------|--------|---------|
| 资产模块剩余页面（AssetHealthPage 等 3 个） | 低 | 45 分钟 |
| 审批模块（ApprovalDetailPage） | 低 | 15 分钟 |
| 系统管理剩余页面（MenuManagement 等 3 个） | 低 | 45 分钟 |
| 工单模块剩余页面（WorkOrderDetailPage 等 2 个） | 低 | 30 分钟 |
| 盘点模块剩余页面（ABCClassificationPage 等 4 个） | 低 | 60 分钟 |

### 注意事项

1. 英文翻译库覆盖度有限，部分 key 可能缺失英文翻译
2. 后端 GlobalExceptionHandler 的 3 处硬编码已替换为 MessageSource
3. 新增 locale 文件后需在 `frontend/src/i18n/index.ts` 注册

## 常见问题

### Q: 为什么切换语言后页面没有刷新？

A: 确保使用了 `useTranslation` hook，i18next 会监听语言变化自动触发重新渲染。
如果在组件外部使用 `i18n.t()`，需要手动监听 `languageChanged` 事件。

### Q: 如何在测试中 Mock i18n？

A: 使用 `jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))`。

### Q: 后端国际化如何工作？

A: 后端基于 Spring Boot MessageSource，通过请求头 `Accept-Language` 识别语言环境。
ResourceBundleMessageSource 配置了两个 properties 文件（messages.properties 和 messages_en.properties）。
