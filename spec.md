```markdown
## 需求与背景

forthAMS 资产折旧 MVP 当前阶段目标：在已有项目骨架上，补全折旧计算与持久化的后端能力、前端展示入口、真实业务测试。仅覆盖直线法（Straight-Line）折旧，作为唯一折旧策略实现。

**前置状态假设**（基于 worktree 审计结果）：
- 后端存在 `backend/src/main/java` 下的 Spring Boot 工程骨架，含资产（Asset）实体及相关 Repository/Service/Controller 基础结构
- 前端存在 `frontend/src/app` 下的 Next.js 路由结构，含资产列表/详情页面基础
- `.gsd` 状态文件记录当前迭代为折旧 MVP 的第一次实质编码迭代
- 已有折旧相关代码/测试可能处于空壳、TODO、或不完整状态——本次任务补全而非推翻

**核心增量**：
1. 后端：`DepreciationMethod` 枚举、`DepreciationRecord` 实体与 Repository、`DepreciationService`（直线法计算逻辑）、对应的 Controller 端点
2. 前端：资产详情页内嵌折旧结果展示区域（只读），或独立折旧记录列表路由
3. 测试：后端单元测试覆盖计算逻辑、集成测试覆盖持久化；前端组件测试覆盖渲染

## 边界约束

### 绝对禁止
- 不修改 `ROADMAP.md`、`SPEC.md`、`spec.md`、`README.md` 及任何根目录文档
- 不编写任何 mock 对象替代真实数据库交互（集成测试必须走真实 H2 内存库）
- 不引入新的折旧算法（本次仅直线法）
- 不修改无关历史文件（非折旧相关的 Asset CRUD 代码如已稳定，不触碰）
- 不新建与现有包结构不一致的包路径

### 结构约束
- 后端实体存放于 `backend/src/main/java/com/forthams/<module>/entity/` 或等效已有 entity 目录
- 后端 Repository 存放于对应 `repository/` 目录
- 后端 Service 存放于对应 `service/` 目录
- 后端 Controller 存放于对应 `controller/` 目录
- 前端页面存放在 `frontend/src/app/` 现有路由树下
- 前端组件若抽取，存放于 `frontend/src/components/` 已有目录

### 技术约束
- 直线法公式：`年折旧额 = (原值 - 预计残值) / 预计使用年限`；`月折旧额 = 年折旧额 / 12`
- 折旧记录必须关联资产 ID，记录折旧期间（年月）、折旧额、累计折旧、净值
- 折旧计算触发方式：通过 API 显式触发（POST），非定时任务
- 数据库字段使用 `DECIMAL(18,2)` 存储金额，禁止使用浮点数类型
- 前端展示仅读取，不提供折旧参数编辑入口（参数在资产侧维护）

### 外部调用约束
- 遵守 Z.AI Coding Plan provider 限速，单次请求间隔不低于配置阈值
- 遇到 429 立即停止，不重试循环读取同一文件

## 验收测试基准 (ATB)

### ATB-1：直线法折旧计算单元测试
- **文件**：`backend/src/test/java/.../service/DepreciationServiceTest.java`
- **方式**：JUnit 5 + AssertJ
- **用例**：
  - 原值 100000，残值 10000，年限 5 年 → 年折旧额 18000，月折旧额 1500
  - 残值为 0 的边界情况
  - 原值等于残值的退化情况 → 折旧额为 0
  - 使用年限为 1 年的极短情况
- **物理期待**：`mvn test -pl backend -Dtest=DepreciationServiceTest` 全部通过，无 mock

### ATB-2：折旧记录持久化集成测试
- **文件**：`backend/src/test/java/.../repository/DepreciationRecordRepositoryTest.java` 或对应集成测试类
- **方式**：Spring Boot Test + `@DataJpaTest`，H2 内存库
- **用例**：
  - 插入一条折旧记录后可通过 assetId + period 查回
  - 同一 assetId + period 不可重复插入（唯一约束）
  - 累计折旧字段正确存储与读取
- **物理期待**：`mvn test -pl backend -Dtest=DepreciationRecordRepositoryTest` 全部通过

### ATB-3：折旧计算 API 端到端测试
- **文件**：`backend/src/test/java/.../controller/DepreciationControllerTest.java`
- **方式**：`@WebMvcTest` 或 `@SpringBootTest` + `MockMvc`
- **用例**：
  - `POST /api/depreciation/calculate` 传入 assetId，返回 200 及折旧记录列表
  - 传入不存在的 assetId 返回 404
  - 传入残值大于原值的资产返回 400
- **物理期待**：`mvn test -pl backend -Dtest=DepreciationControllerTest` 全部通过

### ATB-4：前端折旧展示组件渲染测试
- **文件**：`frontend/src/__tests__/` 或 `frontend/src/app/.../__tests__/` 下对应测试文件
- **方式**：Jest + React Testing Library
- **用例**：
  - 组件接收折旧记录数组 props 后，正确渲染表格行数
  - 无折旧记录时显示空状态提示
  - 金额格式化显示（千分位、两位小数）
- **物理期待**：`cd frontend && npx jest --testPathPattern="depreciation"` 全部通过

### ATB-5：后端全量编译验证
- **命令**：`cd backend && mvn compile -q`
- **物理期待**：退出码 0，无 warning 以上级别输出

### ATB-6：前端构建验证
- **命令**：`cd frontend && npx next build 2>&1 | tail -20`
- **物理期待**：构建成功，无 TypeScript 错误

## 开发切入层级序列

### Layer 1：后端实体与枚举定义
- 在已有 entity 包下新建或补全 `DepreciationMethod` 枚举（仅 `STRAIGHT_LINE`）
- 新建 `DepreciationRecord` 实体：`id`, `assetId`(Long), `period`(String, 格式 `yyyy-MM`), `depreciationAmount`(BigDecimal), `accumulatedDepreciation`(BigDecimal), `netValue`(BigDecimal), `createdAt`(LocalDateTime)
- 确保 Asset 实体已具备折旧所需字段：`originalValue`(BigDecimal), `residualValue`(BigDecimal), `usefulLifeYears`(Integer)；若缺失则仅追加这三个字段，不改其余字段
- 补全对应的数据库迁移脚本（如项目使用 Flyway/Liquibase）或确保 JPA `ddl-auto` 能正确生成表结构

### Layer 2：后端 Repository 层
- 新建 `DepreciationRecordRepository extends JpaRepository<DepreciationRecord, Long>`
- 追加查询方法：`List<DepreciationRecord> findByAssetIdOrderByPeriodAsc(Long assetId)`
- 追加唯一约束：`Optional<DepreciationRecord> findByAssetIdAndPeriod(Long assetId, String period)`
- 编写 ATB-2 对应测试并验证通过

### Layer 3：后端 Service 层（核心计算）
- 新建 `DepreciationService`
- 实现方法 `calculateStraightLine(Asset asset, int year, int month)`：单月折旧计算，返回 `DepreciationRecord`
- 实现方法 `calculateForAsset(Long assetId, int periods)`：批量计算多期折旧，查询已有记录避免重复，返回 `List<DepreciationRecord>`
- 计算逻辑必须使用 `BigDecimal`，`setScale(2, RoundingMode.HALF_UP)`
- 参数校验：原值 < 残值抛业务异常；年限 <= 0 抛业务异常
- 编写 ATB-1 对应测试并验证通过

### Layer 4：后端 Controller 层
- 新建 `DepreciationController`，路径 `/api/depreciation`
- 端点 `POST /api/depreciation/calculate`：接收 `{ "assetId": Long, "periods": int }`，调用 Service，返回折旧记录列表
- 端点 `GET /api/depreciation/records?assetId={id}`：查询已有折旧记录
- 异常处理复用项目已有全局异常处理器，不新建
- 编写 ATB-3 对应测试并验证通过

### Layer 5：前端折旧展示组件
- 在 `frontend/src/components/` 下新建 `DepreciationTable.tsx`
- Props：`records: DepreciationRecord[]`
- 表格列：期间、当期折旧额、累计折旧、净值
- 金额列使用 `toLocaleString` 或等效格式化
- 空状态渲染"暂无折旧记录"
- 编写 ATB-4 对应测试并验证通过

### Layer 6：前端页面集成
- 在资产详情页（`frontend/src/app/assets/[id]/page.tsx` 或等效路径）中引入 `DepreciationTable`
- 在页面加载时调用 `GET /api/depreciation/records?assetId={id}` 获取数据
- 在资产详情页添加"计算折旧"按钮，点击调用 `POST /api/depreciation/calculate`，成功后刷新列表
- 若资产详情页结构复杂，仅追加折旧区域，不改已有结构

### Layer 7：全量验证
- 依次执行 ATB-1 至 ATB-6 全部验证命令
- 汇总结果，报告通过/失败项
```