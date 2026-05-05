# 前端开发指南

## 技术栈

- **React**: 18.3.1
- **React Router**: 7 (数据模式)
- **Tailwind CSS**: v4
- **Vite**: 6.3.5
- **图表库**: Recharts
- **UI组件**: Radix UI
- **图标库**: Lucide React

## 项目结构

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/       # 公共组件
│   │   │   ├── ui/          # UI基础组件
│   │   │   ├── RootLayout.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   ├── MaintenanceCalendar.tsx
│   │   │   └── AssetDetailModal.tsx
│   │   ├── pages/           # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AssetRegistry.tsx
│   │   │   ├── ImportantEquipment.tsx
│   │   │   ├── RFIDInventory.tsx
│   │   │   ├── IdleAssets.tsx
│   │   │   ├── Compensation.tsx
│   │   │   ├── Approval.tsx
│   │   │   ├── Analytics.tsx
│   │   │   └── Settings.tsx
│   │   ├── App.tsx
│   │   └── routes.ts        # 路由配置
│   ├── styles/              # 样式文件
│   └── main.tsx             # 入口文件
├── package.json
├── vite.config.ts
└── README.md
```

## 快速开始

### 安装依赖

```bash
cd frontend
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问: http://localhost:5173

### 构建生产版本

```bash
npm run build
```

## 核心功能页面

### 1. Dashboard (/)
- 数据统计卡片
- 资产变动趋势图
- 重要设备使用率
- 最近动态时间线
- 待审批事项
- 快捷操作面板

### 2. 资产台账 (/assets)
- 资产列表展示
- 筛选与搜索
- 新增/编辑资产
- 批量导入导出
- 资产详情模态框

### 3. 重要设备 (/equipment)
- 设备列表
- 维护保养记录
- 智能保养提醒
- 设备使用率统计

### 4. RFID盘点 (/inventory)
- 盘点任务管理
- RFID批量扫描
- 盘点进度追踪
- 差异处理

### 5. 闲置资产 (/idle)
- 闲置资产列表
- 闲置公告管理
- 认领流程
- 处置记录

### 6. 资产赔偿 (/compensation)
- 赔偿申请列表
- 赔偿类型统计
- 部门赔偿分析

### 7. 审批流程 (/approval)
- 待办事项
- 审批历史
- 工单管理
- 流程跟踪

### 8. 数据分析 (/analytics)
- 资产价值趋势
- 分类分布分析
- 部门资产统计
- 维护费用分析

### 9. 系统设置 (/settings)
- 用户管理
- 角色权限
- 部门管理
- 系统集成

## API 集成

### 配置 API Base URL

在 `vite.config.ts` 中配置代理:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
```

### API 请求示例

```typescript
// utils/request.ts
const request = async (url: string, options?: RequestInit) => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api' + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options?.headers
    }
  });
  return response.json();
};

// 使用示例
const getAssets = () => request('/assets/list');
```

## 状态管理

目前使用 React 本地状态和 Context API。
如需全局状态管理，推荐集成:
- Zustand (轻量)
- Redux Toolkit (功能完整)

## 下一步开发

1. ✅ 集成后端 API
2. ✅ 实现用户认证与登录
3. ✅ 实现资产CRUD功能
4. ⏭️ 实现RFID扫描集成
5. ⏭️ 实现流程设计器
6. ⏭️ 实现数据导入导出
7. ⏭️ 优化移动端体验

## 注意事项

- 所有日期时间格式统一使用: `YYYY-MM-DD HH:mm:ss`
- 金额格式保留2位小数
- 文件上传大小限制: 10MB
- RFID扫描需要硬件设备支持

## 开发规范

- 组件命名使用 PascalCase
- 文件命名与组件名一致
- 样式使用 Tailwind CSS 工具类
- 避免内联样式,必要时使用 CSS Modules
- 提交前运行 `npm run build` 确保无错误
