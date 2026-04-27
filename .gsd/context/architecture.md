# Architecture - forthAMS

## Tech Stack
- Backend: Spring Boot 3.2.5 + Java 17
- ORM: MyBatis-Plus 3.5.9 (NOT JPA/Hibernate)
- DB: MySQL 8.4 (database: ams_db)
- Auth: JWT (jjwt 0.12.5)
- Frontend: React + Vite + Ant Design

## Three-Layer Architecture (STRICT)
Controller (@RestController) -> @RequiredArgsConstructor + private final XxxService
Service (business logic) -> constructor injection of Mapper
Mapper (extends BaseMapper<Entity>) -> @TableName on Entity
Entity (@Data + @TableName)

## Response Format (ALL controllers MUST use)
Result.success() -> {"code":200,"message":"success","data":null}
Result.success(data) -> {"code":200,"message":"success","data":{...}}
Result.error("msg") -> {"code":500,"message":"msg","data":null}
Return type: Result<T> from com.ams.common.Result

## Pagination (MyBatis-Plus)
Page<Entity> page = new Page<>(pageNum, pageSize);
mapper.selectPage(page, wrapper);
return Result.success(page);

## Entity Annotations
@TableName("table_name") / @TableId(type = IdType.AUTO) / @TableField("col")

## Controller Pattern
@RestController @RequestMapping("/resources") @RequiredArgsConstructor
public class ResourceController {
    private final ResourceService resourceService;
    @GetMapping("/list") public Result<Page<Resource>> list(...) { ... }
    @GetMapping("/{id}") public Result<Resource> getById(@PathVariable Long id) { ... }
}

## Forbidden Patterns
- NEVER use @Autowired, use @RequiredArgsConstructor
- NEVER use JPA @Entity, use MyBatis-Plus @TableName
- NEVER return void from Controller, always Result<T>
- NEVER generate duplicate class definitions
- NEVER delete existing imports
- NEVER overwrite: WorkOrderDTO.java, application.yml, pom.xml
