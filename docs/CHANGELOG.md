# Changelog

所有重要的项目变更都将记录在此文件中。

## [Unreleased]

### 新增

### 修复

### 测试

---

## [1.0.0] - 2024-12-19

### Phase 3.3: 审计切面集成

#### 新增

- **AuditAspect.java 切面实现**
  - 文件: `backend/src/main/java/com/ams/aspect/AuditAspect.java`
  - @Aspect + @Component 注解声明
  - @Around 拦截方法 `auditAround()`
  - Pointcut 表达式绑定至 @Auditable 注解
  - 审计数据提取：方法参数、返回值、耗时计算
  - 与 AuditService 服务层集成

- **@Auditable 自定义审计注解**
  - 文件: `backend/src/main/java/com/ams/annotation/Auditable.java`
  - 属性: action, entityType, description
  - 支持方法级审计标记

- **GeneralAuditEntry 实体集成**
  - 字段映射完整: id, action, entityType, entityId, userId, timestamp, details, ipAddress
  - 时间戳自动填充
  - JSON 序列化兼容

- **AuditService 服务层集成**
  - @Autowired 依赖注入
  - 异步审计写入机制
  - 异常容错处理（审计失败不阻断主流程）

#### 修复

- 审计失败不影响主业务流程（try-catch 包裹）
- 审计异常仅记录 warn 级别日志，不抛异常

#### 测试

- **AST 静态分析验证**: PASS (AST-001 ~ AST-008)
  - Python AST 解析器可用
  - 空代码处理优雅
  - endless_daemon.py 无语法错误
  - 审计模块节点覆盖
  - TestASTAnalyzer 方法可调用
  - analyze_file() 返回图结构
  - format_output() 产生 CSV 格式
  - analyze_directory() 返回多文件结果

- **ATB 验收测试**: PASS (ATB-1 ~ ATB-4)
  - ATB-1: 切面类结构验证 (4/4 通过)
  - ATB-2: 审计拦截逻辑验证 (4/4 通过)
  - ATB-3: GeneralAuditEntry 实体绑定 (4/4 通过)
  - ATB-4: AuditService 服务层集成 (4/4 通过)

- **测试文件新增**:
  - `tests/test_aspect_binding.py` - 切面绑定测试
  - `tests/test_entity_binding.py` - 实体绑定测试
  - `tests/test_service_integration.py` - 服务集成测试

- **Java 单元测试**:
  - `backend/src/test/java/com/ams/ContextLoadTest.java` - Spring 上下文加载测试
  - `backend/src/test/java/com/ams/controller/AssetCategoryControllerTest.java` - 控制器测试
  - `backend/src/test/java/com/ams/service/AssetCategoryServiceTest.java` - 服务测试

#### 文档更新

- `docs/plan.md` - Phase 3.3 完成状态更新
- `docs/CHANGELOG.md` - 本次版本记录

---

## [0.9.0] - 2024-12-15

### Phase 3: 审计模块实现

#### 新增

- **GeneralAuditEntry 审计实体**
  - 文件: `backend/src/main/java/com/ams/entity/GeneralAuditEntry.java`
  - 核心字段: id, action, entityType, entityId, userId, timestamp, details, ipAddress

- **AuditService 审计服务**
  - 文件: `backend/src/main/java/com/ams/service/AuditService.java`
  - 文件: `backend/src/main/java/com/ams/service/impl/AuditServiceImpl.java`
  - 方法: saveAudit(), findByEntityId(), findByUserId()

- **AST 静态分析工具**
  - 文件: `scripts/ast_dead_code_check.py`
  - DeadCodeVisitor 死代码检测
  - TestASTAnalyzer 测试分析器
  - 支持 CSV 格式化输出

---

## [0.8.0] - 2024-12-10

### Phase 2: 实体层定义

#### 新增

- 资产分类管理 (AssetCategory)
- 部门管理 (Dept)
- 角色管理 (Role)
- 权限管理 (SysPermission)
- 供应商管理 (Vendor)
- 地理位置管理 (Location)
- 盘点任务管理 (InventoryTask)
- 盘点明细管理 (InventoryDetail)

---

## [0.7.0] - 2024-12-05

### Phase 1: 核心框架搭建

#### 新增

- **Spring Boot 基础架构**
  - 主应用类: `backend/src/main/java/com/ams/AssetManagementApplication.java`
  - 安全配置: `backend/src/main/java/com/ams/config/SecurityConfig.java`
  - JWT 认证过滤器: `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java`
  - 全局异常处理: `backend/src/main/java/com/ams/common/GlobalExceptionHandler.java`

- **MyBatis Plus 集成**
  - 自动填充处理器: `backend/src/main/java/com/ams/config/MyBatisPlusMetaObjectHandler.java`
  - 租户上下文: `backend/src/main/java/com/ams/security/context/TenantContext.java`

- **核心业务实体**
  - 用户管理 (User, UserRole)
  - 资产管理 (Asset)
  - 审批流程 (ApprovalProcess, ApprovalRecord)
  - 工单管理 (WorkOrder)
  - 维保记录 (MaintenanceRecord)
  - 资产变更日志 (AssetChangeLog)

- **前端基础组件**
  - 路由配置: `frontend/src/app/routes.ts`
  - 认证上下文: `frontend/src/app/context/AuthContext.tsx`
  - API 工具: `frontend/src/app/utils/api.ts`
  - 权限钩子: `frontend/src/app/utils/permissionHooks.ts`

---

## [0.5.0] - 2024-11-25

### 初始版本

#### 新增

- 项目基础结构
- Graphify 知识图谱系统核心 (src/endless_daemon.py)
- AMS 资产管理平台基础框架
- 遗留代码存根 (legacy_stubs.py)