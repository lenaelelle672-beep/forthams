# Future Settings OS v3 页面运行时纠偏记录

> 版本日期：2026-07-02  
> 文档角色：V3 页面底座纠偏与测试失败归因记录。  
> 适用范围：后续推进 `/fixed-assets/workbenchv3`、Workbench V3 合同测试、V3 页面实现和验收前必须先读取。  
> 真实性红线：本文只记录本次审计与测试事实；不等于 V3 功能完成，不把未验证事项写成已通过。

## 1. 一句话结论

`Future Settings OS v3` 可以继续作为产品、PRD 和 IA 名称，但 V3 后端管理页面的运行时底座不是旧 Future 页面体系。

V3 runtime 主线必须以以下内容为准：

```text
V3 增强型 React/Vite 后台操作系统架构
```

也就是独立入口 `/fixed-assets/workbenchv3`、独立页面 `WorkbenchV3Page.tsx`、`SystemPageHost activeMenu` 真组件承载、registry 驱动和 V3 本地建设中占位。

## 2. 正确的 V3 Runtime 底座

| 维度 | 正确口径 |
| --- | --- |
| 路由入口 | `/fixed-assets/workbenchv3` |
| 页面文件 | `frontend/src/pages/workbench-v3/WorkbenchV3Page.tsx` |
| 真页面承载 | `SystemPageHost activeMenu` |
| 真实页面判断 | `systemRealPageRegistry` / `isSystemRealPageMenuId` |
| Inspector | `SystemInspectorSlotProvider` |
| 未实现菜单 | V3 本地“建设中 + 架构契约 + 后续接口”占位 |
| IA 范围 | 6 个顶部分类、44 个左侧 IA 菜单 |
| 权限口径 | 当前 P0 不把 `/fixed-assets/workbenchv3` 加入 `routePermissions.ts` |

后续 V3 页面实现、测试和验收应优先回到这条主线。

## 3. 不再作为 V3 主线的旧体系

以下内容只能作为历史参考、视觉参考或旧入口兜底，不能作为 V3 runtime 主实现或完成证据：

- `frontend/src/pages/workspace-preview/WorkspacePreviewPage.tsx`
- 旧入口 `/fixed-assets/workbench`
- `future-settings-os-*.html`
- System Hub HTML mock / iframe 页面
- Stitch 设计稿、截图、HTML 演示
- 旧 WorkspacePreview 内部的 Future/System Hub visual contract

除非用户另开“旧 Workbench / WorkspacePreview 迁移或收敛”任务，否则不要为了推进 V3 P0 去修改旧 `WorkspacePreviewPage.tsx`。

## 4. 本次测试事实

### V3 P0 合同测试通过

在 `frontend` 目录运行：

```sh
pnpm exec vitest run src/__tests__/workbenchPlatformEntry.contract.test.ts -t "Workbench V3" --reporter=dot
```

结果：

```text
Test Files  1 passed (1)
Tests       3 passed | 18 skipped (21)
```

这说明 `WorkbenchV3Page.tsx` 中与 V3 独立壳相关的 P0 合同断言当前是通过的。

### 完整 Workbench 合同测试失败

在 `frontend` 目录运行：

```sh
pnpm exec vitest run src/__tests__/workbenchPlatformEntry.contract.test.ts --reporter=dot
```

结果：

```text
Test Files  1 failed (1)
Tests       5 failed | 16 passed (21)
```

完整输出保存于：

```text
/Users/feigao/.local/share/opencode/tool-output/tool_f2115b358001SmirD1C3Xo12xj
```

## 5. 5 个失败项归因

| 失败项 | 失败事实 | 归因 |
| --- | --- | --- |
| `requires every System Hub menu to have matching IMAGE2 and Stitch subpage assets` | 期望 44，实际 46 | 旧 `WorkspacePreviewPage` 的 System Hub 菜单仍是 46 项，不等于 V3 44 IA。 |
| `keeps delivery manifest aligned with the System Hub IMAGE2 assets declared in the page` | 期望 45，实际 47 | 旧 manifest 与旧页面菜单数量仍绑定，包含额外历史项。 |
| `keeps System Hub pages on dedicated configurator branches instead of generic-only shells` | 期望 `WorkspacePreviewPage` 包含 `image2: 'system-params-subpage-07-doc-center-v1'`，但源码已不含 | 旧 Future/System Hub visual contract 已与当前旧页面源码漂移。 |
| `scopes System Hub visual repairs away from external Workbench pages` | 期望 44，实际 46 | 测试仍从旧 `WorkspacePreviewPage` 收集菜单，而不是从 V3 独立壳收集。 |
| `keeps every System Hub menu represented in browser smoke for create-save-submit operation` | 旧页面收集到 `system-form-center` / `system-form-designer`，与 V3 IA 的 `system-form-config` / `system-form-storage` 口径不一致 | 表单相关菜单存在旧页面双轨命名，不应作为 V3 P0 口径。 |

## 6. 根因

`frontend/src/__tests__/workbenchPlatformEntry.contract.test.ts` 目前同时承担两类合同：

1. 旧 Workbench / WorkspacePreview / Future System Hub 视觉合同。
2. V3 独立壳 `/fixed-assets/workbenchv3` 合同。

这导致旧 `WorkspacePreviewPage` 的 46 项菜单、表单双轨和 manifest 47 项问题，污染了 V3 P0 的 44 IA 验收口径。

因此，完整合同测试失败不能直接解释为 V3 runtime 失败。当前事实是：V3 独立壳相关合同通过，旧 Workbench/System Hub 合同存在漂移。

## 7. 后续执行规则

后续推进 V3 时必须遵守：

1. V3 实现和验收以 `WorkbenchV3Page.tsx`、`SystemPageHost`、`systemRealPageRegistry` 和 44 IA 为准。
2. 不把旧 `WorkspacePreviewPage.tsx` 的 Future/System Hub 菜单数量当作 V3 source of truth。
3. 不把 `future-settings-os-*.html`、Stitch、截图或 iframe 当作 V3 完成证据。
4. V3 P0 合同应从旧 WorkspacePreview 视觉合同中隔离，避免一份测试同时表达两个运行时体系。
5. 如果需要收敛旧 `WorkspacePreviewPage` 的 46 项、manifest 47 项或表单双轨，必须另开旧页迁移任务。
6. 如果后续修改测试，只允许分离归因和 V3 scope，不允许削弱旧页面已有保障。
7. 继续遵守 mobile 冻结：不修改 `frontend/src/pages/mobile/**`。
8. 继续遵守敏感信息红线：不复制、不记录 secrets、token、password、API key。

## 8. 建议下一步

优先新增或拆分一个 V3 专用合同测试，直接验证：

- `/fixed-assets/workbenchv3` 路由存在。
- `WorkbenchV3Page.tsx` 包含 6 个顶部分类。
- `WorkbenchV3Page.tsx` 包含 44 个 V3 IA 菜单。
- 真组件菜单使用 `SystemPageHost activeMenu`。
- 未登记菜单显示 V3 本地建设中占位。
- V3 当前 P0 不依赖旧 `WorkspacePreviewPage.tsx`。
- V3 当前 P0 不新增 `/fixed-assets/workbenchv3` route permission。

旧 `WorkspacePreviewPage` 的 Future/System Hub 视觉合同保留为旧体系专项，不再混入 V3 runtime 完成判断。
