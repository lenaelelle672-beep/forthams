package com.ams.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 应用启动配置校验器。
 * <p>
 * 在应用启动时检查敏感配置项（DB_PASSWORD、JWT_SECRET）是否已通过环境变量正确设置。
 * 若未设置或使用了默认值，立即抛出 IllegalStateException 阻止应用启动。
 * </p>
 */
@Component
public class ApplicationConfigValidator {

    private static final Logger log = LoggerFactory.getLogger(ApplicationConfigValidator.class);

    @Value("${DB_PASSWORD:}")
    private String dbPassword;

    @Value("${JWT_SECRET:}")
    private String jwtSecret;

    @PostConstruct
    public void validate() {
        boolean hasError = false;

        // 校验 DB_PASSWORD
        if (dbPassword == null || dbPassword.isEmpty() || "CHANGEME".equals(dbPassword)) {
            log.error("❌ DB_PASSWORD 未设置或使用了默认值！请通过环境变量设置 DB_PASSWORD");
            hasError = true;
        } else {
            log.info("✅ DB_PASSWORD 已正确设置");
        }

        // 校验 JWT_SECRET
        if (jwtSecret == null || jwtSecret.isEmpty()) {
            log.error("❌ JWT_SECRET 未设置！请通过环境变量设置 JWT_SECRET");
            hasError = true;
        } else {
            log.info("✅ JWT_SECRET 已正确设置");
        }

        if (hasError) {
            throw new IllegalStateException(
                    "安全配置校验未通过：DB_PASSWORD 和/或 JWT_SECRET 未正确设置。" +
                    "请通过环境变量配置后重新启动。"
            );
        }

        log.info("✅ 安全配置校验全部通过，应用启动继续");
    }
}
