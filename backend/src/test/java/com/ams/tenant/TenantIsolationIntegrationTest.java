package com.ams.tenant;

import com.ams.context.TenantContext;
import com.ams.service.TenantAdminPermissionPackage;
import com.ams.service.TenantAdminPermissionPackageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TenantIsolationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TenantAdminPermissionPackageService tenantAdminPermissionPackageService;

    @Value("${jwt.secret:aVeryLongDefaultSecretKeyForTestingThatIsAtLeast256BitsLongForHS256Algorithm!!}")
    private String jwtSecret;

    private static final String TENANT_T001 = "T001";
    private static final String TENANT_T002 = "T002";

    @BeforeAll
    void setUpSchema() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_tenant");
        jdbcTemplate.execute("DROP TABLE IF EXISTS general_audit_entry");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_role_dept");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_role_data_scope");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_user_role");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_user_tenant");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_role");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_user");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_dept");
        jdbcTemplate.execute("DROP TABLE IF EXISTS disposal_application");
        jdbcTemplate.execute("DROP TABLE IF EXISTS approval_node_assignment");
        jdbcTemplate.execute("DROP TABLE IF EXISTS approval_process");
        jdbcTemplate.execute("DROP TABLE IF EXISTS workflow_definition_version");
        jdbcTemplate.execute("DROP TABLE IF EXISTS workflow_definition_draft");
        jdbcTemplate.execute("DROP TABLE IF EXISTS workflow_definition");
        jdbcTemplate.execute("DROP TABLE IF EXISTS work_order");
        jdbcTemplate.execute("DROP TABLE IF EXISTS maintenance_record");
        jdbcTemplate.execute("DROP TABLE IF EXISTS idle_asset_notice");
        jdbcTemplate.execute("DROP TABLE IF EXISTS inventory_detail_archive");
        jdbcTemplate.execute("DROP TABLE IF EXISTS inventory_detail");
        jdbcTemplate.execute("DROP TABLE IF EXISTS inventory_task");
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_reservation");
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_bucket");
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_bucket_guard");
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_tracker_guard");
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_tracker");
        jdbcTemplate.execute("DROP TABLE IF EXISTS asset_compensation");
        jdbcTemplate.execute("DROP TABLE IF EXISTS retirement_application");
        jdbcTemplate.execute("DROP TABLE IF EXISTS asset");
        jdbcTemplate.execute("DROP TABLE IF EXISTS asset_category");
        jdbcTemplate.execute("DROP TABLE IF EXISTS vendor");
        jdbcTemplate.execute("DROP TABLE IF EXISTS location");

        jdbcTemplate.execute("""
                CREATE TABLE sys_user (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64),
                    platform_admin TINYINT NOT NULL DEFAULT 0,
                    username VARCHAR(64) NOT NULL UNIQUE,
                    password VARCHAR(128) NOT NULL,
                    real_name VARCHAR(64) NOT NULL,
                    email VARCHAR(128),
                    phone VARCHAR(32),
                    avatar VARCHAR(512),
                    status TINYINT DEFAULT 1,
                    dept_id BIGINT,
                    token_version INT NOT NULL DEFAULT 0,
                    version INT NOT NULL DEFAULT 0,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_user_tenant (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    tenant_id VARCHAR(64) NOT NULL,
                    status TINYINT NOT NULL DEFAULT 1,
                    created_by BIGINT,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_user_tenant (user_id, tenant_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_role (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64),
                    role_name VARCHAR(64),
                    role_code VARCHAR(64) NOT NULL,
                    description VARCHAR(512),
                    data_scope VARCHAR(32),
                    sort_order INT DEFAULT 0,
                    status TINYINT DEFAULT 1,
                    create_time TIMESTAMP,
                    update_time TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_role_tenant_code (tenant_id, role_code)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_user_role (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    role_id BIGINT NOT NULL,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_role_data_scope (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    role_id BIGINT NOT NULL,
                    data_scope VARCHAR(32) NOT NULL,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_role_scope_tenant_role (tenant_id, role_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_role_dept (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    role_id BIGINT NOT NULL,
                    dept_id BIGINT NOT NULL,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_role_dept_tenant_role_dept (tenant_id, role_id, dept_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_dept (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64),
                    dept_name VARCHAR(128),
                    dept_code VARCHAR(64),
                    parent_id BIGINT,
                    sort_order INT,
                    leader VARCHAR(64),
                    phone VARCHAR(32),
                    email VARCHAR(128),
                    status VARCHAR(32),
                    version INT NOT NULL DEFAULT 0,
                    create_time TIMESTAMP,
                    update_time TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_dept_tenant_code (tenant_id, dept_code)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE asset (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    asset_no VARCHAR(128) NOT NULL,
                    asset_name VARCHAR(256) NOT NULL,
                    category_id BIGINT NOT NULL,
                    model VARCHAR(128),
                    brand VARCHAR(128),
                    supplier VARCHAR(256),
                    serial_no VARCHAR(128),
                    original_value DECIMAL(15,2) DEFAULT 0.00,
                    current_value DECIMAL(15,2) DEFAULT 0.00,
                    purchase_date DATE,
                    warranty_period INT,
                    depreciation_rate DECIMAL(5,2),
                    status VARCHAR(32) DEFAULT 'IDLE',
                    dept_id BIGINT,
                    user_id BIGINT,
                    location VARCHAR(256),
                    location_id BIGINT,
                    location_lat DECIMAL(10,7),
                    location_lng DECIMAL(10,7),
                    rfid_tag VARCHAR(128),
                    is_important TINYINT DEFAULT 0,
                    description TEXT,
                    remark TEXT,
                    create_by BIGINT,
                    version INT NOT NULL DEFAULT 0,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_asset_tenant_asset_no (tenant_id, asset_no)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE approval_process (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    process_no VARCHAR(128) NOT NULL UNIQUE,
                    process_type VARCHAR(64) NOT NULL,
                    business_id BIGINT NOT NULL,
                    business_data TEXT,
                    tenant_id VARCHAR(64) NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
                    cancellation_reason VARCHAR(128),
                    cancelled_at TIMESTAMP,
                    current_step INT DEFAULT 1,
                    applicant_id BIGINT NOT NULL,
                    version INT NOT NULL DEFAULT 0,
                    apply_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE workflow_definition (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    business_type VARCHAR(64) NOT NULL,
                    name VARCHAR(128) NOT NULL,
                    description TEXT,
                    definition_json TEXT NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
                    version INT NOT NULL DEFAULT 0,
                    updated_by BIGINT,
                    published_by BIGINT,
                    published_at TIMESTAMP,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_workflow_tenant_business (tenant_id, business_type)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE workflow_definition_draft (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    business_type VARCHAR(64) NOT NULL,
                    name VARCHAR(128) NOT NULL,
                    description TEXT,
                    definition_json TEXT NOT NULL,
                    revision INT NOT NULL DEFAULT 0,
                    updated_by BIGINT,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_workflow_draft_tenant_business (tenant_id, business_type)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE workflow_definition_version (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    definition_id BIGINT NOT NULL,
                    business_type VARCHAR(64) NOT NULL,
                    version INT NOT NULL,
                    action_type VARCHAR(32) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    name VARCHAR(128) NOT NULL,
                    description TEXT,
                    definition_json TEXT NOT NULL,
                    publish_note VARCHAR(512),
                    impact_scope VARCHAR(512),
                    rollback_plan VARCHAR(512),
                    rollback_source_version INT,
                    operator_id BIGINT NOT NULL,
                    published_at TIMESTAMP NOT NULL,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE approval_node_assignment (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    process_id BIGINT NOT NULL,
                    step_no INT NOT NULL,
                    assignee_id BIGINT NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
                    workflow_definition_id BIGINT NOT NULL,
                    workflow_version INT NOT NULL,
                    decided_at TIMESTAMP,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_approval_assignment_tenant_process_step_assignee (tenant_id, process_id, step_no, assignee_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE disposal_application (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    application_no VARCHAR(128) NOT NULL,
                    asset_id BIGINT NOT NULL,
                    disposal_type VARCHAR(32) NOT NULL,
                    target_dept_id BIGINT,
                    target_user_id BIGINT,
                    target_location VARCHAR(256),
                    reason VARCHAR(512) NOT NULL,
                    applicant_id BIGINT NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
                    version INT NOT NULL DEFAULT 0,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_disposal_tenant_no (tenant_id, application_no)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE retirement_application (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    application_no VARCHAR(128) NOT NULL,
                    asset_id BIGINT NOT NULL,
                    asset_name VARCHAR(256),
                    asset_code VARCHAR(128),
                    applicant_id BIGINT,
                    applicant_name VARCHAR(128),
                    dept_id BIGINT,
                    dept_name VARCHAR(128),
                    retirement_type VARCHAR(32),
                    reason VARCHAR(512) NOT NULL,
                    estimated_residual_value DECIMAL(15,2),
                    status VARCHAR(32) DEFAULT 'DRAFT',
                    current_approval_step INT DEFAULT 0,
                    total_approval_steps INT DEFAULT 1,
                    version INT NOT NULL DEFAULT 0,
                    attachments TEXT,
                    remark TEXT,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_retirement_tenant_no (tenant_id, application_no)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE asset_compensation (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    compensation_no VARCHAR(128) NOT NULL,
                    asset_id BIGINT NOT NULL,
                    compensation_type VARCHAR(32) NOT NULL,
                    compensation_amount DECIMAL(10,2) NOT NULL,
                    responsible_user_id BIGINT NOT NULL,
                    responsible_dept_id BIGINT,
                    incident_date DATE,
                    description TEXT,
                    status VARCHAR(32) DEFAULT 'PENDING',
                    create_by BIGINT,
                    version INT NOT NULL DEFAULT 0,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_compensation_tenant_no (tenant_id, compensation_no)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE work_order (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    work_order_no VARCHAR(128) NOT NULL,
                    title VARCHAR(256),
                    description TEXT,
                    tenant_id VARCHAR(64) NOT NULL,
                    status VARCHAR(32) DEFAULT 'DRAFT',
                    priority VARCHAR(32),
                    asset_id BIGINT NOT NULL,
                    asset_name VARCHAR(256),
                    asset_code VARCHAR(128),
                    reporter_id BIGINT,
                    reporter_name VARCHAR(128),
                    assignee_id BIGINT,
                    assignee_name VARCHAR(128),
                    dept_id BIGINT,
                    dept_name VARCHAR(128),
                    planned_start_date TIMESTAMP,
                    planned_end_date TIMESTAMP,
                    actual_start_date TIMESTAMP,
                    actual_end_date TIMESTAMP,
                    estimated_cost DECIMAL(15,2),
                    actual_cost DECIMAL(15,2),
                    completion_note TEXT,
                    version INT NOT NULL DEFAULT 0,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_work_order_tenant_no (tenant_id, work_order_no)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE maintenance_record (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    asset_id BIGINT NOT NULL,
                    maintenance_type VARCHAR(32) NOT NULL,
                    maintenance_date DATE NOT NULL,
                    next_maintenance_date DATE,
                    cost DECIMAL(10,2),
                    executor VARCHAR(128),
                    content TEXT,
                    result VARCHAR(32),
                    remark TEXT,
                    create_by BIGINT,
                    version INT NOT NULL DEFAULT 0,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE idle_asset_notice (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    asset_id BIGINT NOT NULL,
                    idle_days INT DEFAULT 0,
                    notice_date DATE,
                    status VARCHAR(32) DEFAULT 'PUBLISHED',
                    claimant_id BIGINT,
                    claim_date DATE,
                    create_by BIGINT,
                    version INT NOT NULL DEFAULT 0,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE inventory_task (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    task_no VARCHAR(128) NOT NULL UNIQUE,
                    task_name VARCHAR(256) NOT NULL,
                    inventory_type VARCHAR(32),
                    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
                    cancellation_reason VARCHAR(128),
                    cancelled_at TIMESTAMP,
                    dept_ids TEXT,
                    start_date DATE,
                    end_date DATE,
                    total_count INT DEFAULT 0,
                    scanned_count INT DEFAULT 0,
                    match_count INT DEFAULT 0,
                    loss_count INT DEFAULT 0,
                    executor_id BIGINT,
                    create_by BIGINT,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    INDEX idx_inventory_task_tenant_created (tenant_id, create_time, id),
                    INDEX idx_inventory_task_tenant_status_created (tenant_id, status, create_time, id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE inventory_detail (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    task_id BIGINT NOT NULL,
                    tenant_id VARCHAR(64) NOT NULL,
                    asset_id BIGINT NOT NULL,
                    rfid_tag VARCHAR(128),
                    status VARCHAR(32),
                    expected_location VARCHAR(256),
                    actual_location VARCHAR(256),
                    scan_time TIMESTAMP,
                    remark VARCHAR(512),
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_inventory_detail_tenant_task_asset (tenant_id, task_id, asset_id),
                    INDEX idx_inventory_detail_task_tenant_asset (task_id, tenant_id, asset_id),
                    INDEX idx_inventory_detail_tenant_task_scan (tenant_id, task_id, scan_time),
                    INDEX idx_inventory_detail_tenant_task_status_scan (tenant_id, task_id, status, scan_time)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE inventory_detail_archive (
                    archive_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    id BIGINT NOT NULL,
                    task_id BIGINT NOT NULL,
                    tenant_id VARCHAR(64) NOT NULL,
                    asset_id BIGINT NULL,
                    rfid_tag VARCHAR(128),
                    status VARCHAR(32),
                    expected_location VARCHAR(256),
                    actual_location VARCHAR(256),
                    scan_time TIMESTAMP,
                    remark VARCHAR(512),
                    create_time TIMESTAMP,
                    archive_reason VARCHAR(128) NOT NULL,
                    archived_at TIMESTAMP NOT NULL,
                    UNIQUE KEY uk_inventory_detail_archive_origin (tenant_id, task_id, id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE login_attempt_tracker (
                    account_hash VARCHAR(64) NOT NULL,
                    client_ip_hash VARCHAR(64) NOT NULL,
                    failure_count INT NOT NULL,
                    next_allowed_at TIMESTAMP NOT NULL,
                    last_failure_at TIMESTAMP NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (account_hash, client_ip_hash),
                    INDEX idx_login_attempt_tracker_expires (expires_at)
                )
                """);
        jdbcTemplate.execute("CREATE TABLE login_attempt_tracker_guard (id TINYINT NOT NULL PRIMARY KEY)");
        jdbcTemplate.update("INSERT INTO login_attempt_tracker_guard (id) VALUES (1)");
        jdbcTemplate.execute("""
                CREATE TABLE login_attempt_bucket (
                    bucket_type VARCHAR(16) NOT NULL,
                    bucket_hash VARCHAR(64) NOT NULL,
                    failure_count INT NOT NULL DEFAULT 0,
                    reserved_count INT NOT NULL DEFAULT 0,
                    next_allowed_at TIMESTAMP NOT NULL,
                    last_failure_at TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    PRIMARY KEY (bucket_type, bucket_hash),
                    INDEX idx_login_attempt_bucket_expires (expires_at),
                    INDEX idx_login_attempt_bucket_next_allowed (next_allowed_at)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE login_attempt_reservation (
                    reservation_id VARCHAR(36) NOT NULL PRIMARY KEY,
                    account_hash VARCHAR(64) NOT NULL,
                    client_ip_hash VARCHAR(64) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    INDEX idx_login_attempt_reservation_expires (expires_at),
                    INDEX idx_login_attempt_reservation_account_ip (account_hash, client_ip_hash)
                )
                """);
        jdbcTemplate.execute("CREATE TABLE login_attempt_bucket_guard (id TINYINT NOT NULL PRIMARY KEY)");
        jdbcTemplate.update("INSERT INTO login_attempt_bucket_guard (id) VALUES (1)");
        jdbcTemplate.execute("""
                CREATE TABLE asset_category (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    category_name VARCHAR(128) NOT NULL,
                    category_code VARCHAR(64) UNIQUE,
                    parent_id BIGINT,
                    sort_order INT,
                    description VARCHAR(512),
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE vendor (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    vendor_name VARCHAR(128) NOT NULL,
                    vendor_code VARCHAR(64),
                    contact_person VARCHAR(128),
                    contact_phone VARCHAR(64),
                    contact_email VARCHAR(128),
                    address VARCHAR(256),
                    status TINYINT DEFAULT 1,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE location (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(128) NOT NULL,
                    location_code VARCHAR(64),
                    parent_id BIGINT,
                    sort_order INT,
                    description VARCHAR(512),
                    status TINYINT DEFAULT 1,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE sys_permission (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    permission_code VARCHAR(128) NOT NULL UNIQUE,
                    permission_name VARCHAR(256),
                    status TINYINT DEFAULT 1,
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_tenant (
                    id VARCHAR(64) PRIMARY KEY,
                    name VARCHAR(128) NOT NULL,
                    plan VARCHAR(32) NOT NULL,
                    max_users INT NOT NULL,
                    max_assets INT NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    contact_name VARCHAR(64),
                    contact_phone VARCHAR(64),
                    contact_email VARCHAR(128),
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_role_permission (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    role_id BIGINT NOT NULL,
                    permission_id BIGINT NOT NULL
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE general_audit_entry (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    trace_id VARCHAR(96),
                    timestamp TIMESTAMP NOT NULL,
                    action VARCHAR(64),
                    operation_type VARCHAR(64),
                    operator_id BIGINT,
                    operator_name VARCHAR(128),
                    resource_type VARCHAR(64),
                    resource_id VARCHAR(128),
                    description VARCHAR(512),
                    http_method VARCHAR(16),
                    request_uri VARCHAR(512),
                    ip_address VARCHAR(64),
                    user_agent VARCHAR(512),
                    before_record TEXT,
                    after_record TEXT,
                    raw_payload TEXT,
                    error_message VARCHAR(1024),
                    error_stack TEXT,
                    status VARCHAR(32),
                    created_at TIMESTAMP
                )
                """);

        jdbcTemplate.update("""
                INSERT INTO sys_tenant (id, name, plan, max_users, max_assets, status)
                VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)
                """, TENANT_T001, "Tenant One", "STANDARD", 100, 10000, "ACTIVE",
                TENANT_T002, "Tenant Two", "STANDARD", 100, 10000, "ACTIVE");
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, tenant_id, username, password, real_name, dept_id, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0)
                """, 1L, TENANT_T001, "integration-test-user", "{noop}password", "Integration Test User", 10L);
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (?, ?, 1)",
                1L, TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)", 1L, "USER", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 1L, 1L);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?)", TENANT_T001, 1L, "ALL");
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, tenant_id, username, password, real_name, status, deleted)
                VALUES (?, ?, ?, ?, ?, 1, 0)
                """, 98L, TENANT_T001, "tenant-admin-test-user", "{noop}password", "Tenant Admin Test User");
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (?, ?, 1)",
                98L, TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)",
                98L, "TENANT_ADMIN", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 98L, 98L);
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, tenant_id, platform_admin, username, password, real_name, status, deleted)
                VALUES (?, ?, 1, ?, ?, ?, 1, 0)
                """, 99L, TENANT_T001, "platform-test-user", "{noop}password", "Platform Test User");
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (?, ?, 1)",
                99L, TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)",
                99L, "PLATFORM_OPERATOR", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 99L, 99L);
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, tenant_id, username, password, real_name, status, deleted)
                VALUES (?, ?, ?, ?, ?, 1, 0)
                """, 97L, TENANT_T001, "query-only-test-user", "{noop}password", "Query Only Test User");
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (?, ?, 1)",
                97L, TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)",
                97L, "QUERY_ONLY", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 97L, 97L);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?)",
                TENANT_T001, 97L, "ALL");
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, tenant_id, username, password, real_name, status, deleted)
                VALUES (?, ?, ?, ?, ?, 1, 0)
                """, 96L, TENANT_T001, "no-permission-test-user", "{noop}password", "No Permission Test User");
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (?, ?, 1)",
                96L, TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)",
                96L, "NO_PERMISSION", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 96L, 96L);
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, tenant_id, username, password, real_name, dept_id, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0)
                """, 94L, TENANT_T001, "self-scope-test-user", "{noop}password", "Self Scope Test User", 10L);
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (?, ?, 1)",
                94L, TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)",
                94L, "SELF_ONLY", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 94L, 94L);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?)",
                TENANT_T001, 94L, "SELF");
        jdbcTemplate.update("INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                10L, TENANT_T001, "总部", "HQ", 0L, 1, "1", 0);
        List<String> actionPermissions = List.copyOf(TenantAdminPermissionPackage.permissionCodes());
        for (int index = 0; index < actionPermissions.size(); index++) {
            long permissionId = 10L + index;
            String permissionCode = actionPermissions.get(index);
            jdbcTemplate.update("INSERT INTO sys_permission (id, permission_code, permission_name, status, deleted) VALUES (?, ?, ?, 1, 0)",
                    permissionId, permissionCode, permissionCode);
            jdbcTemplate.update("INSERT INTO sys_role_permission (role_id, permission_id) VALUES (?, ?)", 1L, permissionId);
            jdbcTemplate.update("INSERT INTO sys_role_permission (role_id, permission_id) VALUES (?, ?)", 98L, permissionId);
        }
        List<String> workflowDesignerPermissions = List.of(
                "system:flow:query",
                "workflow:designer:edit",
                "workflow:designer:publish",
                "workflow:designer:rollback");
        for (int index = 0; index < workflowDesignerPermissions.size(); index++) {
            long permissionId = 900L + index;
            String permissionCode = workflowDesignerPermissions.get(index);
            jdbcTemplate.update("INSERT INTO sys_permission (id, permission_code, permission_name, status, deleted) VALUES (?, ?, ?, 1, 0)",
                    permissionId, permissionCode, permissionCode);
        }
        List<String> controlledPermissions = List.of(
                "inventory:query",
                "inventory:create",
                "inventory:update",
                "inventory:scan",
                "asset:category:query",
                "vendor:vendor:query",
                "location:query");
        for (int index = 0; index < controlledPermissions.size(); index++) {
            long permissionId = 1000L + index;
            String permissionCode = controlledPermissions.get(index);
            jdbcTemplate.update("INSERT INTO sys_permission (id, permission_code, permission_name, status, deleted) VALUES (?, ?, ?, 1, 0)",
                    permissionId, permissionCode, permissionCode);
        }
        grantPermissionToRole(1L, "inventory:query");
        grantPermissionToRole(97L, "inventory:query");
        grantPermissionToRole(97L, "asset:category:query");
        grantPermissionToRole(97L, "vendor:vendor:query");
        grantPermissionToRole(97L, "location:query");
    }

    @Test
    @Transactional
    void tenantAssetListOnlyReturnsCurrentTenantAssets() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status)
                VALUES (?, ?, ?, ?, ?)
                """, TENANT_T001, "TenantOne-List", "TENANT-LIST-A", 1L, "IDLE");
        jdbcTemplate.update("""
                INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status)
                VALUES (?, ?, ?, ?, ?)
                """, TENANT_T002, "TenantTwo-List", "TENANT-LIST-B", 1L, "IDLE");

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("TenantOne-List")
                        .doesNotContain("TenantTwo-List"));
    }

    @Test
    @Transactional
    void assetListAppliesStrictIntersectionForMultipleRoles() throws Exception {
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)", 2L, "DEPT_ROLE", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)", 3L, "SELF_ROLE", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?), (?, ?)", 1L, 2L, 1L, 3L);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?), (?, ?, ?)",
                TENANT_T001, 2L, "DEPT", TENANT_T001, 3L, "SELF");
        jdbcTemplate.update("INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                TENANT_T001, "Intersection-Allowed", "INTERSECTION-ALLOWED", 1L, "IDLE", 10L, 1L);
        jdbcTemplate.update("INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                TENANT_T001, "Intersection-Wrong-User", "INTERSECTION-WRONG-USER", 1L, "IDLE", 10L, 2L);
        jdbcTemplate.update("INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                TENANT_T001, "Intersection-Wrong-Dept", "INTERSECTION-WRONG-DEPT", 1L, "IDLE", 20L, 1L);

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Intersection-Allowed")
                        .doesNotContain("Intersection-Wrong-User")
                        .doesNotContain("Intersection-Wrong-Dept"));
    }

    @Test
    @Transactional
    void assetListAppliesDeptAndSubScope() throws Exception {
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)", 2L, "DEPT_SUB_ROLE", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 1L, 2L);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?)", TENANT_T001, 2L, "DEPT_AND_SUB");
        jdbcTemplate.update("INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)",
                11L, TENANT_T001, "子部门", "CHILD", 10L, 1, "1", 0,
                21L, TENANT_T002, "外部子部门", "OTHER-CHILD", 10L, 1, "1", 0);
        jdbcTemplate.update("INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status, dept_id) VALUES (?, ?, ?, ?, ?, ?)",
                TENANT_T001, "DeptAndSub-Root", "DEPT-SUB-ROOT", 1L, "IDLE", 10L);
        jdbcTemplate.update("INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status, dept_id) VALUES (?, ?, ?, ?, ?, ?)",
                TENANT_T001, "DeptAndSub-Child", "DEPT-SUB-CHILD", 1L, "IDLE", 11L);
        jdbcTemplate.update("INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status, dept_id) VALUES (?, ?, ?, ?, ?, ?)",
                TENANT_T001, "DeptAndSub-Outside", "DEPT-SUB-OUTSIDE", 1L, "IDLE", 20L);
        jdbcTemplate.update("INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status, dept_id) VALUES (?, ?, ?, ?, ?, ?)",
                TENANT_T001, "DeptAndSub-CrossTenantTree", "DEPT-SUB-CROSS", 1L, "IDLE", 21L);

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("DeptAndSub-Root")
                        .contains("DeptAndSub-Child")
                        .doesNotContain("DeptAndSub-Outside")
                        .doesNotContain("DeptAndSub-CrossTenantTree"));
    }

    @Test
    @Transactional
    void assetListDeniesUnknownAndEmptyScopes() throws Exception {
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)", 2L, "INVALID_SCOPE_ROLE", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 1L, 2L);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?)", TENANT_T001, 2L, "UNKNOWN_SCOPE");

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());

        jdbcTemplate.update("UPDATE sys_role_data_scope SET data_scope = ? WHERE tenant_id = ? AND role_id = ?", "", TENANT_T001, 2L);

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void assetListUsesOnlyExplicitCustomDepartmentsFromCurrentTenant() throws Exception {
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)", 2L, "CUSTOM_SCOPE_ROLE", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 1L, 2L);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?)", TENANT_T001, 2L, "CUSTOM");
        jdbcTemplate.update("INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)",
                20L, TENANT_T001, "自定义授权部门", "CUSTOM-ALLOW", 0L, 1, "1", 0,
                21L, TENANT_T001, "未授权部门", "CUSTOM-DENY", 0L, 1, "1", 0);
        jdbcTemplate.update("INSERT INTO sys_role_dept (tenant_id, role_id, dept_id) VALUES (?, ?, ?), (?, ?, ?)",
                TENANT_T001, 2L, 20L, TENANT_T002, 2L, 21L);
        jdbcTemplate.update("INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status, dept_id) VALUES (?, ?, ?, ?, ?, ?)",
                TENANT_T001, "Custom-Allowed", "CUSTOM-ALLOWED", 1L, "IDLE", 20L);
        jdbcTemplate.update("INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status, dept_id) VALUES (?, ?, ?, ?, ?, ?)",
                TENANT_T001, "Custom-Unassigned", "CUSTOM-UNASSIGNED", 1L, "IDLE", 21L);

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Custom-Allowed")
                        .doesNotContain("Custom-Unassigned"));
    }

    @Test
    @Transactional
    void assetListDeniesCustomScopeWithoutCurrentTenantDepartment() throws Exception {
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)", 2L, "EMPTY_CUSTOM_SCOPE_ROLE", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 1L, 2L);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?)", TENANT_T001, 2L, "CUSTOM");
        jdbcTemplate.update("INSERT INTO sys_role_dept (tenant_id, role_id, dept_id) VALUES (?, ?, ?)", TENANT_T002, 2L, 20L);

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void assetListDeniesRoleAssignedToAnotherTenant() throws Exception {
        jdbcTemplate.update("UPDATE sys_role SET tenant_id = ? WHERE id = ?", TENANT_T002, 1L);
        jdbcTemplate.update("UPDATE sys_role_data_scope SET tenant_id = ? WHERE role_id = ?", TENANT_T002, 1L);

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void jwtIsRejectedWhenUserNoLongerBelongsToClaimedTenant() throws Exception {
        jdbcTemplate.update("UPDATE sys_user SET tenant_id = ? WHERE id = ?", TENANT_T002, 1L);

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void publicRegistrationIsExplicitlyRejectedWithoutCreatingUser() throws Exception {
        Integer before = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sys_user", Integer.class);

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"public-user","password":"password123","realName":"Public User","deptId":10}
                                """))
                .andExpect(status().isForbidden());

        Integer after = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sys_user", Integer.class);
        assertThat(after).isEqualTo(before);
    }

    @Test
    @Transactional
    void explicitPlatformAdminProvisioningCreatesTenantAdminMembershipScopeAndAudit() throws Exception {
        mockMvc.perform(post("/tenants/provision")
                        .header("Authorization", "Bearer " + generatePlatformJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "tenantId":"T003",
                                  "tenantName":"Tenant Three",
                                  "adminUsername":"tenant-three-admin",
                                  "adminPassword":"strong-password",
                                  "adminRealName":"Tenant Three Admin"
                                }
                                """))
                .andExpect(status().isOk());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sys_tenant WHERE id = 'T003'", Integer.class))
                .isEqualTo(1);
        Long tenantAdminId = jdbcTemplate.queryForObject(
                "SELECT id FROM sys_user WHERE username = 'tenant-three-admin' AND tenant_id = 'T003'", Long.class);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys_user_tenant WHERE user_id = ? AND tenant_id = 'T003' AND status = 1",
                Integer.class, tenantAdminId)).isEqualTo(1);
        Long tenantAdminRoleId = jdbcTemplate.queryForObject(
                "SELECT id FROM sys_role WHERE tenant_id = 'T003' AND role_code = 'TENANT_ADMIN'", Long.class);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys_role_data_scope WHERE tenant_id = 'T003' AND role_id = ? AND data_scope = 'ALL'",
                Integer.class, tenantAdminRoleId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys_user_role WHERE user_id = ? AND role_id = ?",
                Integer.class, tenantAdminId, tenantAdminRoleId)).isEqualTo(1);
        assertNoWorkflowDesignerPermissions(tenantAdminRoleId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM general_audit_entry WHERE tenant_id = 'T003' AND operation_type = 'TENANT_PROVISION' "
                        + "AND operator_id = 99",
                Integer.class)).isEqualTo(1);
    }

    @Test
    @Transactional
    void provisionedTenantAdminCanLoginAndAccessBusinessEndpointWithFullActionPackage() throws Exception {
        mockMvc.perform(post("/tenants/provision")
                        .header("Authorization", "Bearer " + generatePlatformJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "tenantId":"T005",
                                  "tenantName":"Tenant Five",
                                  "adminUsername":"tenant-five-admin",
                                  "adminPassword":"test-only-password",
                                  "adminRealName":"Tenant Five Admin"
                                }
                                """))
                .andExpect(status().isOk());

        Long tenantAdminRoleId = jdbcTemplate.queryForObject(
                "SELECT id FROM sys_role WHERE tenant_id = 'T005' AND role_code = 'TENANT_ADMIN'", Long.class);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys_role_permission WHERE role_id = ?", Integer.class, tenantAdminRoleId))
                .isEqualTo(TenantAdminPermissionPackage.permissionCodes().size());
        assertNoWorkflowDesignerPermissions(tenantAdminRoleId);
        tenantAdminPermissionPackageService.bindToRole("T005", tenantAdminRoleId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys_role_permission WHERE role_id = ?", Integer.class, tenantAdminRoleId))
                .isEqualTo(TenantAdminPermissionPackage.permissionCodes().size());
        assertNoWorkflowDesignerPermissions(tenantAdminRoleId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT after_record FROM general_audit_entry WHERE tenant_id = 'T005' AND operation_type = 'TENANT_PROVISION'",
                String.class))
                .contains(TenantAdminPermissionPackage.PACKAGE_CODE)
                .contains("permissionCount=" + TenantAdminPermissionPackage.permissionCodes().size());

        var loginResult = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"tenant-five-admin\",\"password\":\"test-only-password\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = new ObjectMapper().readTree(loginResult.getResponse().getContentAsString())
                .path("data")
                .path("token")
                .asText();
        assertThat(token).isNotBlank();

        mockMvc.perform(get("/assets").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    @Transactional
    void workflowRuntimeUsesBusinessPermissionAndCurrentTenantPublishedSnapshot() throws Exception {
        String definitionJson = """
                {"name":"Published Transfer","nodes":[
                  {"id":"start","type":"START"},
                  {"id":"approval","type":"APPROVAL","config":{"approverType":"user","approverId":"99","approvalMode":"sequence"}},
                  {"id":"end","type":"END"}],
                 "edges":[{"source":"start","target":"approval"},{"source":"approval","target":"end"}]}
                """;
        jdbcTemplate.update("""
                INSERT INTO workflow_definition (id, tenant_id, business_type, name, description, definition_json,
                    status, version, updated_by, published_by, published_at, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0),
                    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0)
                """, 9901L, TENANT_T001, "ASSET_TRANSFER", "Tenant One Published Transfer", "Tenant One",
                definitionJson, "PUBLISHED", 1, 99L, 99L,
                9902L, TENANT_T002, "ASSET_TRANSFER", "Tenant Two Published Transfer", "Tenant Two",
                definitionJson, "PUBLISHED", 1, 99L, 99L);
        jdbcTemplate.update("""
                INSERT INTO workflow_definition_version (tenant_id, definition_id, business_type, version, action_type,
                    status, name, description, definition_json, operator_id, published_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP),
                    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, TENANT_T001, 9901L, "ASSET_TRANSFER", 1, "PUBLISH", "PUBLISHED",
                "Tenant One Published Transfer", "Tenant One", definitionJson, 99L,
                TENANT_T002, 9902L, "ASSET_TRANSFER", 1, "PUBLISH", "PUBLISHED",
                "Tenant Two Published Transfer", "Tenant Two", definitionJson, 99L);
        jdbcTemplate.update("""
                INSERT INTO workflow_definition_draft (tenant_id, business_type, name, description, definition_json, revision, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, TENANT_T001, "RETIREMENT", "Designer Draft Secret", "only designers may read this",
                definitionJson, 1, 99L);

        assertNoWorkflowDesignerPermissions(1L);
        assertNoWorkflowDesignerPermissions(98L);
        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("\"definitionId\":9901")
                        .doesNotContain("Tenant Two Published Transfer"));
        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer " + generateTenantAdminJwt()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/workflow-runtime/RETIREMENT/start-availability")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("\"status\":\"UNCONFIGURED\"")
                        .doesNotContain("Designer Draft Secret"));
    }

    @Test
    @Transactional
    void tenantScopedSuperAdminCannotProvisionAnotherTenant() throws Exception {
        jdbcTemplate.update("UPDATE sys_role SET role_code = 'SUPER_ADMIN' WHERE id = 1");

        mockMvc.perform(post("/tenants/provision")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "tenantId":"T004",
                                  "tenantName":"Tenant Four",
                                  "adminUsername":"tenant-four-admin",
                                  "adminPassword":"strong-password",
                                  "adminRealName":"Tenant Four Admin"
                                }
                                """))
                .andExpect(status().isForbidden());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sys_tenant WHERE id = 'T004'", Integer.class))
                .isZero();
    }

    @Test
    @Transactional
    void jwtIsRejectedWhenServerSideMembershipIsDisabled() throws Exception {
        jdbcTemplate.update("UPDATE sys_user_tenant SET status = 0 WHERE user_id = 1 AND tenant_id = ?", TENANT_T001);

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void jwtIsRejectedWhenAssignedRoleHasNoTenant() throws Exception {
        jdbcTemplate.update("UPDATE sys_role SET tenant_id = NULL WHERE id = 1");

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void assetDetailWritesGisAndDashboardUseTheSameScopePolicy() throws Exception {
        jdbcTemplate.update("UPDATE sys_role_data_scope SET data_scope = ? WHERE tenant_id = ? AND role_id = ?", "SELF", TENANT_T001, 1L);
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, user_id, location_lat, location_lng)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, 7001L, TENANT_T001, "Self-Allowed", "SELF-ALLOWED", 1L, "IDLE", 1L, new java.math.BigDecimal("30.1"), new java.math.BigDecimal("120.1"),
                7002L, TENANT_T001, "Self-Denied", "SELF-DENIED", 1L, "IDLE", 2L, new java.math.BigDecimal("30.2"), new java.math.BigDecimal("120.2"));

        mockMvc.perform(get("/assets/{id}", 7002L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/assets/{id}", 7002L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + "\"assetName\":\"Blocked\",\"categoryId\":1}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/assets/{id}", 7002L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/gis/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Self-Allowed")
                        .doesNotContain("Self-Denied"));
        mockMvc.perform(put("/gis/assets/{id}/location", 7002L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + "\"lat\":30.3,\"lng\":120.3}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/dashboard/stats")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("\"totalAssets\":1"));

        String deniedName = jdbcTemplate.queryForObject("SELECT asset_name FROM asset WHERE id = ?", String.class, 7002L);
        assertThat(deniedName).isEqualTo("Self-Denied");
    }

    @Test
    @Transactional
    void retirementAndCompensationQueriesUseTheRelatedAssetScope() throws Exception {
        jdbcTemplate.update("UPDATE sys_role_data_scope SET data_scope = ? WHERE tenant_id = ? AND role_id = ?", "SELF", TENANT_T001, 1L);
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
                """, 7101L, TENANT_T001, "Related-Allowed", "RELATED-ALLOWED", 1L, "IDLE", 1L,
                7102L, TENANT_T001, "Related-Denied", "RELATED-DENIED", 1L, "IDLE", 2L);
        jdbcTemplate.update("""
                INSERT INTO retirement_application (id, tenant_id, application_no, asset_id, asset_name, asset_code, applicant_id, reason, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0), (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, 7201L, TENANT_T001, "RA-RELATED-ALLOWED", 7101L, "Related-Allowed", "RELATED-ALLOWED", 1L, "报废", "PENDING",
                7202L, TENANT_T001, "RA-RELATED-DENIED", 7102L, "Related-Denied", "RELATED-DENIED", 1L, "报废", "PENDING");
        jdbcTemplate.update("""
                INSERT INTO asset_compensation (id, tenant_id, compensation_no, asset_id, compensation_type, compensation_amount, responsible_user_id, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0), (?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, 7301L, TENANT_T001, "CMP-RELATED-ALLOWED", 7101L, "损坏", new java.math.BigDecimal("100.00"), 1L, "PENDING",
                7302L, TENANT_T001, "CMP-RELATED-DENIED", 7102L, "损坏", new java.math.BigDecimal("100.00"), 1L, "PENDING");

        String token = generateTenantJwt(TENANT_T001);
        mockMvc.perform(get("/retirement/applications").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("RA-RELATED-ALLOWED")
                        .doesNotContain("RA-RELATED-DENIED"));
        mockMvc.perform(get("/retirement/my-applications").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("RA-RELATED-ALLOWED")
                        .doesNotContain("RA-RELATED-DENIED"));
        mockMvc.perform(get("/retirement/statistics").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("\"pendingCount\":1"));
        mockMvc.perform(get("/retirement/{id}", 7202L).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/compensation/list").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("CMP-RELATED-ALLOWED")
                        .doesNotContain("CMP-RELATED-DENIED"));
        mockMvc.perform(get("/compensation/{id}", 7302L).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void genericApprovalRoutesApplyRetirementRelatedAssetScope() throws Exception {
        jdbcTemplate.update("UPDATE sys_role_data_scope SET data_scope = ? WHERE tenant_id = ? AND role_id = ?", "SELF", TENANT_T001, 1L);
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, 7351L, TENANT_T001, "Approval Scope Denied", "APPROVAL-SCOPE-DENIED", 1L, "IDLE", 2L);
        jdbcTemplate.update("""
                INSERT INTO retirement_application (id, tenant_id, application_no, asset_id, asset_name, asset_code, applicant_id, reason, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, 7352L, TENANT_T001, "RA-APPROVAL-SCOPE-DENIED", 7351L, "Approval Scope Denied",
                "APPROVAL-SCOPE-DENIED", 2L, "报废", "PENDING");
        jdbcTemplate.update("""
                INSERT INTO approval_process (id, process_no, process_type, business_id, tenant_id, status, current_step, applicant_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, 7353L, "APR-APPROVAL-SCOPE-DENIED", "RETIREMENT", 7352L, TENANT_T001, "PENDING", 1, 2L);

        String token = generateTenantJwt(TENANT_T001);
        mockMvc.perform(get("/approvals/list").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .doesNotContain("APR-APPROVAL-SCOPE-DENIED"));
        mockMvc.perform(get("/approvals/{id}", 7353L).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/approvals/{id}/approve", 7353L)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + "\"result\":\"APPROVED\",\"opinion\":\"Blocked\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void dashboardPendingApprovalsUsesTheSameRelatedAssetScope() throws Exception {
        jdbcTemplate.update("UPDATE sys_role_data_scope SET data_scope = ? WHERE tenant_id = ? AND role_id = ?", "SELF", TENANT_T001, 1L);
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
                """, 7701L, TENANT_T001, "Dashboard Allowed", "DASHBOARD-ALLOWED", 1L, "IDLE", 1L,
                7702L, TENANT_T001, "Dashboard Denied", "DASHBOARD-DENIED", 1L, "IDLE", 2L);
        jdbcTemplate.update("""
                INSERT INTO retirement_application (id, tenant_id, application_no, asset_id, asset_name, asset_code, applicant_id, reason, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0), (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, 7801L, TENANT_T001, "RA-DASHBOARD-ALLOWED", 7701L, "Dashboard Allowed", "DASHBOARD-ALLOWED", 1L, "报废", "PENDING",
                7802L, TENANT_T001, "RA-DASHBOARD-DENIED", 7702L, "Dashboard Denied", "DASHBOARD-DENIED", 1L, "报废", "PENDING");

        mockMvc.perform(get("/dashboard/pending-approvals")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("\"data\":1"));
    }

    @Test
    @Transactional
    void relatedAssetQueriesUseOnlyExplicitCustomDepartments() throws Exception {
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, tenant_id, status, deleted) VALUES (?, ?, ?, 1, 0)", 2L, "RELATED_CUSTOM", TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 1L, 2L);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?)", TENANT_T001, 2L, "CUSTOM");
        jdbcTemplate.update("""
                INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)
                """, 20L, TENANT_T001, "关联授权部门", "RELATED-CUSTOM-ALLOW", 0L, 1, "1", 0,
                21L, TENANT_T001, "关联未授权部门", "RELATED-CUSTOM-DENY", 0L, 1, "1", 0);
        jdbcTemplate.update("INSERT INTO sys_role_dept (tenant_id, role_id, dept_id) VALUES (?, ?, ?)", TENANT_T001, 2L, 20L);
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id)
                VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
                """, 7401L, TENANT_T001, "Related-Custom-Allowed", "RELATED-CUSTOM-ALLOWED", 1L, "IDLE", 20L,
                7402L, TENANT_T001, "Related-Custom-Denied", "RELATED-CUSTOM-DENIED", 1L, "IDLE", 21L);
        jdbcTemplate.update("""
                INSERT INTO retirement_application (id, tenant_id, application_no, asset_id, asset_name, asset_code, applicant_id, reason, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0), (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, 7501L, TENANT_T001, "RA-CUSTOM-ALLOWED", 7401L, "Related-Custom-Allowed", "RELATED-CUSTOM-ALLOWED", 1L, "报废", "PENDING",
                7502L, TENANT_T001, "RA-CUSTOM-DENIED", 7402L, "Related-Custom-Denied", "RELATED-CUSTOM-DENIED", 1L, "报废", "PENDING");
        jdbcTemplate.update("""
                INSERT INTO asset_compensation (id, tenant_id, compensation_no, asset_id, compensation_type, compensation_amount, responsible_user_id, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0), (?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, 7601L, TENANT_T001, "CMP-CUSTOM-ALLOWED", 7401L, "损坏", new java.math.BigDecimal("100.00"), 1L, "PENDING",
                7602L, TENANT_T001, "CMP-CUSTOM-DENIED", 7402L, "损坏", new java.math.BigDecimal("100.00"), 1L, "PENDING");

        String token = generateTenantJwt(TENANT_T001);
        mockMvc.perform(get("/retirement/applications").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("RA-CUSTOM-ALLOWED")
                        .doesNotContain("RA-CUSTOM-DENIED"));
        mockMvc.perform(get("/compensation/list").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("CMP-CUSTOM-ALLOWED")
                        .doesNotContain("CMP-CUSTOM-DENIED"));
    }

    @Test
    @Transactional
    void departmentReparentingStaysWithinTenantAndRejectsCycles() throws Exception {
        jdbcTemplate.update("INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)",
                11L, TENANT_T001, "Tenant Child", "T1-CHILD", 10L, 1, "1", 0,
                20L, TENANT_T002, "Other Root", "T2-ROOT", 0L, 1, "1", 0);

        mockMvc.perform(put("/depts/{id}", 11L)
                        .header("Authorization", "Bearer " + generateTenantAdminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + "\"name\":\"Tenant Child\",\"deptCode\":\"T1-CHILD\",\"parentId\":20}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/depts/{id}", 10L)
                        .header("Authorization", "Bearer " + generateTenantAdminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + "\"name\":\"总部\",\"deptCode\":\"HQ\",\"parentId\":11}"))
                .andExpect(status().isBadRequest());
        Long parentId = jdbcTemplate.queryForObject("SELECT parent_id FROM sys_dept WHERE id = ?", Long.class, 11L);
        assertThat(parentId).isEqualTo(10L);

    }

    @Test
    void departmentWriteWithoutPermissionIsRejected() throws Exception {
        expectActionDenied("dept:create", post("/depts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"name\":\"Blocked\",\"deptCode\":\"BLOCKED\",\"parentId\":0}"));
        expectActionDenied("dept:delete", delete("/depts/{id}", 10L));
    }

    @Test
    @Transactional
    void roleCodeIsUniquePerTenantAndRoleWritesAreTenantScoped() throws Exception {
        mockMvc.perform(post("/roles")
                        .header("Authorization", "Bearer " + generateTenantAdminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + "\"roleName\":\"Duplicate\",\"roleCode\":\"USER\"}"))
                .andExpect(status().isBadRequest());
        jdbcTemplate.update("INSERT INTO sys_role (id, tenant_id, role_name, role_code, status, deleted) VALUES (?, ?, ?, ?, 1, 0)",
                2L, TENANT_T002, "Other Tenant User", "USER");
        Integer tenantTwoRoles = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sys_role WHERE tenant_id = ? AND role_code = ?", Integer.class,
                TENANT_T002, "USER");
        assertThat(tenantTwoRoles).isEqualTo(1);
    }

    @Test
    void assetActionPermissionsFailClosedWithoutTheMatchingActionCode() throws Exception {
        expectActionDenied("asset:query", get("/assets"));
        expectActionDenied("asset:create", post("/assets")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"assetName\":\"Denied\",\"categoryId\":1}"));
        expectActionDenied("asset:update", put("/assets/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"assetName\":\"Denied\",\"categoryId\":1}"));
        expectActionDenied("asset:delete", delete("/assets/{id}", 1L));
    }

    @Test
    void retirementActionPermissionsFailClosedWithoutTheMatchingActionCode() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO approval_process (id, process_no, process_type, business_id, tenant_id, status, current_step, applicant_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, 8801L, "APR-RETIREMENT-ACTION-GUARD", "RETIREMENT", 1L, TENANT_T001, "PENDING", 1, 2L);
        expectActionDenied("retirement:query", get("/retirement/applications"));
        expectActionDenied("retirement:query", get("/approvals/{id}", 8801L));
        expectActionDenied("retirement:create", post("/retirement/apply")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"assetId\":1,\"reason\":\"Denied\",\"retirementType\":\"SCRAP\"}"));
        expectActionDenied("retirement:update", put("/retirement/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"assetId\":1,\"reason\":\"Denied\",\"retirementType\":\"SCRAP\"}"));
        expectActionDenied("retirement:approve", post("/retirement/{id}/approve", 1L));
        expectActionDenied("retirement:approve", post("/approvals/{id}/approve", 8801L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"result\":\"APPROVED\",\"opinion\":\"Denied\"}"));
        expectActionDenied("retirement:delete", delete("/retirement/{id}", 1L));
    }

    @Test
    void compensationActionPermissionsFailClosedWithoutTheMatchingActionCode() throws Exception {
        expectActionDenied("compensation:query", get("/compensation/list"));
        expectActionDenied("compensation:create", post("/compensation")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"assetId\":1,\"responsibleUserId\":1,\"compensationType\":\"DAMAGE\"}"));
        expectActionDenied("compensation:update", put("/compensation/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"description\":\"Denied\"}"));
        expectActionDenied("compensation:approve", put("/compensation/{id}/status", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"status\":\"APPROVED\"}"));
        expectActionDenied("compensation:delete", delete("/compensation/{id}", 1L));
    }

    @Test
    void disposalAndAssetDerivedViewsFailClosedWithoutTheirActionCodes() throws Exception {
        expectActionDenied("disposal:query", get("/disposals/history"));
        expectActionDenied("disposal:create", post("/disposals/transfer")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"assetId\":1,\"targetDeptId\":10,\"reason\":\"Denied\"}"));
        expectActionDenied("asset:query", get("/gis/assets"));
        expectActionDenied("asset:update", put("/gis/assets/{id}/location", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{" + "\"lat\":30.1,\"lng\":120.1}"));
        expectActionDenied("asset:query", get("/dashboard/stats"));
    }

    @Test
    @Transactional
    void departmentQueriesAreTenantAdminOnlyAndNeverCrossTenant() throws Exception {
        jdbcTemplate.update("INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                20L, TENANT_T002, "Other Tenant Department", "T2-ROOT", 0L, 1, "1", 0);

        mockMvc.perform(get("/depts/tree")
                        .header("Authorization", "Bearer " + generateTenantAdminJwt()))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("总部")
                        .doesNotContain("Other Tenant Department"));
    }

    @Test
    @Transactional
    void onlyTenantAdminCanCreateTenantMembersAndCreationWritesMembershipAndAudit() throws Exception {
        String createBody = """
                {"username":"created-user","password":"password123456","realName":"Created User"}
                """;
        mockMvc.perform(post("/users")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/users")
                        .header("Authorization", "Bearer " + generateTenantAdminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated());

        Long createdUserId = jdbcTemplate.queryForObject("SELECT id FROM sys_user WHERE username = 'created-user'", Long.class);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys_user_tenant WHERE user_id = ? AND tenant_id = ? AND status = 1",
                Integer.class, createdUserId, TENANT_T001)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM general_audit_entry WHERE tenant_id = ? AND operation_type = 'USER_CREATE' "
                        + "AND resource_id = CAST(? AS VARCHAR)",
                Integer.class, TENANT_T001, createdUserId)).isEqualTo(1);
    }

    @Test
    void missingTenantIdentifierIsRejectedForAssetRequests() throws Exception {
        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateJwt(Map.of())))
                .andExpect(status().isForbidden());

        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void missingTenantIdentifierIsRejectedForNonAssetBusinessRequests() throws Exception {
        mockMvc.perform(get("/dashboard/stats")
                        .header("Authorization", "Bearer " + generateJwt(Map.of())))
                .andExpect(status().isForbidden());

        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    @Transactional
    void dashboardStatsOnlyCountsCurrentTenantAssets() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status)
                VALUES (?, ?, ?, ?, ?)
                """, TENANT_T001, "TenantOne-Dashboard", "TENANT-DASH-A", 1L, "IDLE");
        jdbcTemplate.update("""
                INSERT INTO asset (tenant_id, asset_name, asset_no, category_id, status)
                VALUES (?, ?, ?, ?, ?)
                """, TENANT_T002, "TenantTwo-Dashboard", "TENANT-DASH-B", 1L, "IDLE");

        mockMvc.perform(get("/dashboard/stats")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("\"totalAssets\":1"));
    }

    @Test
    @Transactional
    void tenantWorkOrderListOnlyReturnsCurrentTenantWorkOrders() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status)
                VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)
                """, 9401L, TENANT_T001, "TenantOne-WorkOrder-Asset", "TENANT-WO-ASSET-A", 1L, "IDLE",
                9402L, TENANT_T002, "TenantTwo-WorkOrder-Asset", "TENANT-WO-ASSET-B", 1L, "IDLE");
        jdbcTemplate.update("""
                INSERT INTO work_order (tenant_id, work_order_no, title, status, asset_id)
                VALUES (?, ?, ?, ?, ?)
                """, TENANT_T001, "WO-T001", "TenantOne-WorkOrder", "DRAFT", 9401L);
        jdbcTemplate.update("""
                INSERT INTO work_order (tenant_id, work_order_no, title, status, asset_id)
                VALUES (?, ?, ?, ?, ?)
                """, TENANT_T002, "WO-T002", "TenantTwo-WorkOrder", "DRAFT", 9402L);

        mockMvc.perform(get("/work-orders")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("TenantOne-WorkOrder")
                        .doesNotContain("TenantTwo-WorkOrder"));
    }

    @Test
    @Transactional
    void workOrderAndApprovalOnlyExposeSupportedProcessesWithAccessibleAssets() throws Exception {
        jdbcTemplate.update("UPDATE sys_role_data_scope SET data_scope = ? WHERE tenant_id = ? AND role_id = ?",
                "SELF", TENANT_T001, 1L);
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
                """, 9501L, TENANT_T001, "Scoped-Allowed-Asset", "SCOPE-WO-A", 1L, "IDLE", 1L,
                9502L, TENANT_T001, "Scoped-Denied-Asset", "SCOPE-WO-B", 1L, "IDLE", 2L,
                9503L, TENANT_T002, "Cross-Tenant-Asset", "SCOPE-WO-C", 1L, "IDLE", 1L);
        jdbcTemplate.update("""
                INSERT INTO work_order (id, tenant_id, work_order_no, title, status, asset_id, reporter_id)
                VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
                """, 9511L, TENANT_T001, "WO-SCOPE-ALLOWED", "Scoped-Allowed-WorkOrder", "PENDING", 9501L, 2L,
                9512L, TENANT_T001, "WO-SCOPE-DENIED", "Scoped-Denied-WorkOrder", "PENDING", 9502L, 2L,
                9513L, TENANT_T001, "WO-CROSS-TENANT", "Cross-Tenant-WorkOrder", "PENDING", 9503L, 2L);
        jdbcTemplate.update("""
                INSERT INTO approval_process (id, process_no, process_type, business_id, tenant_id, status, current_step, applicant_id, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0), (?, ?, ?, ?, ?, ?, ?, ?, 0), (?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, 9521L, "APR-WO-ALLOWED", "WORK_ORDER", 9511L, TENANT_T001, "PENDING", 1, 2L,
                9522L, "APR-WO-DENIED", "WORK_ORDER", 9512L, TENANT_T001, "PENDING", 1, 2L,
                9523L, "APR-UNKNOWN", "UNKNOWN_FLOW", 9511L, TENANT_T001, "PENDING", 1, 2L);

        mockMvc.perform(get("/work-orders").header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Scoped-Allowed-WorkOrder")
                        .doesNotContain("Scoped-Denied-WorkOrder")
                        .doesNotContain("Cross-Tenant-WorkOrder"));
        mockMvc.perform(get("/work-orders/{id}", 9512L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/work-orders/{id}", 9513L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/approvals/list").header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("APR-WO-ALLOWED")
                        .doesNotContain("APR-WO-DENIED")
                        .doesNotContain("APR-UNKNOWN"));
        mockMvc.perform(get("/approvals/{id}", 9522L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/approvals/{id}", 9523L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/work-orders/{id}/approve", 9511L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/approvals")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"processType\":\"UNKNOWN_FLOW\",\"title\":\"blocked\",\"businessId\":9511}"))
                .andExpect(status().isForbidden());

    }

    @Test
    void workOrderAndApprovalQueryRoutesFailClosedWithoutActionCodes() throws Exception {
        expectActionDenied("workorder:query", get("/work-orders"));
        expectActionDenied("approval:query", get("/approvals/list"));
    }

    @Test
    @Transactional
    void maintenanceAndIdleAssetOperationsUseActionAndRelatedAssetScope() throws Exception {
        jdbcTemplate.update("UPDATE sys_role_data_scope SET data_scope = ? WHERE tenant_id = ? AND role_id = ?",
                "SELF", TENANT_T001, 1L);
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
                """, 9601L, TENANT_T001, "Maintenance-Allowed-Asset", "MAINT-A", 1L, "IDLE", 1L,
                9602L, TENANT_T001, "Maintenance-Denied-Asset", "MAINT-B", 1L, "IDLE", 2L,
                9603L, TENANT_T002, "Maintenance-Cross-Asset", "MAINT-C", 1L, "IDLE", 1L);
        jdbcTemplate.update("""
                INSERT INTO maintenance_record (id, tenant_id, asset_id, maintenance_type, maintenance_date, next_maintenance_date, executor, deleted)
                VALUES (?, ?, ?, ?, CURRENT_DATE, CURRENT_DATE, ?, 0), (?, ?, ?, ?, CURRENT_DATE, CURRENT_DATE, ?, 0), (?, ?, ?, ?, CURRENT_DATE, CURRENT_DATE, ?, 0)
                """, 9611L, TENANT_T001, 9601L, "ROUTINE", "allowed",
                9612L, TENANT_T001, 9602L, "ROUTINE", "denied",
                9613L, TENANT_T001, 9603L, "ROUTINE", "cross");
        jdbcTemplate.update("""
                INSERT INTO idle_asset_notice (id, tenant_id, asset_id, idle_days, notice_date, status, deleted)
                VALUES (?, ?, ?, ?, CURRENT_DATE, ?, 0), (?, ?, ?, ?, CURRENT_DATE, ?, 0), (?, ?, ?, ?, CURRENT_DATE, ?, 0)
                """, 9621L, TENANT_T001, 9601L, 30, "PUBLISHED",
                9622L, TENANT_T001, 9602L, 30, "PUBLISHED",
                9623L, TENANT_T001, 9603L, 30, "PUBLISHED");

        mockMvc.perform(get("/maintenance/list").header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("allowed")
                        .doesNotContain("denied")
                        .doesNotContain("cross"));
        mockMvc.perform(get("/maintenance/upcoming").header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("allowed")
                        .doesNotContain("denied"));
        mockMvc.perform(get("/maintenance/{id}", 9612L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/maintenance/{id}", 9612L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"maintenanceType\":\"ROUTINE\",\"content\":\"blocked\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/maintenance/{id}", 9613L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/maintenance")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":9603,\"maintenanceType\":\"ROUTINE\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/idle-assets/list").header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("\"id\":9621")
                        .doesNotContain("\"id\":9622")
                        .doesNotContain("\"id\":9623"));
        mockMvc.perform(get("/idle-assets/{id}", 9622L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/idle-assets/{id}/cancel", 9623L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/idle-assets/{id}", 9622L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/idle-assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":9603,\"idleDays\":30}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/idle-assets/{id}/claim", 9621L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk());
        assertThat(jdbcTemplate.queryForObject("SELECT status FROM idle_asset_notice WHERE id = 9621", String.class))
                .isEqualTo("CLAIMED");
    }

    @Test
    void maintenanceAndIdleAssetQueryRoutesFailClosedWithoutActionCodes() throws Exception {
        expectActionDenied("maintenance:query", get("/maintenance/list"));
        expectActionDenied("idleasset:query", get("/idle-assets/list"));
    }

    @Test
    void tenantManagementRoutesFailClosedWithoutTheirActionCodes() throws Exception {
        expectActionDenied("user:query", get("/users/list"));
        expectActionDenied("role:query", get("/roles/list"));
        expectActionDenied("dept:query", get("/depts/tree"));
    }

    @Test
    @Transactional
    void tenantInventoryTaskListOnlyReturnsCurrentTenantTasks() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)
                """, 9691L, TENANT_T001, "TenantOne-Inventory-Asset", "INV-T001-ASSET", 1L, "IDLE", 10L, 1L,
                9692L, TENANT_T002, "TenantTwo-Inventory-Asset", "INV-T002-ASSET", 1L, "IDLE", 10L, 1L);
        jdbcTemplate.update("""
                INSERT INTO inventory_task (id, tenant_id, task_no, task_name, inventory_type, status, dept_ids)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, 9691L, TENANT_T001, "INV-T001", "TenantOne-Inventory", "FULL", "DRAFT", "10");
        jdbcTemplate.update("""
                INSERT INTO inventory_task (id, tenant_id, task_no, task_name, inventory_type, status, dept_ids)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, 9692L, TENANT_T002, "INV-T002", "TenantTwo-Inventory", "FULL", "DRAFT", "10");
        jdbcTemplate.update("""
                INSERT INTO inventory_detail (tenant_id, task_id, asset_id, status)
                VALUES (?, ?, ?, ?), (?, ?, ?, ?)
                """, TENANT_T001, 9691L, 9691L, "PENDING", TENANT_T002, 9692L, 9692L, "PENDING");

        mockMvc.perform(get("/inventory/tasks")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("TenantOne-Inventory")
                        .doesNotContain("TenantTwo-Inventory"));
    }

    @Test
    @Transactional
    void inventoryRoutesFailClosedWithoutTheirActionCodes() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO inventory_task (id, tenant_id, task_no, task_name, inventory_type, status)
                VALUES (?, ?, ?, ?, ?, ?)
                """, 9701L, TENANT_T001, "INV-NO-PERM", "No Permission Inventory", "FULL", "DRAFT");

        mockMvc.perform(get("/inventory/tasks")
                        .header("Authorization", "Bearer " + generateNoPermissionJwt()))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/inventory/tasks")
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taskName\":\"Blocked Inventory\",\"inventoryType\":\"FULL\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/inventory/tasks/{id}/status", 9701L)
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/inventory/tasks/{id}/scan", 9701L)
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":1,\"rfidTag\":\"RFID-NO-PERM\",\"status\":\"MATCH\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void inventoryQueryPermissionAllowsReadOnlyWithinCurrentTenant() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, 9710L, TENANT_T001, "Query-Allowed-Inventory-Asset", "INV-QUERY-ASSET", 1L, "IDLE", 10L, 1L);
        jdbcTemplate.update("""
                INSERT INTO inventory_task (id, tenant_id, task_no, task_name, inventory_type, status, dept_ids)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, 9711L, TENANT_T001, "INV-QUERY-T001", "Query Allowed Inventory", "FULL", "DRAFT", "10");
        jdbcTemplate.update("""
                INSERT INTO inventory_detail (tenant_id, task_id, asset_id, status)
                VALUES (?, ?, ?, ?)
                """, TENANT_T001, 9711L, 9710L, "PENDING");
        jdbcTemplate.update("""
                INSERT INTO inventory_task (id, tenant_id, task_no, task_name, inventory_type, status)
                VALUES (?, ?, ?, ?, ?, ?)
                """, 9712L, TENANT_T002, "INV-QUERY-T002", "Other Tenant Inventory", "FULL", "DRAFT");
        mockMvc.perform(get("/inventory/tasks")
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt()))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Query Allowed Inventory")
                        .doesNotContain("Other Tenant Inventory"));
        mockMvc.perform(get("/inventory/tasks/{id}", 9712L)
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/inventory/tasks")
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taskName\":\"Read Only Inventory\",\"inventoryType\":\"FULL\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void inventoryReadsFailClosedForEmptyMixedAndCrossTenantRealAssetSets() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)
                """, 9721L, TENANT_T001, "Inventory-Visible-Asset", "INV-VISIBLE-ASSET", 1L, "IDLE", 10L, 1L,
                9722L, TENANT_T002, "Inventory-Cross-Tenant-Asset", "INV-CROSS-ASSET", 1L, "IDLE", 10L, 1L);
        insertInventoryTask(9721L, TENANT_T001, "INV-REAL-VISIBLE", "Visible Real Asset Task");
        insertInventoryTask(9722L, TENANT_T001, "INV-REAL-EMPTY", "Empty Real Asset Task");
        insertInventoryTask(9723L, TENANT_T001, "INV-REAL-MIXED", "Mixed Real Asset Task");
        insertInventoryTask(9724L, TENANT_T002, "INV-REAL-TENANT-TWO", "Tenant Two Real Asset Task");
        linkInventoryAsset(TENANT_T001, 9721L, 9721L);
        linkInventoryAsset(TENANT_T001, 9723L, 9721L);
        // 错配 tenant 的真实资产关联使整个任务不可安全判定，不能只隐藏其中一条明细。
        linkInventoryAsset(TENANT_T001, 9723L, 9722L);
        linkInventoryAsset(TENANT_T002, 9724L, 9722L);

        mockMvc.perform(get("/inventory/tasks?page=1&pageSize=1")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Visible Real Asset Task")
                        .doesNotContain("Empty Real Asset Task")
                        .doesNotContain("Mixed Real Asset Task")
                        .doesNotContain("Tenant Two Real Asset Task"));
        mockMvc.perform(get("/inventory/tasks/{id}", 9722L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/inventory/tasks/{id}", 9723L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/inventory/tasks/{id}/details", 9723L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/inventory/tasks/{id}", 9724L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Transactional
    void inventoryReadsUseActualAssetsForSelfDeptCustomAndAllScopes() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, 20L, TENANT_T001, "盘点自定义范围部门", "INVENTORY-CUSTOM", 0L, 2, "1", 0);
        createInventoryReader(91L, "inventory-dept-reader", 10L, "DEPT");
        createInventoryReader(92L, "inventory-custom-reader", 10L, "CUSTOM");
        jdbcTemplate.update("INSERT INTO sys_role_dept (tenant_id, role_id, dept_id) VALUES (?, ?, ?)",
                TENANT_T001, 92L, 20L);
        grantPermissionToRole(94L, "inventory:query");

        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)
                """, 9731L, TENANT_T001, "Self-Inventory-Asset", "INV-SELF-ASSET", 1L, "IDLE", 10L, 94L,
                9732L, TENANT_T001, "Dept-Inventory-Asset", "INV-DEPT-ASSET", 1L, "IDLE", 10L, 1L,
                9733L, TENANT_T001, "Custom-Inventory-Asset", "INV-CUSTOM-ASSET", 1L, "IDLE", 20L, 1L);
        insertInventoryTask(9731L, TENANT_T001, "INV-SELF-ONLY", "Self Only Inventory Task");
        insertInventoryTask(9732L, TENANT_T001, "INV-SELF-MIXED", "Self Mixed Inventory Task");
        insertInventoryTask(9733L, TENANT_T001, "INV-DEPT-ONLY", "Dept Only Inventory Task");
        insertInventoryTask(9734L, TENANT_T001, "INV-CUSTOM-ONLY", "Custom Only Inventory Task");
        insertInventoryTask(9735L, TENANT_T001, "INV-ALL-MIXED", "All Scope Inventory Task");
        linkInventoryAsset(TENANT_T001, 9731L, 9731L);
        linkInventoryAsset(TENANT_T001, 9732L, 9731L);
        linkInventoryAsset(TENANT_T001, 9732L, 9732L);
        linkInventoryAsset(TENANT_T001, 9733L, 9732L);
        linkInventoryAsset(TENANT_T001, 9734L, 9733L);
        linkInventoryAsset(TENANT_T001, 9735L, 9732L);
        linkInventoryAsset(TENANT_T001, 9735L, 9733L);

        mockMvc.perform(get("/inventory/tasks")
                        .header("Authorization", "Bearer " + generateSelfScopeJwt()))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Self Only Inventory Task")
                        .doesNotContain("Self Mixed Inventory Task")
                        .doesNotContain("Dept Only Inventory Task")
                        .doesNotContain("Custom Only Inventory Task"));
        mockMvc.perform(get("/inventory/tasks/{id}/details", 9732L)
                        .header("Authorization", "Bearer " + generateSelfScopeJwt()))
                .andExpect(status().isBadRequest());

        String deptToken = generateJwt("inventory-dept-reader", 91L, Map.of("tenant_id", TENANT_T001));
        mockMvc.perform(get("/inventory/tasks/{id}", 9733L).header("Authorization", "Bearer " + deptToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/inventory/tasks/{id}", 9734L).header("Authorization", "Bearer " + deptToken))
                .andExpect(status().isBadRequest());

        String customToken = generateJwt("inventory-custom-reader", 92L, Map.of("tenant_id", TENANT_T001));
        mockMvc.perform(get("/inventory/tasks/{id}", 9734L).header("Authorization", "Bearer " + customToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/inventory/tasks/{id}", 9733L).header("Authorization", "Bearer " + customToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/inventory/tasks/{id}/details?page=1&pageSize=1", 9735L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("\"total\":2"));
    }

    @Test
    @Transactional
    void inventoryQueryHidesTaskExistenceAndOutOfScopeDepartmentMetadata() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, 21L, TENANT_T001, "盘点受限范围外部门", "INVENTORY-ORACLE-OUTSIDE", 0L, 3, "1", 0);
        createInventoryReader(195L, "inventory-oracle-reader", 10L, "DEPT");
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)
                """, 9741L, TENANT_T001, "Inventory Visible Metadata Asset", "INV-METADATA-VISIBLE", 1L, "IDLE", 10L, 1L,
                9742L, TENANT_T001, "Inventory Outside Metadata Asset", "INV-METADATA-OUTSIDE", 1L, "IDLE", 21L, 1L,
                9743L, TENANT_T002, "Inventory Cross Metadata Asset", "INV-METADATA-CROSS", 1L, "IDLE", 10L, 1L);
        insertInventoryTask(9741L, TENANT_T001, "INV-METADATA-VISIBLE", "Visible Metadata Task");
        insertInventoryTask(9742L, TENANT_T001, "INV-METADATA-OUTSIDE", "Outside Metadata Task");
        insertInventoryTask(9743L, TENANT_T002, "INV-METADATA-CROSS", "Cross Metadata Task");
        jdbcTemplate.update("UPDATE inventory_task SET dept_ids = ? WHERE id = ?", "10,21,999", 9741L);
        linkInventoryAsset(TENANT_T001, 9741L, 9741L);
        linkInventoryAsset(TENANT_T001, 9742L, 9742L);
        linkInventoryAsset(TENANT_T002, 9743L, 9743L);

        String restrictedToken = generateJwt("inventory-oracle-reader", 195L, Map.of("tenant_id", TENANT_T001));
        String outsideScope = mockMvc.perform(get("/inventory/tasks/{id}", 9742L)
                        .header("Authorization", "Bearer " + restrictedToken))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String crossTenant = mockMvc.perform(get("/inventory/tasks/{id}", 9743L)
                        .header("Authorization", "Bearer " + restrictedToken))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String missing = mockMvc.perform(get("/inventory/tasks/{id}", 9744L)
                        .header("Authorization", "Bearer " + restrictedToken))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(outsideScope).isEqualTo(crossTenant).isEqualTo(missing)
                .contains("盘点任务不存在")
                .doesNotContain("Outside Metadata Task")
                .doesNotContain("Cross Metadata Task");

        String outsideDetails = mockMvc.perform(get("/inventory/tasks/{id}/details", 9742L)
                        .header("Authorization", "Bearer " + restrictedToken))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String crossTenantDetails = mockMvc.perform(get("/inventory/tasks/{id}/details", 9743L)
                        .header("Authorization", "Bearer " + restrictedToken))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String missingDetails = mockMvc.perform(get("/inventory/tasks/{id}/details", 9744L)
                        .header("Authorization", "Bearer " + restrictedToken))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(outsideDetails).isEqualTo(crossTenantDetails).isEqualTo(missingDetails)
                .isEqualTo(outsideScope);

        String restrictedList = mockMvc.perform(get("/inventory/tasks")
                        .header("Authorization", "Bearer " + restrictedToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String restrictedDetail = mockMvc.perform(get("/inventory/tasks/{id}", 9741L)
                        .header("Authorization", "Bearer " + restrictedToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(restrictedList).contains("Visible Metadata Task").doesNotContain("10,21,999");
        assertThat(restrictedDetail).contains("Visible Metadata Task").doesNotContain("10,21,999");

        mockMvc.perform(get("/inventory/tasks/{id}", 9741L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("10,21,999"));
    }

    @Test
    @Transactional
    void inventoryStateMachineRejectsForgedCreationAndSkippedApproval() throws Exception {
        grantPermissionToRole(1L, "inventory:create");
        grantPermissionToRole(1L, "inventory:update");
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, 9901L, TENANT_T001, "Inventory-Creation-Asset", "INV-CREATE-ASSET", 1L, "IDLE", 10L, 1L);

        mockMvc.perform(post("/inventory/tasks")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"taskName":"Forged Creation","inventoryType":"FULL","deptIds":"10","status":"APPROVED"}
                                """))
                .andExpect(status().isOk());

        Long taskId = jdbcTemplate.queryForObject(
                "SELECT id FROM inventory_task WHERE task_name = ?", Long.class, "Forged Creation");
        assertThat(jdbcTemplate.queryForObject("SELECT status FROM inventory_task WHERE id = ?", String.class, taskId))
                .isEqualTo("DRAFT");

        mockMvc.perform(put("/inventory/tasks/{id}/status", taskId)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}"))
                .andExpect(status().isBadRequest());
        assertThat(jdbcTemplate.queryForObject("SELECT status FROM inventory_task WHERE id = ?", String.class, taskId))
                .isEqualTo("DRAFT");

        mockMvc.perform(post("/inventory/tasks")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taskName\":\"Invalid Type\",\"inventoryType\":\"FORGED\",\"deptIds\":\"10\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Transactional
    void inventoryScanEnforcesTenantDataRangeTaskScopeStateAndDeduplication() throws Exception {
        grantPermissionToRole(1L, "inventory:scan");
        jdbcTemplate.update("""
                INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, 20L, TENANT_T001, "盘点范围外部门", "INV-OUTSIDE", 0L, 2, "1", 0);
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)
                """, 9902L, TENANT_T002, "Cross-Tenant", "INV-CROSS", 1L, "IDLE", 10L, 1L,
                9903L, TENANT_T001, "Outside-Task", "INV-OUTSIDE-ASSET", 1L, "IDLE", 20L, 1L,
                9904L, TENANT_T001, "Draft-Task", "INV-DRAFT-ASSET", 1L, "IDLE", 10L, 1L,
                9905L, TENANT_T001, "Duplicate-Task", "INV-DUPLICATE-ASSET", 1L, "IDLE", 10L, 1L);
        jdbcTemplate.update("""
                INSERT INTO inventory_task (id, tenant_id, task_no, task_name, inventory_type, status, dept_ids, total_count, executor_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, 9910L, TENANT_T001, "INV-CROSS-TASK", "Cross Tenant Scan", "FULL", "IN_PROGRESS", "10", 1, 1L,
                9911L, TENANT_T001, "INV-SCOPE-TASK", "Scope Scan", "FULL", "IN_PROGRESS", "10", 1, 1L,
                9912L, TENANT_T001, "INV-DRAFT-TASK", "Draft Scan", "FULL", "DRAFT", "10", 1, 1L);
        jdbcTemplate.update("""
                INSERT INTO inventory_detail (tenant_id, task_id, asset_id, status)
                VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)
                """, TENANT_T001, 9910L, 9902L, "PENDING",
                TENANT_T001, 9911L, 9904L, "PENDING",
                TENANT_T001, 9912L, 9904L, "PENDING");

        mockMvc.perform(post("/inventory/tasks/{id}/scan", 9910L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":9902,\"status\":\"MATCH\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/inventory/tasks/{id}/scan", 9911L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":9903,\"status\":\"MATCH\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/inventory/tasks/{id}/scan", 9912L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":9904,\"status\":\"MATCH\"}"))
                .andExpect(status().isBadRequest());

        jdbcTemplate.update("""
                INSERT INTO inventory_task (id, tenant_id, task_no, task_name, inventory_type, status, dept_ids, total_count, executor_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, 9913L, TENANT_T001, "INV-DUPLICATE-TASK", "Duplicate Scan", "FULL", "IN_PROGRESS", "10", 1, 1L);
        jdbcTemplate.update("""
                INSERT INTO inventory_detail (tenant_id, task_id, asset_id, status)
                VALUES (?, ?, ?, ?)
                """, TENANT_T001, 9913L, 9905L, "PENDING");
        mockMvc.perform(post("/inventory/tasks/{id}/scan", 9913L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":9905,\"status\":\"MATCH\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/inventory/tasks/{id}/scan", 9913L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":9905,\"status\":\"MATCH\"}"))
                .andExpect(status().isBadRequest());
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM inventory_detail WHERE task_id = ? AND asset_id = ?",
                Integer.class, 9913L, 9905L)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT scanned_count FROM inventory_task WHERE id = ?", Integer.class, 9913L))
                .isEqualTo(1);

        grantPermissionToRole(94L, "inventory:scan");
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, 9906L, TENANT_T001, "Outside-Data-Range", "INV-DATA-RANGE", 1L, "IDLE", 10L, 1L);
        jdbcTemplate.update("""
                INSERT INTO inventory_task (id, tenant_id, task_no, task_name, inventory_type, status, dept_ids, total_count, executor_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, 9914L, TENANT_T001, "INV-DATA-RANGE-TASK", "Data Range Scan", "FULL", "IN_PROGRESS", "10", 1, 94L);
        jdbcTemplate.update("""
                INSERT INTO inventory_detail (tenant_id, task_id, asset_id, status)
                VALUES (?, ?, ?, ?)
                """, TENANT_T001, 9914L, 9906L, "PENDING");
        mockMvc.perform(post("/inventory/tasks/{id}/scan", 9914L)
                        .header("Authorization", "Bearer " + generateSelfScopeJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":9906,\"status\":\"MATCH\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void deptDeletionRequiresTenantAdminAndRejectsCurrentTenantAssetReferences() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO sys_dept (id, tenant_id, dept_name, dept_code, parent_id, sort_order, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, 30L, TENANT_T001, "资产引用部门", "ASSET-REF", 0L, 3, "1", 0);
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status, dept_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, 9920L, TENANT_T001, "Department Reference", "DEPT-REF-ASSET", 1L, "IDLE", 30L);

        mockMvc.perform(delete("/depts/{id}", 30L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/depts/{id}", 30L)
                        .header("Authorization", "Bearer " + generateTenantAdminJwt()))
                .andExpect(status().isBadRequest());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sys_dept WHERE id = ? AND tenant_id = ? AND deleted = 0",
                Integer.class, 30L, TENANT_T001)).isEqualTo(1);
    }

    @Test
    @Transactional
    void loginFailureIsAuditedAndSuccessfulLoginClearsTheFailurePath() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, tenant_id, username, password, real_name, dept_id, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0)
                """, 95L, TENANT_T001, "rate-limit-login-user",
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("correct-password"),
                "Rate Limit Login User", 10L);
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (?, ?, 1)", 95L, TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 95L, 1L);

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"rate-limit-login-user\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"rate-limit-login-user\",\"password\":\"correct-password\"}"))
                .andExpect(status().isOk());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM general_audit_entry "
                        + "WHERE tenant_id = ? AND operation_type = ? AND status = ?", Integer.class,
                "SYSTEM", "AUTH_LOGIN", "FAILURE")).isEqualTo(1);
    }

    @Test
    @Transactional
    void globalMasterDataReadsRequireExplicitQueryPermissions() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO asset_category (id, category_name, category_code, sort_order, deleted)
                VALUES (?, ?, ?, ?, 0)
                """, 9801L, "Global Category", "GLOBAL-CATEGORY", 1);
        jdbcTemplate.update("""
                INSERT INTO vendor (id, vendor_name, vendor_code, contact_person, contact_phone, contact_email, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0)
                """, 9802L, "Global Vendor", "GLOBAL-VENDOR", "Sensitive Contact", "13800000000", "sensitive@example.test");
        jdbcTemplate.update("""
                INSERT INTO location (id, name, location_code, sort_order, status, deleted)
                VALUES (?, ?, ?, ?, 1, 0)
                """, 9803L, "Global Location", "GLOBAL-LOCATION", 1);

        mockMvc.perform(get("/categories/all")
                        .header("Authorization", "Bearer " + generateNoPermissionJwt()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/vendors/list")
                        .header("Authorization", "Bearer " + generateNoPermissionJwt()))
                .andExpect(status().isForbidden())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .doesNotContain("Sensitive Contact")
                        .doesNotContain("13800000000"));
        mockMvc.perform(get("/locations/list")
                        .header("Authorization", "Bearer " + generateNoPermissionJwt()))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/categories/all")
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt()))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Global Category"));
        mockMvc.perform(get("/vendors/list")
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt()))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Global Vendor")
                        .contains("Sensitive Contact"));
        mockMvc.perform(get("/locations/list")
                        .header("Authorization", "Bearer " + generateQueryOnlyJwt()))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("Global Location"));
    }

    @Test
    @Transactional
    void globalMasterDataWriteRoutesRequirePlatformAdministrator() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO asset_category (id, category_name, category_code, sort_order, deleted)
                VALUES (?, ?, ?, ?, 0)
                """, 9811L, "Existing Category", "EXISTING-CATEGORY", 1);
        jdbcTemplate.update("""
                INSERT INTO vendor (id, vendor_name, vendor_code, status, deleted)
                VALUES (?, ?, ?, 1, 0)
                """, 9812L, "Existing Vendor", "EXISTING-VENDOR");

        mockMvc.perform(post("/categories")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryName\":\"Blocked Category\",\"categoryCode\":\"BLOCKED-CATEGORY\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/categories/{id}", 9811L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryName\":\"Blocked Category Update\",\"categoryCode\":\"EXISTING-CATEGORY\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/categories/{id}", 9811L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/vendors")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Blocked Vendor\",\"vendorCode\":\"BLOCKED-VENDOR\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/vendors/{id}", 9812L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Blocked Vendor Update\",\"vendorCode\":\"EXISTING-VENDOR\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/vendors/{id}", 9812L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/locations")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Blocked Location\",\"locationCode\":\"BLOCKED-LOCATION\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/categories")
                        .header("Authorization", "Bearer " + generatePlatformJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryName\":\"Platform Category\",\"categoryCode\":\"PLATFORM-CATEGORY\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/categories/{id}", 9811L)
                        .header("Authorization", "Bearer " + generatePlatformJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryName\":\"Platform Category Update\",\"categoryCode\":\"EXISTING-CATEGORY\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/categories/{id}", 9811L)
                        .header("Authorization", "Bearer " + generatePlatformJwt()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/vendors")
                        .header("Authorization", "Bearer " + generatePlatformJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Platform Vendor\",\"vendorCode\":\"PLATFORM-VENDOR\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/vendors/{id}", 9812L)
                        .header("Authorization", "Bearer " + generatePlatformJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Platform Vendor Update\",\"vendorCode\":\"EXISTING-VENDOR\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/vendors/{id}", 9812L)
                        .header("Authorization", "Bearer " + generatePlatformJwt()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/locations")
                        .header("Authorization", "Bearer " + generatePlatformJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Platform Location\",\"locationCode\":\"PLATFORM-LOCATION\"}"))
                .andExpect(status().isOk());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM asset_category WHERE category_code = 'PLATFORM-CATEGORY' AND deleted = 0", Integer.class))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM vendor WHERE vendor_code = 'PLATFORM-VENDOR' AND deleted = 0", Integer.class))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM location WHERE location_code = 'PLATFORM-LOCATION' AND deleted = 0", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void invalidTokenIsRejectedAndTenantContextIsCleared() throws Exception {
        TenantContext.setTenantId("STALE");

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer not-a-valid-token"))
                .andExpect(status().isUnauthorized());

        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void tenantContextIsClearedAfterRequest() throws Exception {
        TenantContext.clear();

        mockMvc.perform(get("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk());

        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    @Transactional
    void assetCreateWritesTenantId() throws Exception {
        String requestBody = """
                {
                    "name": "NoTenantColumn-Create",
                    "code": "NO-TENANT-CREATE",
                    "categoryId": 1
                }
                """;

        mockMvc.perform(post("/assets")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated());

        Integer createdRows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM asset WHERE asset_no = 'NO-TENANT-CREATE' AND tenant_id = ?",
                Integer.class,
                TENANT_T001);
        assertThat(createdRows).isEqualTo(1);
    }

    @Test
    @Transactional
    void tenantCannotGetUpdateOrDeleteAnotherTenantAsset() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO asset (id, tenant_id, asset_name, asset_no, category_id, status)
                VALUES (?, ?, ?, ?, ?, ?)
                """, 9001L, TENANT_T002, "TenantTwo-Private", "TENANT-PRIVATE", 1L, "IDLE");

        mockMvc.perform(get("/assets/{id}", 9001L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/assets/{id}", 9001L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Blocked Update","categoryId":1}
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/assets/{id}", 9001L)
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());

        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM asset WHERE id = ? AND tenant_id = ? AND deleted = 0",
                Integer.class,
                9001L,
                TENANT_T002);
        assertThat(rows).isEqualTo(1);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, keyBytes.length);
            keyBytes = padded;
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private void insertInventoryTask(Long id, String tenantId, String taskNo, String taskName) {
        jdbcTemplate.update("""
                INSERT INTO inventory_task
                    (id, tenant_id, task_no, task_name, inventory_type, status, dept_ids, total_count, executor_id)
                VALUES (?, ?, ?, ?, 'FULL', 'DRAFT', '10', 1, 1)
                """, id, tenantId, taskNo, taskName);
    }

    private void linkInventoryAsset(String tenantId, Long taskId, Long assetId) {
        jdbcTemplate.update("""
                INSERT INTO inventory_detail (tenant_id, task_id, asset_id, status)
                VALUES (?, ?, ?, 'PENDING')
                """, tenantId, taskId, assetId);
    }

    private void createInventoryReader(Long userId, String username, Long departmentId, String dataScope) {
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, tenant_id, username, password, real_name, dept_id, status, deleted)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0)
                """, userId, TENANT_T001, username, "{noop}password", username, departmentId);
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (?, ?, 1)",
                userId, TENANT_T001);
        jdbcTemplate.update("""
                INSERT INTO sys_role (id, role_code, tenant_id, status, deleted)
                VALUES (?, ?, ?, 1, 0)
                """, userId, "INVENTORY_" + dataScope + "_" + userId, TENANT_T001);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", userId, userId);
        jdbcTemplate.update("INSERT INTO sys_role_data_scope (tenant_id, role_id, data_scope) VALUES (?, ?, ?)",
                TENANT_T001, userId, dataScope);
        grantPermissionToRole(userId, "inventory:query");
    }

    private void expectActionDenied(String permissionCode,
                                    org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
        jdbcTemplate.update("DELETE FROM sys_role_permission WHERE role_id = 1 AND permission_id = "
                        + "(SELECT id FROM sys_permission WHERE permission_code = ?)", permissionCode);
        mockMvc.perform(request.header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isForbidden());
        jdbcTemplate.update("INSERT INTO sys_role_permission (role_id, permission_id) "
                        + "SELECT 1, id FROM sys_permission WHERE permission_code = ?", permissionCode);
    }

    private void grantPermissionToRole(Long roleId, String permissionCode) {
        jdbcTemplate.update("""
                INSERT INTO sys_role_permission (role_id, permission_id)
                SELECT ?, p.id
                FROM sys_permission p
                WHERE p.permission_code = ?
                  AND NOT EXISTS (
                      SELECT 1
                      FROM sys_role_permission rp
                      WHERE rp.role_id = ?
                        AND rp.permission_id = p.id
                  )
                """, roleId, permissionCode, roleId);
    }

    private void assertNoWorkflowDesignerPermissions(Long roleId) {
        Integer permissionCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM sys_role_permission rp
                INNER JOIN sys_permission p ON p.id = rp.permission_id
                WHERE rp.role_id = ?
                  AND p.permission_code IN (
                      'system:flow:query',
                      'workflow:designer:edit',
                      'workflow:designer:publish',
                      'workflow:designer:rollback')
                """, Integer.class, roleId);
        assertThat(permissionCount).isZero();
    }

    private String generateJwt(Map<String, Object> claims) {
        return generateJwt("integration-test-user", 1L, claims);
    }

    private String generatePlatformJwt() {
        return generateJwt("platform-test-user", 99L, Map.of("tenant_id", TENANT_T001));
    }

    private String generateQueryOnlyJwt() {
        return generateJwt("query-only-test-user", 97L, Map.of("tenant_id", TENANT_T001));
    }

    private String generateNoPermissionJwt() {
        return generateJwt("no-permission-test-user", 96L, Map.of("tenant_id", TENANT_T001));
    }

    private String generateSelfScopeJwt() {
        return generateJwt("self-scope-test-user", 94L, Map.of("tenant_id", TENANT_T001));
    }

    private String generateTenantAdminJwt() {
        return generateJwt("tenant-admin-test-user", 98L, Map.of("tenant_id", TENANT_T001));
    }

    private String generateJwt(String username, Long userId, Map<String, Object> claims) {
        Map<String, Object> allClaims = new HashMap<>();
        allClaims.put("sub", username);
        allClaims.put("userId", userId);
        allClaims.put("token_version", 0);
        allClaims.put("iat", new Date(System.currentTimeMillis()));
        allClaims.put("exp", new Date(System.currentTimeMillis() + 3600_000));
        allClaims.putAll(claims);
        return Jwts.builder()
                .claims(allClaims)
                .signWith(getSigningKey())
                .compact();
    }

    private String generateTenantJwt(String tenantId) {
        return generateJwt(Map.of("tenant_id", tenantId));
    }
}
