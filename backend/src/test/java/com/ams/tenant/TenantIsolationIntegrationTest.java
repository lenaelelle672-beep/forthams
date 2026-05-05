package com.ams.tenant;

import com.ams.context.TenantContext;
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

    @Value("${jwt.secret:aVeryLongDefaultSecretKeyForTestingThatIsAtLeast256BitsLongForHS256Algorithm!!}")
    private String jwtSecret;

    private static final String TENANT_T001 = "T001";
    private static final String TENANT_T002 = "T002";

    @BeforeAll
    void setUpSchema() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_user_role");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_role");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_user");
        jdbcTemplate.execute("DROP TABLE IF EXISTS approval_process");
        jdbcTemplate.execute("DROP TABLE IF EXISTS work_order");
        jdbcTemplate.execute("DROP TABLE IF EXISTS inventory_detail");
        jdbcTemplate.execute("DROP TABLE IF EXISTS inventory_task");
        jdbcTemplate.execute("DROP TABLE IF EXISTS asset");

        jdbcTemplate.execute("""
                CREATE TABLE sys_user (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(64) NOT NULL UNIQUE,
                    password VARCHAR(128) NOT NULL,
                    real_name VARCHAR(64) NOT NULL,
                    email VARCHAR(128),
                    phone VARCHAR(32),
                    avatar VARCHAR(512),
                    status TINYINT DEFAULT 1,
                    dept_id BIGINT,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_role (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    role_code VARCHAR(64) NOT NULL UNIQUE,
                    status TINYINT DEFAULT 1,
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_user_role (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    role_id BIGINT NOT NULL
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
                    rfid_tag VARCHAR(128),
                    is_important TINYINT DEFAULT 0,
                    description TEXT,
                    remark TEXT,
                    create_by BIGINT,
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
                    status VARCHAR(32) DEFAULT 'PENDING',
                    current_step INT DEFAULT 1,
                    applicant_id BIGINT NOT NULL,
                    apply_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0
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
                    asset_id BIGINT,
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
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_work_order_tenant_no (tenant_id, work_order_no)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE inventory_task (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    task_no VARCHAR(128) NOT NULL UNIQUE,
                    task_name VARCHAR(256) NOT NULL,
                    inventory_type VARCHAR(32),
                    status VARCHAR(32) DEFAULT 'PENDING',
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
                    deleted TINYINT DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE inventory_detail (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    task_id BIGINT NOT NULL,
                    tenant_id VARCHAR(64) NOT NULL,
                    asset_id BIGINT,
                    rfid_tag VARCHAR(128),
                    status VARCHAR(32),
                    expected_location VARCHAR(256),
                    actual_location VARCHAR(256),
                    scan_time TIMESTAMP,
                    remark VARCHAR(512),
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """);

        jdbcTemplate.update("""
                INSERT INTO sys_user (id, username, password, real_name, status, deleted)
                VALUES (?, ?, ?, ?, 1, 0)
                """, 1L, "integration-test-user", "{noop}password", "Integration Test User");
        jdbcTemplate.update("INSERT INTO sys_role (id, role_code, status, deleted) VALUES (?, ?, 1, 0)", 1L, "USER");
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", 1L, 1L);
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
                INSERT INTO work_order (tenant_id, work_order_no, title, status)
                VALUES (?, ?, ?, ?)
                """, TENANT_T001, "WO-T001", "TenantOne-WorkOrder", "DRAFT");
        jdbcTemplate.update("""
                INSERT INTO work_order (tenant_id, work_order_no, title, status)
                VALUES (?, ?, ?, ?)
                """, TENANT_T002, "WO-T002", "TenantTwo-WorkOrder", "DRAFT");

        mockMvc.perform(get("/work-orders")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("TenantOne-WorkOrder")
                        .doesNotContain("TenantTwo-WorkOrder"));
    }

    @Test
    @Transactional
    void tenantInventoryTaskListOnlyReturnsCurrentTenantTasks() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO inventory_task (tenant_id, task_no, task_name, inventory_type, status)
                VALUES (?, ?, ?, ?, ?)
                """, TENANT_T001, "INV-T001", "TenantOne-Inventory", "FULL", "PENDING");
        jdbcTemplate.update("""
                INSERT INTO inventory_task (tenant_id, task_no, task_name, inventory_type, status)
                VALUES (?, ?, ?, ?, ?)
                """, TENANT_T002, "INV-T002", "TenantTwo-Inventory", "FULL", "PENDING");

        mockMvc.perform(get("/inventory/tasks")
                        .header("Authorization", "Bearer " + generateTenantJwt(TENANT_T001)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .contains("TenantOne-Inventory")
                        .doesNotContain("TenantTwo-Inventory"));
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
                .andExpect(status().isOk());

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

    private String generateJwt(Map<String, Object> claims) {
        Map<String, Object> allClaims = new HashMap<>();
        allClaims.put("sub", "integration-test-user");
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
