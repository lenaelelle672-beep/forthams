# Specification: [WAVE2-001] Fix Location Entity Annotations

## 需求与背景

`Location` 实体类当前缺少 MyBatis-Plus 的 ORM 映射注解，导致实体字段与数据库列名之间的映射关系不正确。数据库表 `location` 的列命名采用下划线风格（如 `location_name`、`parent_id`），而 Java 实体采用驼峰命名（如 `name`、`parentId`）。`name` 字段与列名 `location_name` 的差异超出默认驼峰转换规则，`parentId` 到 `parent_id` 的转换依赖全局配置但缺乏显式声明。需通过添加 `@TableName` 和 `@TableField` 注解确保映射确定性。

**数据库表结构（`location`）：**

| 列名 | 类型 | 备注 |
|---|---|---|
| id | BIGINT | 主键 |
| location_name | VARCHAR | 名称 |
| location_code | VARCHAR | 编码 |
| parent_id | BIGINT | 父级ID |
| sort_order | INT | 排序 |
| description | VARCHAR | 描述 |
| status | TINYINT | 状态 |
| create_time | DATETIME | 创建时间 |
| update_time | DATETIME | 更新时间 |
| deleted | TINYINT | 逻辑删除标记 |

**目标文件：** `backend/src/main/java/com/ams/entity/Location.java`

---

## 当前 Phase 对应实施目标

**Phase: Entity-Layer Fix（实体层注解修正）**

本 Phase 为独立原子操作，仅修改单一实体文件 `Location.java`，不涉及其他层级。

**实施目标清单：**

| 序号 | 目标 | 具体操作 |
|---|---|---|
| 1 | 绑定表名 | 在类声明上方添加 `@TableName("location")` |
| 2 | 映射 name 字段 | 在 `name` 属性上方添加 `@TableField("location_name")` |
| 3 | 映射 parentId 字段 | 在 `parentId` 属性上方添加 `@TableField("parent_id")` |
| 4 | 确保导入完整 | import 中包含 `com.baomidou.mybatisplus.annotation.TableName` 和 `com.baomidou.mybatisplus.annotation.TableField` |

---

## 边界约束

### 2.1 IN-SCOPE（必须做）
- 修改 `Location.java` 实体类，添加注解 `@TableName`、`@TableField`
- 保留实体类中所有已有字段，不得删除或重命名任何属性
- 保留所有已存在的注解（如 `@Data`、`@TableId` 等）

### 2.2 OUT-OF-SCOPE（禁止做）
- **禁止**修改数据库表结构或 DDL
- **禁止**修改 Mapper、Service、Controller 等其他层级文件
- **禁止**修改 `application.yml` 或任何 MyBatis-Plus 全局配置
- **禁止**在实体中添加不存在于数据库表中的字段
- **禁止**更改字段类型、访问修饰符或已有的 getter/setter 逻辑

### 2.3 技术约束
- 使用 MyBatis-Plus 注解：`com.baomidou.mybatisplus.annotation.TableName`、`com.baomidou.mybatisplus.annotation.TableField`
- 注解值必须与数据库列名**精确匹配**，区分大小写
- `@TableField` 仅应用于 `name` 和 `parentId` 两个字段；其余字段（`id`、`locationCode`、`sortOrder`、`description`、`status`、`createTime`、`updateTime`、`deleted`）依赖 MyBatis-Plus 默认驼峰转换，无需显式注解

### 2.4 修改后的实体字段-列映射预期

```java
@Data
@TableName("location")
public class Location {
    // id → id (默认映射，已有 @TableId)
    
    @TableField("location_name")
    private String name;           // → location_name
    
    private String locationCode;   // → location_code (驼峰默认转换)
    
    @TableField("parent_id")
    private Long parentId;         // → parent_id
    
    private Integer sortOrder;     // → sort_order (驼峰默认转换)
    private String description;    // → description (默认映射)
    private Integer status;        // → status (默认映射)
    private LocalDateTime createTime;  // → create_time (驼峰默认转换)
    private LocalDateTime updateTime;  // → update_time (驼峰默认转换)
    private Integer deleted;       // → deleted (默认映射)
}
```

---

## 验收测试基准 (ATB)

### ATB-01: 编译验证
- **测试方式：** 执行 `mvn compile -pl backend -f backend/pom.xml`
- **期待结果：** 编译成功，零 ERROR，无未解析的 import 警告

### ATB-02: 注解存在性验证（单元测试）
- **测试方式：** 编写 JUnit 5 + 反射测试，断言以下内容：

```java
// ATB-02-TC1: @TableName 注解存在且值正确
TableName tableName = Location.class.getAnnotation(TableName.class);
assert tableName != null : "@TableName annotation missing";
assert tableName.value().equals("location") : "Expected 'location', got '" + tableName.value() + "'";

// ATB-02-TC2: name 字段 @TableField 映射到 location_name
Field nameField = Location.class.getDeclaredField("name");
TableField nameAnnotation = nameField.getAnnotation(TableField.class);
assert nameAnnotation != null : "@TableField missing on 'name' field";
assert nameAnnotation.value().equals("location_name") : "Expected 'location_name'";

// ATB-02-TC3: parentId 字段 @TableField 映射到 parent_id
Field parentIdField = Location.class.getDeclaredField("parentId");
TableField parentIdAnnotation = parentIdField.getAnnotation(TableField.class);
assert parentIdAnnotation != null : "@TableField missing on 'parentId' field";
assert parentIdAnnotation.value().equals("parent_id") : "Expected 'parent_id'";

// ATB-02-TC4: 字段总数不变（必须为 10）
Field[] fields = Location.class.getDeclaredFields();
assert fields.length == 10 : "Expected 10 fields, found " + fields.length;
```

- **期待结果：** 全部断言通过

### ATB-03: ORM 映射集成验证（需数据库环境）
- **测试方式：** 启动应用后，通过 MyBatis-Plus `BaseMapper.selectList(null)` 或自定义 SQL 执行全表查询
- **期待结果：**
  - 返回的 `Location` 对象中 `name` 属性非 null（当数据库 `location_name` 列有值时）
  - 返回的 `Location` 对象中 `parentId` 属性正确映射数据库 `parent_id` 列值
  - 无 `ColumnNotFound` 或映射异常

### ATB-04: SQL 日志验证
- **测试方式：** 开启 MyBatis-Plus SQL 日志（`mybatis-plus.configuration.log-impl=org.apache.ibatis.logging.stdout.StdOutImpl`），执行一次 `selectById` 查询
- **期待结果：** 生成的 SQL 为 `SELECT id, location_name, location_code, parent_id, sort_order, description, status, create_time, update_time, deleted FROM location WHERE id=? AND deleted=0`，列名与数据库表完全对应，无字段名拼写错误

### ATB-05: 回归无损验证
- **测试方式：** 执行已有项目全量测试套件 `mvn test`
- **期待结果：** 所有已有测试用例状态不变，无新增 FAIL 或 ERROR

---

## 开发切入层级序列

```
STEP 1 ── [Entity Layer] 打开 backend/src/main/java/com/ams/entity/Location.java
         │
         ├─ 1a. 确认 import 区块：添加或验证
         │      import com.baomidou.mybatisplus.annotation.TableName;
         │      import com.baomidou.mybatisplus.annotation.TableField;
         │
         ├─ 1b. 类级别：在 @Data（或等效 Lombok 注解）上方/下方添加
         │      @TableName("location")
         │
         ├─ 1c. 字段级别 name：在 private String name; 上方添加
         │      @TableField("location_name")
         │
         └─ 1d. 字段级别 parentId：在 private Long parentId; 上方添加
                @TableField("parent_id")

STEP 2 ── [验证] 执行 mvn compile，确认编译通过

STEP 3 ── [验证] 执行 ATB-02 反射测试，确认注解值精确匹配

STEP 4 ── [验证] 执行 ATB-04 SQL 日志检查，确认列名映射正确

STEP 5 ── [验证] 执行 mvn test 全量回归，确认无破坏
```

**完成标志：** STEP 1 至 STEP 5 全部通过，本 Spec 关闭。