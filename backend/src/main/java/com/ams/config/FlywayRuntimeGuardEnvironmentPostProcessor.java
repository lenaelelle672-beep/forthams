package com.ams.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * 应用进程不是数据库迁移入口。该检查读取 Spring 已解析的最终属性，因而同样覆盖
 * 环境变量、命令行和 profile 覆盖，并在 DataSource/Flyway 自动配置前 fail-fast。
 */
public class FlywayRuntimeGuardEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Boolean flywayEnabled = environment.getProperty("spring.flyway.enabled", Boolean.class, false);
        if (Boolean.TRUE.equals(flywayEnabled)) {
            throw new IllegalStateException("应用进程禁止启用 spring.flyway.enabled；仅 DBA 受控发布入口可执行迁移");
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 19;
    }
}
