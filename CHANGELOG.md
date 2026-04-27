# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-01-09

### Added

- **SWARM-004: AuditAspect.java 切面集成**
  - AuditAspect.java 切面实现 - 核心审计拦截切面类
  - @Auditable 自定义审计注解 - 用于标记需审计的业务方法
  - GeneralAuditEntry 实体集成 - 审计数据持久化实体绑定
  - AuditService 服务层集成 - 审计数据异步写入服务
  - Pointcut 表达式配置 - 绑定至 com.ams.service.* 包及 @Auditable 注解
  - @Around 审计拦截方法 - 完整的方法参数、返回值、耗时数据提取

- **Phase 3.3: 审计模块集成完成**
  - Spring AOP + AspectJ 切面技术栈集成
  - 异步审计队列配置 - 审计写入采用异步机制防阻塞
  - 审计数据 JSON 序列化支持
  - 异常容错机制 - 审计失败不影响主业务流程

### Fixed

- **[SWARM-004]** 审计失败不影响主流程 - try-catch 包裹审计逻辑，异常仅记录 warn 日志

### Changed

- **审计模块架构升级**
  - 切面类从 `backend/src/main/java/com/ams/config/AuditAspect.java` 迁移至 `backend/src/main/java/com/ams/aspect/AuditAspect.java`
  - 注解类统一放置于 `backend/src/main/java/com/ams/annotation/Auditable.java`

### Test

- 新增 `tests/test_aspect_binding.py` - 切面绑定验证测试 (ATB-1, ATB-2)
- 新增 `tests/test_entity_binding.py` - 实体绑定验证测试 (ATB-3)
- 新增 `tests/test_service_integration.py` - 服务集成验证测试 (ATB-4)
- 新增 `tests/test_e2e_audit.py` - 端到端审计流程测试 (INT-001 ~ INT-003)
- AST 静态分析全量通过 (AST-001 ~ AST-008)
- ATB 验收测试全量通过 (ATB-1 ~ ATB-4)

### Documentation

- 更新 `docs/plan.md` Phase 3.3 审计切面集成完成状态
- 新增审计模块使用示例至 `README.md`

---

## [2.0.0] - 2024-12-15

### Added

- Graphify 知识图谱系统集成
- AMS 资产管理平台核心功能
- DeadCodeVisitor AST 分析工具
- ASTAnalyzer 静态代码分析器

### Changed

- 升级 Spring Boot 至 3.x
- 升级 MyBatis Plus 至最新版本

---

## [1.0.0] - 2024-06-01

### Added

- 初始项目框架搭建
- 核心实体定义 (Asset, User, Role, Department)
- 基础 CRUD 服务层实现
- RESTful API 控制器层