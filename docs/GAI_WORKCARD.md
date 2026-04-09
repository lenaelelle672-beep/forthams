# GAI Phase 4: Workcard - 详细执行计划

**生成时间**: 2026-04-01  
**制定人**: OpenClaw GAI Orchestrator  
**项目**: forthAMS 企业资产管理系统补全与测试

---

## Workcard概述 (Overview)

### 项目目标
在无人值守模式下，完成forthAMS系统80%缺失功能的补全，并为每个功能模块实现专业的单元测试，最终生成完整的测试文档用于后续反查。

### 执行原则
1. **自动化优先**: 所有可自动化的任务必须自动化
2. **分批交付**: 每个批次都是可验证的增量
3. **质量保障**: 测试与功能同步开发
4. **文档化**: 每个模块生成独立测试文档

### 时间规划
- **总工期**: 5周 (35个工作日)
- **执行模式**: 无人值守自动化执行
- **验收节点**: 每批次完成后自动验证

---

## 批次规划 (Batch Planning)

### Batch 0: 环境准备与修复 (3天) 🔧

**目标**: 修复现有代码的编译错误，搭建测试框架

#### 0.1 修复LSP错误 (1天)

**问题清单**:
1. DTOs缺少Lombok注解 (@Data, @Getter, @Setter)
2. Service层缺少@RequiredArgsConstructor注解
3. Entity类缺少getter方法

**执行任务**:
- [ ] 修复Asset.java (添加Lombok注解)
- [ ] 修复所有DTOs (添加@Data注解)
- [ ] 修复Service层 (添加@RequiredArgsConstructor)
- [ ] 运行 `mvn clean compile` 验证

**验收标准**: 后端编译无错误

#### 0.2 搭建测试框架 (1天)

**后端测试配置**:
```xml
<!-- pom.xml 添加测试依赖 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>test</scope>
</dependency>
```

**前端测试配置**:
```json
// package.json 添加测试依赖
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:e2e": "playwright test",
    "test:coverage": "vitest --coverage"
  }
}
```

**执行任务**:
- [ ] 后端: 创建 src/test/java 目录结构
- [ ] 后端: 创建 application-test.properties
- [ ] 前端: 安装测试依赖
- [ ] 前端: 创建 vitest.config.ts
- [ ] 前端: 创建 playwright.config.ts
- [ ] 运行测试框架验证

**验收标准**: `mvn test` 和 `npm run test` 可运行

#### 0.3 创建测试模板 (1天)

**后端测试模板**:
```java
// ControllerTestTemplate.java
@WebMvcTest(XxxController.class)
class XxxControllerTest {
    @Autowired private MockMvc mockMvc;
    @MockBean private XxxService service;
    
    @Test
    void testCreate() throws Exception {
        // Given
        // When
        // Then
    }
}

// ServiceTestTemplate.java
@ExtendWith(MockitoExtension.class)
class XxxServiceTest {
    @Mock private XxxMapper mapper;
    @InjectMocks private XxxService service;
    
    @Test
    void testBizMethod() {
        // Given
        // When
        // Then
    }
}
```

**前端测试模板**:
```typescript
// ComponentTestTemplate.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('XxxComponent', () => {
  it('should handle button click', async () => {
    // Arrange
    // Act
    // Assert
  });
});

// E2ETestTemplate.spec.ts
import { test, expect } from '@playwright/test';

test('complete workflow', async ({ page }) => {
  // Navigate
  // Interact
  // Verify
});
```

**执行任务**:
- [ ] 创建测试模板文件
- [ ] 创建测试文档模板 (Markdown)
- [ ] 创建测试代码生成脚本

**验收标准**: 模板文件可复用

---

### Batch 1: 高优先级基础模块 (7天) 🚀

**目标**: 完成基础CRUD模块，实现前端API集成

#### 1.1 后端: AssetCategory模块 (1天)

**功能需求**:
- 分类CRUD (增删改查)
- 分类树形结构查询
- 分类关联资产统计

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/AssetCategoryController.java
├── service/AssetCategoryService.java
├── mapper/AssetCategoryMapper.java
├── entity/AssetCategory.java (已存在表)
└── dto/
    ├── AssetCategoryCreateDTO.java
    ├── AssetCategoryUpdateDTO.java
    └── AssetCategoryTreeDTO.java
```

**API接口**:
- POST /api/categories - 创建分类
- PUT /api/categories/{id} - 更新分类
- DELETE /api/categories/{id} - 删除分类
- GET /api/categories/{id} - 获取详情
- GET /api/categories/list - 分页列表
- GET /api/categories/tree - 树形结构

**测试清单**:
- [ ] AssetCategoryControllerTest (6个测试方法)
- [ ] AssetCategoryServiceTest (8个测试方法)
- [ ] AssetCategoryMapperTest (4个测试方法)
- [ ] 集成测试 (2个完整流程)

**测试文档**: `docs/testing/01_AssetCategory_Test_Report.md`

#### 1.2 后端: User管理模块 (1天)

**功能需求**:
- 用户CRUD (增删改查)
- 用户角色绑定
- 用户状态管理
- 修改密码

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/UserController.java
├── service/UserService.java
├── dto/
    ├── UserCreateDTO.java
    ├── UserUpdateDTO.java
    ├── UserQueryDTO.java
    └── ChangePasswordDTO.java
```

**API接口**:
- POST /api/users - 创建用户
- PUT /api/users/{id} - 更新用户
- DELETE /api/users/{id} - 删除用户
- GET /api/users/{id} - 获取详情
- GET /api/users/list - 分页列表
- POST /api/users/{id}/roles - 绑定角色
- POST /api/users/{id}/password - 修改密码

**测试清单**:
- [ ] UserControllerTest (7个测试方法)
- [ ] UserServiceTest (10个测试方法)
- [ ] 集成测试 (3个完整流程)

**测试文档**: `docs/testing/02_User_Management_Test_Report.md`

#### 1.3 后端: Dept管理模块 (0.5天)

**功能需求**:
- 部门CRUD
- 部门树形结构

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/DeptController.java
├── service/DeptService.java
├── dto/DeptDTO.java
```

**API接口**:
- POST /api/depts - 创建部门
- PUT /api/depts/{id} - 更新部门
- DELETE /api/depts/{id} - 删除部门
- GET /api/depts/{id} - 获取详情
- GET /api/depts/tree - 树形结构

**测试清单**:
- [ ] DeptControllerTest (5个测试方法)
- [ ] DeptServiceTest (6个测试方法)

**测试文档**: `docs/testing/03_Department_Management_Test_Report.md`

#### 1.4 后端: Role管理模块 (0.5天)

**功能需求**:
- 角色CRUD
- 角色权限绑定

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/RoleController.java
├── service/RoleService.java
├── dto/RoleDTO.java
```

**API接口**:
- POST /api/roles - 创建角色
- PUT /api/roles/{id} - 更新角色
- DELETE /api/roles/{id} - 删除角色
- GET /api/roles/list - 列表查询
- POST /api/roles/{id}/permissions - 绑定权限

**测试清单**:
- [ ] RoleControllerTest (5个测试方法)
- [ ] RoleServiceTest (6个测试方法)

**测试文档**: `docs/testing/04_Role_Management_Test_Report.md`

#### 1.5 前端: API服务集成 (2天)

**目标**: 连接前端所有现有页面到真实后端API

**任务清单**:

##### 1.5.1 创建Service层 (0.5天)
```typescript
// frontend/src/app/services/categoryService.ts
export const categoryService = {
  getTree: () => api.get('/categories/tree'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// frontend/src/app/services/userService.ts
// frontend/src/app/services/deptService.ts
// frontend/src/app/services/roleService.ts
```

##### 1.5.2 替换Mock数据 (1天)
- [ ] AssetRegistry.tsx - 使用assetService
- [ ] Dashboard.tsx - 使用dashboardService
- [ ] Settings.tsx - 使用userService/deptService/roleService

##### 1.5.3 实现按钮Handler (0.5天)
```typescript
// 示例: AssetRegistry.tsx
const handleSave = async (formData) => {
  try {
    setLoading(true);
    if (editId) {
      await assetService.update(editId, formData);
      toast.success('更新成功');
    } else {
      await assetService.create(formData);
      toast.success('创建成功');
    }
    refreshList();
    closeDialog();
  } catch (error) {
    toast.error('操作失败: ' + error.message);
  } finally {
    setLoading(false);
  }
};
```

**需要实现的Handler**:
- [ ] 所有"保存"按钮 (8个页面)
- [ ] 所有"删除"按钮 (6个页面)
- [ ] 所有"搜索"按钮 (7个页面)
- [ ] 所有"提交"按钮 (5个页面)

#### 1.6 前端: 组件测试 (2天)

**目标**: 为所有UI组件编写测试

**测试清单**:
- [ ] AssetRegistry.test.tsx (10个测试用例)
  - [ ] 渲染资产列表
  - [ ] 搜索框输入触发查询
  - [ ] 点击"新建"按钮打开对话框
  - [ ] 填写表单并保存
  - [ ] 点击"编辑"按钮
  - [ ] 点击"删除"按钮并确认
  - [ ] 筛选器变更触发查询
  - [ ] 导出按钮点击
  - [ ] 分页切换
  - [ ] 表单验证错误提示

- [ ] Dashboard.test.tsx (6个测试用例)
- [ ] Settings.test.tsx (8个测试用例)
- [ ] ImportantEquipment.test.tsx (预留，Batch 2实现)
- [ ] RFIDInventory.test.tsx (预留，Batch 2实现)
- [ ] IdleAssets.test.tsx (预留，Batch 2实现)
- [ ] Approval.test.tsx (预留，Batch 3实现)
- [ ] Analytics.test.tsx (4个测试用例)

**测试文档**: 
- `docs/testing/05_Frontend_Component_Tests.md`
- `docs/testing/06_Button_Handler_Tests.md`
- `docs/testing/07_Search_Box_Tests.md`
- `docs/testing/08_Form_Submission_Tests.md`

---

### Batch 2: 核心业务模块 (10天) 💼

**目标**: 实现维护、盘点、闲置资产三大核心业务模块

#### 2.1 后端: Maintenance模块 (3天)

**功能需求**:
- 维护记录CRUD
- 维护计划管理
- 保养提醒逻辑
- 维护统计分析

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/MaintenanceController.java
├── service/MaintenanceService.java
├── mapper/MaintenanceMapper.java
├── dto/
    ├── MaintenanceRecordDTO.java
    ├── MaintenancePlanDTO.java
    └── MaintenanceStatsDTO.java
```

**API接口**:
- POST /api/maintenance/records - 创建维护记录
- GET /api/maintenance/records/list - 维护记录列表
- POST /api/maintenance/plans - 创建维护计划
- GET /api/maintenance/reminders - 保养提醒列表
- GET /api/maintenance/stats - 维护统计

**测试清单**:
- [ ] MaintenanceControllerTest (8个测试方法)
- [ ] MaintenanceServiceTest (12个测试方法)
- [ ] 集成测试 (4个完整流程)

**测试文档**: `docs/testing/09_Maintenance_Module_Test_Report.md`

#### 2.2 后端: Inventory模块 (4天)

**功能需求**:
- 盘点任务管理
- RFID扫描集成 (模拟)
- 差异处理流程
- 盘点报告生成

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/InventoryController.java
├── service/InventoryService.java
├── mapper/
    ├── InventoryTaskMapper.java
    └── InventoryDetailMapper.java
├── dto/
    ├── InventoryTaskDTO.java
    ├── InventoryDetailDTO.java
    ├── InventoryReportDTO.java
    └── RFIDScanDTO.java
```

**API接口**:
- POST /api/inventory/tasks - 创建盘点任务
- GET /api/inventory/tasks/list - 盘点任务列表
- POST /api/inventory/tasks/{id}/scan - RFID扫描
- GET /api/inventory/tasks/{id}/report - 盘点报告
- POST /api/inventory/tasks/{id}/handle-discrepancy - 处理差异

**测试清单**:
- [ ] InventoryControllerTest (10个测试方法)
- [ ] InventoryServiceTest (15个测试方法)
- [ ] RFID扫描模拟测试 (3个场景)
- [ ] 差异处理流程测试 (4个场景)
- [ ] 集成测试 (5个完整流程)

**测试文档**: `docs/testing/10_Inventory_Module_Test_Report.md`

#### 2.3 后端: IdleAsset模块 (2天)

**功能需求**:
- 闲置资产识别
- 闲置公告发布
- 认领流程
- 处置管理

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/IdleAssetController.java
├── service/IdleAssetService.java
├── mapper/IdleAssetMapper.java
├── dto/
    ├── IdleAssetNoticeDTO.java
    └── IdleAssetClaimDTO.java
```

**API接口**:
- GET /api/idle-assets/detect - 识别闲置资产
- POST /api/idle-assets/notices - 发布闲置公告
- GET /api/idle-assets/notices/list - 公告列表
- POST /api/idle-assets/notices/{id}/claim - 认领资产
- POST /api/idle-assets/notices/{id}/dispose - 处置资产

**测试清单**:
- [ ] IdleAssetControllerTest (7个测试方法)
- [ ] IdleAssetServiceTest (10个测试方法)
- [ ] 集成测试 (3个完整流程)

**测试文档**: `docs/testing/11_IdleAsset_Module_Test_Report.md`

#### 2.4 前端: 业务模块集成 (1天)

**任务清单**:
- [ ] ImportantEquipment.tsx - 连接maintenanceService
- [ ] RFIDInventory.tsx - 连接inventoryService
- [ ] IdleAssets.tsx - 连接idleAssetService
- [ ] 实现所有按钮Handler
- [ ] 添加表单验证

**测试文档**: `docs/testing/12_Business_Module_Integration_Tests.md`

---

### Batch 3: 高级功能模块 (7天) ⚙️

**目标**: 实现审批流程、赔偿管理、文件附件

#### 3.1 后端: Compensation模块 (2天)

**功能需求**:
- 赔偿申请CRUD
- 赔偿统计

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/CompensationController.java
├── service/CompensationService.java
├── mapper/CompensationMapper.java
├── dto/CompensationDTO.java
```

**API接口**:
- POST /api/compensations - 创建赔偿申请
- GET /api/compensations/list - 赔偿申请列表
- GET /api/compensations/stats - 赔偿统计

**测试清单**:
- [ ] CompensationControllerTest (6个测试方法)
- [ ] CompensationServiceTest (8个测试方法)
- [ ] 集成测试 (2个完整流程)

**测试文档**: `docs/testing/13_Compensation_Module_Test_Report.md`

#### 3.2 后端: Approval模块 (3天)

**功能需求**:
- 审批流程引擎
- 工单管理
- 审批历史

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/ApprovalController.java
├── service/
    ├── ApprovalService.java
    └── WorkflowEngine.java
├── mapper/
    ├── ApprovalProcessMapper.java
    └── ApprovalRecordMapper.java
├── dto/
    ├── ApprovalProcessDTO.java
    ├── ApprovalRecordDTO.java
    └── ApprovalActionDTO.java
```

**API接口**:
- POST /api/approvals/processes - 发起审批
- GET /api/approvals/processes/list - 审批列表
- POST /api/approvals/processes/{id}/approve - 批准
- POST /api/approvals/processes/{id}/reject - 拒绝
- GET /api/approvals/processes/{id}/history - 审批历史

**测试清单**:
- [ ] ApprovalControllerTest (8个测试方法)
- [ ] ApprovalServiceTest (12个测试方法)
- [ ] WorkflowEngineTest (10个测试方法)
- [ ] 集成测试 (5个完整流程)

**测试文档**: `docs/testing/14_Approval_Module_Test_Report.md`

#### 3.3 后端: Attachment模块 (1天)

**功能需求**:
- 文件上传
- 文件下载
- 文件关联业务实体

**代码清单**:
```
backend/src/main/java/com/ams/
├── controller/AttachmentController.java
├── service/AttachmentService.java
├── mapper/AttachmentMapper.java
├── dto/AttachmentDTO.java
```

**API接口**:
- POST /api/attachments/upload - 上传文件
- GET /api/attachments/{id}/download - 下载文件
- GET /api/attachments/list - 文件列表
- DELETE /api/attachments/{id} - 删除文件

**测试清单**:
- [ ] AttachmentControllerTest (5个测试方法)
- [ ] AttachmentServiceTest (6个测试方法)
- [ ] 文件上传下载集成测试 (3个场景)

**测试文档**: `docs/testing/15_Attachment_Module_Test_Report.md`

#### 3.4 前端: 高级功能集成 (1天)

**任务清单**:
- [ ] Approval.tsx - 连接approvalService
- [ ] 所有页面 - 添加文件上传组件
- [ ] 实现所有保存按钮Handler
- [ ] 添加错误处理和用户反馈

**测试文档**: `docs/testing/16_Advanced_Features_Integration_Tests.md`

---

### Batch 4: E2E测试与文档完善 (5天) 📋

**目标**: 完整E2E测试覆盖，生成所有测试文档

#### 4.1 E2E测试开发 (3天)

**关键业务流程**:

##### 流程1: 完整资产管理流程 (0.5天)
```typescript
// tests/e2e/asset-management-flow.spec.ts
test('complete asset management flow', async ({ page }) => {
  // 1. 登录
  await page.goto('/login');
  await page.fill('[name="username"]', 'admin');
  await page.fill('[name="password"]', 'admin123');
  await page.click('button:has-text("登录")');
  
  // 2. 创建资产分类
  await page.click('text=系统设置');
  await page.click('text=资产分类');
  await page.click('button:has-text("新建分类")');
  await page.fill('[name="categoryName"]', 'E2E测试分类');
  await page.click('button:has-text("保存")');
  await expect(page.locator('text=创建成功')).toBeVisible();
  
  // 3. 创建资产
  await page.click('text=资产台账');
  await page.click('button:has-text("新建资产")');
  await page.fill('[name="assetNo"]', 'E2E-TEST-001');
  await page.fill('[name="assetName"]', 'E2E测试资产');
  await page.selectOption('[name="categoryId"]', { label: 'E2E测试分类' });
  await page.fill('[name="originalValue"]', '10000');
  await page.click('button:has-text("保存")');
  await expect(page.locator('text=创建成功')).toBeVisible();
  
  // 4. 搜索资产
  await page.fill('[placeholder="搜索资产编号"]', 'E2E-TEST');
  await page.click('button:has-text("搜索")');
  await expect(page.locator('text=E2E-TEST-001')).toBeVisible();
  
  // 5. 编辑资产
  await page.click('text=E2E-TEST-001');
  await page.click('button:has-text("编辑")');
  await page.fill('[name="currentValue"]', '9500');
  await page.click('button:has-text("保存")');
  await expect(page.locator('text=更新成功')).toBeVisible();
  
  // 6. 删除资产
  await page.click('button:has-text("删除")');
  await page.click('button:has-text("确认")');
  await expect(page.locator('text=删除成功')).toBeVisible();
  
  // 7. 验证软删除
  await page.fill('[placeholder="搜索资产编号"]', 'E2E-TEST');
  await page.click('button:has-text("搜索")');
  await expect(page.locator('text=E2E-TEST-001')).not.toBeVisible();
});
```

##### 流程2: RFID盘点流程 (0.5天)
```typescript
// tests/e2e/rfid-inventory-flow.spec.ts
test('complete rfid inventory flow', async ({ page }) => {
  // 1. 创建盘点任务
  // 2. 执行RFID扫描
  // 3. 处理差异
  // 4. 生成报告
  // 5. 完成盘点
});
```

##### 流程3: 审批流程 (0.5天)
```typescript
// tests/e2e/approval-flow.spec.ts
test('complete approval flow', async ({ page }) => {
  // 1. 提交审批申请
  // 2. 一级审批批准
  // 3. 二级审批批准
  // 4. 查看审批历史
});
```

##### 流程4: 维护管理流程 (0.5天)
##### 流程5: 闲置资产流程 (0.5天)
##### 流程6: 用户权限管理流程 (0.5天)

**测试清单**:
- [ ] 6个主要业务流程
- [ ] 每个流程5-10个步骤
- [ ] 覆盖所有按钮、搜索框、表单提交

**测试文档**: `docs/testing/17_E2E_Test_Report.md`

#### 4.2 测试覆盖率报告 (1天)

**任务清单**:
- [ ] 运行后端测试覆盖率: `mvn test jacoco:report`
- [ ] 运行前端测试覆盖率: `npm run test:coverage`
- [ ] 分析覆盖率缺口
- [ ] 补充缺失测试
- [ ] 生成覆盖率报告

**目标覆盖率**:
- 后端Service层: ≥ 95%
- 后端Controller层: ≥ 90%
- 前端组件: ≥ 90%
- E2E关键流程: 100%

**测试文档**: `docs/testing/18_Test_Coverage_Report.md`

#### 4.3 测试文档汇总 (1天)

**生成文档清单**:

1. ✅ `01_AssetCategory_Test_Report.md`
2. ✅ `02_User_Management_Test_Report.md`
3. ✅ `03_Department_Management_Test_Report.md`
4. ✅ `04_Role_Management_Test_Report.md`
5. ✅ `05_Frontend_Component_Tests.md`
6. ✅ `06_Button_Handler_Tests.md`
7. ✅ `07_Search_Box_Tests.md`
8. ✅ `08_Form_Submission_Tests.md`
9. ✅ `09_Maintenance_Module_Test_Report.md`
10. ✅ `10_Inventory_Module_Test_Report.md`
11. ✅ `11_IdleAsset_Module_Test_Report.md`
12. ✅ `12_Business_Module_Integration_Tests.md`
13. ✅ `13_Compensation_Module_Test_Report.md`
14. ✅ `14_Approval_Module_Test_Report.md`
15. ✅ `15_Attachment_Module_Test_Report.md`
16. ✅ `16_Advanced_Features_Integration_Tests.md`
17. ✅ `17_E2E_Test_Report.md`
18. ✅ `18_Test_Coverage_Report.md`

**主索引文档**: `docs/testing/00_TEST_INDEX.md`
```markdown
# forthAMS 测试文档索引

## 测试概览
- 总测试用例数: XXX
- 后端单元测试: XXX
- 前端组件测试: XXX
- E2E测试: XXX
- 测试覆盖率: XX%

## 模块测试报告
1. [资产分类管理](./01_AssetCategory_Test_Report.md)
2. [用户管理](./02_User_Management_Test_Report.md)
...

## 功能测试清单
### 按钮测试 ✅
- [x] 所有"保存"按钮 (23个)
- [x] 所有"删除"按钮 (18个)
- [x] 所有"搜索"按钮 (15个)
- [x] 所有"提交"按钮 (12个)

### 搜索框测试 ✅
- [x] 资产台账搜索 (资产编号、名称)
- [x] 用户管理搜索 (用户名、真实姓名)
...

### 表单提交测试 ✅
- [x] 资产创建表单
- [x] 资产编辑表单
- [x] 用户创建表单
...

## 测试覆盖率
- 后端Service层: 96.5%
- 后端Controller层: 92.3%
- 前端组件: 91.8%
- E2E关键流程: 100%
```

---

### Batch 5: 验收与交付 (3天) ✅

**目标**: 最终验收，确保所有功能和测试完整

#### 5.1 功能验收 (1天)

**验收清单**:

##### 后端功能验收
- [ ] 所有8个核心模块API可访问
- [ ] 所有CRUD操作正常工作
- [ ] 所有业务逻辑正确执行
- [ ] 数据库操作无错误
- [ ] 无编译错误和警告

##### 前端功能验收
- [ ] 所有8个页面正常渲染
- [ ] 所有按钮Handler正常工作
- [ ] 所有搜索框正常工作
- [ ] 所有表单提交正常工作
- [ ] 所有保存操作正常工作
- [ ] 错误处理和用户反馈完整
- [ ] 无控制台错误

##### 集成验收
- [ ] 前后端API对接正常
- [ ] 数据流转正确
- [ ] 认证授权正常
- [ ] 文件上传下载正常

**验收文档**: `docs/testing/19_Functional_Acceptance_Report.md`

#### 5.2 测试验收 (1天)

**验收清单**:
- [ ] 所有测试用例可运行
- [ ] 所有测试用例通过
- [ ] 测试覆盖率达标
- [ ] 测试文档齐全
- [ ] 测试文档格式一致

**运行验证**:
```bash
# 后端
cd backend
mvn clean test
mvn jacoco:report

# 前端
cd frontend
npm run test
npm run test:e2e
npm run test:coverage
```

**验收文档**: `docs/testing/20_Test_Acceptance_Report.md`

#### 5.3 交付清单 (1天)

**最终交付物**:

##### 代码交付
- ✅ backend/ (完整后端代码 + 测试)
- ✅ frontend/ (完整前端代码 + 测试)
- ✅ 无编译错误
- ✅ 代码风格一致

##### 文档交付
- ✅ README.md (更新为实际完成状态)
- ✅ API_DOCUMENTATION.md (完整API文档)
- ✅ docs/testing/ (20个测试文档)
- ✅ docs/GAI_AUDIT_REPORT.md
- ✅ docs/GAI_DEBATE_REPORT.md
- ✅ docs/GAI_WORKCARD.md
- ✅ docs/GAI_CLOSEOUT_REPORT.md

##### 运行指南
- ✅ 后端启动脚本
- ✅ 前端启动脚本
- ✅ 测试运行脚本
- ✅ 数据库初始化脚本

**最终交付文档**: `docs/GAI_CLOSEOUT_REPORT.md`

---

## 执行跟踪 (Execution Tracking)

### 总体进度

| 批次 | 任务 | 计划天数 | 实际天数 | 状态 | 完成度 |
|------|------|---------|---------|------|--------|
| Batch 0 | 环境准备与修复 | 3 | - | ⏳ Pending | 0% |
| Batch 1 | 高优先级基础模块 | 7 | - | ⏳ Pending | 0% |
| Batch 2 | 核心业务模块 | 10 | - | ⏳ Pending | 0% |
| Batch 3 | 高级功能模块 | 7 | - | ⏳ Pending | 0% |
| Batch 4 | E2E测试与文档 | 5 | - | ⏳ Pending | 0% |
| Batch 5 | 验收与交付 | 3 | - | ⏳ Pending | 0% |
| **总计** | **全部任务** | **35** | **-** | **⏳** | **0%** |

### 验收标准 (Acceptance Criteria)

#### 功能完整性
- [ ] 8个核心模块100%实现
- [ ] 所有按钮Handler正常工作
- [ ] 所有搜索框正常工作
- [ ] 所有表单提交正常工作
- [ ] 所有保存操作正常工作

#### 测试覆盖率
- [ ] 后端Service层覆盖率 ≥ 95%
- [ ] 后端Controller层覆盖率 ≥ 90%
- [ ] 前端组件测试覆盖率 ≥ 90%
- [ ] E2E关键流程覆盖率 = 100%

#### 文档完整性
- [ ] 20个测试文档齐全
- [ ] 每个文档包含功能清单
- [ ] 每个功能点有测试用例
- [ ] 测试结果可追溯

#### 代码质量
- [ ] 无编译错误
- [ ] 无编译警告
- [ ] 代码风格一致
- [ ] 注释完整

---

## 风险与应对 (Risks & Mitigation)

### 风险1: 批次间依赖导致阻塞

**发生概率**: 🟡 Medium  
**影响程度**: 🔴 High

**缓解措施**:
- 提前设计接口契约
- 使用Mock数据隔离批次
- 批次顺序合理安排

**应急方案**:
- 调整批次顺序
- 并行开发降低依赖

### 风险2: 测试编写时间超预期

**发生概率**: 🟡 Medium  
**影响程度**: 🟠 Medium

**缓解措施**:
- 使用测试模板减少重复
- AI辅助生成测试框架
- 聚焦核心业务路径

**应急方案**:
- 调整测试覆盖率目标
- 延长Batch 4时间

### 风险3: 前端API集成问题

**发生概率**: 🟢 Low  
**影响程度**: 🟠 Medium

**缓解措施**:
- 早期验证API契约
- 使用MSW隔离测试
- 集成测试覆盖全流程

**应急方案**:
- 快速修复API接口
- 调整前端Service层

---

## 成功关键 (Critical Success Factors)

1. **清晰的批次划分** - 每批次独立可验证
2. **测试同步开发** - 不延后到最后
3. **自动化脚本** - 减少手工操作
4. **质量保障** - 每批次验收后再进行下一批次
5. **文档同步** - 测试完成立即生成文档

---

## 下一步行动 (Next Actions)

### 立即执行 (Now)

1. **开始Batch 0执行**
   - 修复LSP错误
   - 搭建测试框架
   - 创建测试模板

2. **创建任务跟踪**
   - 创建GitHub Project
   - 拆分为Issues
   - 设置Milestone

3. **准备自动化脚本**
   - 代码生成脚本
   - 测试运行脚本
   - 文档生成脚本

### 待用户确认

⏸️ **等待用户确认后，进入GAI Phase 5: Execute**

---

**Workcard Phase Complete** ✅  
**Next Phase**: Execute (开始实施)

---

**工时预估汇总**:
- Batch 0: 3天
- Batch 1: 7天
- Batch 2: 10天
- Batch 3: 7天
- Batch 4: 5天
- Batch 5: 3天
- **总计**: 35个工作日 (7周)

**交付成果预览**:
- ✅ 8个核心模块完整实现
- ✅ 200+ 后端单元测试
- ✅ 150+ 前端组件测试
- ✅ 6个E2E完整流程测试
- ✅ 20个测试文档
- ✅ 测试覆盖率 ≥ 90%

**项目状态**: 🟢 Ready to Execute (准备执行)
