# 边界用例与异常推演文档 — 迭代14

## 推演范围

本推演覆盖迭代14 新增/修改的全部功能模块：
- AssetFormPage schema 字段补充（supplier, currentValue, assetNo）
- VendorFormPage / VendorFormDialog RHF+zodResolver 升级
- CategoryManagerPage 资产分类管理页面新建

---

## 场景 1：分类下有资产时删除分类

**触发条件：** 用户在 CategoryManagerPage 中尝试删除一个被资产引用的分类。

**预期行为：**
- 后端当前是物理删除（DELETE FROM asset_category WHERE id = ?），无软删除。
- 若资产表中的 category_id 引用了该分类且无外键约束 → 删除成功但资产变为"孤儿数据"（category_id 指向不存在的分类）。
- 若存在外键约束 → 数据库抛出外键违反异常，后端应捕获并返回友好错误信息。

**实际行为（待验证）：**
- 后端 AssetCategoryService.deleteCategory() 执行物理删除。
- AssetCategoryMapper 未检查资产引用关系。
- 前端 deleteMutation.onError 已配置 toast.error("删除失败，该分类下可能有关联资产")。

**改进建议：**
1. 后端应改为逻辑删除（deleted=1），与 AssetCategory 实体的 `deleted` 字段设计一致。
2. 或在删除前检查 `SELECT COUNT(*) FROM asset WHERE category_id = ?`，若 >0 则拒绝删除。
3. 前端应在 delete 确认弹窗中更明确提示："删除分类可能导致关联资产分类数据丢失"。

---

## 场景 2：VendorFormPage 编辑模式下 404 场景

**触发条件：** 用户编辑一个已被其他用户删除的供应商（/vendors/{id}/edit）。

**预期行为：**
- vendorService.getVendorById(id) 发送 GET /api/vendors/{id}。
- 后端返回 404 → http 拦截器捕获后抛出 error。
- catch 块设置 fetchError 并 toast.error。
- 页面显示错误提示 + 返回按钮，不崩溃。

**实际行为：**
- fetchError 状态用于展示错误区域（红色 alert）。
- vendorService.getVendorById 通过 api.ts 封装：非 200 响应码抛出 Error(message)。
- 404 时 api.ts 拦截器将错误转为异常，被 catch 捕获。
- ✅ 当前实现正确覆盖此场景。

**改进建议：**
- 可考虑在错误提示区域添加"返回列表"按钮，改善用户体验。

---

## 场景 3：CategoryCode 唯一性冲突时 BusinessException 的前端展示

**触发条件：** 用户创建或更新分类时，填写了已存在的 categoryCode。

**预期行为：**
- 后端抛出 BusinessException（或 DataIntegrityViolationException）。
- 全局异常处理器 GlobalExceptionHandler 拦截并返回 { code: 400, message: "分类编码已存在", data: null }。
- 前端 api.ts request 函数检查 response.data.code !== 200 → 抛出 Error(response.data.message)。
- mutation.onError 捕获错误并 toast.error("分类编码已存在")。

**实际行为：**
- 后端可能需要确认：AssetCategoryService.createCategory/updateCategory 中是否有唯一性校验。若数据库有唯一索引，则会抛出 DataIntegrityViolationException。
- 前端 createMutation.onError 已有 toast.error(err.message)。
- ✅ 基本覆盖，错误信息会透传到用户。

**改进建议：**
- 后端建议在 Service 层显式检查唯一性，而不是依赖数据库异常，以提供更准确的中文错误提示。
- 前端可在 categoryCode 输入框下方添加"编码唯一"的提示文案。

---

## 场景 4：网络超时/断网时 mutation 的错误兜底

**触发条件：** 用户提交表单时网络断开或请求超时（api.ts timeout: 10000ms）。

**预期行为：**
- api.ts 的 axios 实例配置了 timeout: 10000。
- 超时后 axios 抛出 AxiosError → 拦截器进入 error 处理分支 → 返回 Promise.reject(new Error(message))。
- mutation.onError 捕获错误 → toast.error(err.message)。
- 所有表单均保持 isSubmitting=false，用户可重试。

**覆盖分析：**
- AssetFormPage: catch 块用 setSubmitError(msg) 展示错误，button 未设置 loading 状态回退。✅
- VendorFormPage: catch 块 toast.error(message)。✅
- CategoryManagerPage: createMutation/updateMutation/deleteMutation 都有 onError → toast.error。✅
- VendorFormDialog: onFormSubmit 中调用 onSubmit(props 传入)，异常由父组件处理。⚠️ 需要确认父组件是否有错误处理。

**改进建议：**
- VendorFormDialog 的父组件应确保 onSubmit 被包裹在 try-catch 中，否则异常将未被处理（unhandled promise rejection）。

---

## 场景 5：表单字段类型错误时的 RHF 错误展示

**触发条件：** 用户输入非法类型值（如"abc"作为 number 字段输入）。

**覆盖分析：**
- **VendorFormPage（新 RHF）：** name 为字符串无类型问题；contactEmail 有 z.string().email() 校验；其余字段为字符串无类型问题。cor 类型使用 z.coerce.number()。当用户输入非数字时，z.coerce.number() 返回 NaN，RHF 显示校验错误。
- **AssetFormPage（RHF 已存在）：** originalValue 使用 z.coerce.number().nonnegative()，输入 "abc" → NaN → 校验失败（"原值不能为负数"，类型错误时 NaN 不满足 nonnegative）。⚠️ 消息不准确，应为"请输入有效数字"。
- **CategoryManagerPage 弹窗：** sortOrder 使用原生 input type="number"，浏览器原生校验非数字输入。提交后 Number(e.target.value) 转为 0（若值为 NaN）。

**改进建议：**
- AssetFormPage 的 schema 中对 number 字段的报错信息应区分 "类型错误" 和 "范围错误"：可使用 z.coerce.number({ invalid_type_error: "请输入有效数字" }).nonnegative("不能为负数")。

---

## 场景 6：并发编辑导致的数据覆盖

**触发条件：** 用户 A 和用户 B 同时打开同一供应商编辑页面，A 先保存，B 后保存。

**预期行为：**
- B 的 PUT /api/vendors/{id} 请求覆盖 A 的修改（最后写入者获胜）。
- 后端无乐观锁或版本控制。

**实际行为：**
- 后端 VendorService.updateVendor 使用 MyBatis-Plus 的 updateById，直接覆盖。
- 前端无版本号（version）字段或更新前校验。
- ⚠️ 存在数据覆盖风险。

**改进建议：**
- 后端可在 Vendor 实体中添加 @Version 字段启用 MyBatis-Plus 乐观锁。
- 前端编辑页面加载时，可在表单下方显示"最后更新时间：{updateTime}"提示。

---

## 场景 7：分页切换时搜索条件丢失

**触发条件：** 用户在 CategoryManagerPage 中输入搜索关键词，然后翻到第二页，再修改搜索关键词。

**预期行为：**
- 搜索和分页状态分离：搜索输入 → setKeyword + setPage(1)（重置到第一页）。
- 翻页仅改变 page，不清空 keyword。
- 修改搜索条件自动重置 page 为 1。

**实际行为：**
- handleSearchInput 使用 300ms 防抖，调用 setkeyword + setPage(1)。✅
- 分页按钮调用 setPage 不修改 keyword。✅
- queryKey 为 ["categories", "list", page, keyword]，page 和 keyword 任一变化触发重新查询。✅

**改进建议：**
- 防抖函数返回的 cleanup 函数未被调用。当前 setSearchInput 触发后 300ms 才 setKeyword，若快速多次输入，只有最后一次生效 — 这实际上是预期行为。但存在的轻微问题是：handleSearchInput 中定义的 timer 不会被清理。

---

## 场景 8：CategoryManagerPage 树形选择器排除自身

**触发条件：** 编辑分类时，父级选择器中不应允许选择自己（否则形成自引用环）。

**预期行为：**
- flattenTree 函数中已有排除逻辑：`if (!editingCategory || node.id !== editingCategory.id)`。
- ✅ 编辑模式下不会显示当前分类本身作为父级选项。

**改进建议：**
- 还应排除当前分类的所有子分类，以防止间接环引用。当前 flattenTree 仅排除自身，未递归排除子孙节点。

---

## 总结

| 场景 | 风险等级 | 现有防护 | 改进优先级 |
|------|---------|---------|-----------|
| 1. 分类删除导致孤儿资产 | 高 | 前端提示 | 高 — 后端应改为逻辑删除 |
| 2. Vendor 404 编辑 | 中 | 错误提示 + toast | 低 — 当前实现可接受 |
| 3. 分类编码冲突 | 中 | 全局异常处理 | 中 — 后端应显式校验 |
| 4. 网络超时 | 中 | 全部有错误处理 | 中 — VendorFormDialog 需确认 |
| 5. 字段类型错误 | 低 | RHF 校验 | 低 — 可优化错误消息 |
| 6. 并发编辑覆盖 | 中 | 无 | 高 — 建议加乐观锁 |
| 7. 分页搜索状态 | 低 | 状态分离 | 低 — 当前实现正确 |
| 8. 树形自引用 | 中 | 排除自身 | 中 — 应排除子孙节点 |
