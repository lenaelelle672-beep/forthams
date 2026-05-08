package com.ams.annotation;

import java.lang.annotation.*;

/**
 * 自动化分配注解。用于标记在业务方法执行成功后自动触发资源分配逻辑的方法。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface AutoAssign {

    /**
     * 分配策略类型，默认为 "DEFAULT"
     */
    String strategyType() default "DEFAULT";

    /**
     * 被拦截方法返回对象中包含分配目标 ID 的字段名。
     * 若不指定，切面将尝试从返回值中读取 "id" 字段。
     */
    String targetIdParam() default "id";

    /**
     * 业务实体类型（如 "WORK_ORDER", "TASK" 等），用于策略选择和上下文构建
     */
    String entityType();

    /**
     * 是否需要在主事务提交后异步执行分配逻辑，默认 false（事务提交后同步执行）
     */
    boolean async() default false;
}