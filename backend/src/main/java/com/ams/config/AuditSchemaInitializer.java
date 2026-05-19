package com.ams.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!test")
@RequiredArgsConstructor
public class AuditSchemaInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS general_audit_entry (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    trace_id VARCHAR(64),
                    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    action VARCHAR(512),
                    before_record LONGTEXT,
                    after_record LONGTEXT,
                    operation_type VARCHAR(64),
                    operator_id VARCHAR(64),
                    operator_name VARCHAR(128),
                    resource_type VARCHAR(64),
                    resource_id VARCHAR(128),
                    detail TEXT,
                    ip_address VARCHAR(64),
                    INDEX idx_general_audit_timestamp (timestamp),
                    INDEX idx_general_audit_operation_type (operation_type),
                    INDEX idx_general_audit_operator (operator_id),
                    INDEX idx_general_audit_resource (resource_type, resource_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
    }
}
