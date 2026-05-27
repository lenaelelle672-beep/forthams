package com.ams.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller method whose operation should be written to sys_operate_log.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface OperLog {
    String title();

    OperBusinessType businessType() default OperBusinessType.OTHER;

    boolean saveRequestData() default true;

    boolean saveResponseData() default false;
}
