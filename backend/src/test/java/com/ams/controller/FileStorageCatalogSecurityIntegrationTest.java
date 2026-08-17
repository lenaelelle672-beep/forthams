package com.ams.controller;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:file_storage_catalog_security;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class FileStorageCatalogSecurityIntegrationTest {

    private static final String CATALOG_PATH = "/system/file-storage/attachments/catalog";
    private static final String TENANT_ID = "T001";
    private static final String CONFIDENTIAL_ATTACHMENT = "tenant-b-confidential.pdf";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @BeforeAll
    void setUpSchema() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_role_permission");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_user_role");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_user_tenant");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_permission");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_role");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_attachment");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_user");
        jdbcTemplate.execute("DROP TABLE IF EXISTS sys_tenant");

        jdbcTemplate.execute("""
                CREATE TABLE sys_user (
                    id BIGINT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    platform_admin TINYINT NOT NULL DEFAULT 0,
                    username VARCHAR(64) NOT NULL UNIQUE,
                    password VARCHAR(128) NOT NULL,
                    real_name VARCHAR(64) NOT NULL,
                    email VARCHAR(128),
                    phone VARCHAR(32),
                    avatar VARCHAR(512),
                    status TINYINT NOT NULL DEFAULT 1,
                    dept_id BIGINT,
                    token_version INT NOT NULL DEFAULT 0,
                    version INT NOT NULL DEFAULT 0,
                    create_time TIMESTAMP,
                    update_time TIMESTAMP,
                    deleted TINYINT NOT NULL DEFAULT 0
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_user_tenant (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    tenant_id VARCHAR(64) NOT NULL,
                    status TINYINT NOT NULL DEFAULT 1
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_role (
                    id BIGINT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    role_code VARCHAR(64) NOT NULL,
                    status TINYINT NOT NULL DEFAULT 1,
                    deleted TINYINT NOT NULL DEFAULT 0
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
                CREATE TABLE sys_permission (
                    id BIGINT PRIMARY KEY,
                    permission_code VARCHAR(128) NOT NULL,
                    status TINYINT NOT NULL DEFAULT 1,
                    deleted TINYINT NOT NULL DEFAULT 0
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
                CREATE TABLE sys_attachment (
                    id BIGINT PRIMARY KEY,
                    business_type VARCHAR(64) NOT NULL,
                    business_id BIGINT NOT NULL,
                    file_name VARCHAR(256) NOT NULL,
                    file_path VARCHAR(512) NOT NULL,
                    file_size BIGINT,
                    file_type VARCHAR(64),
                    upload_by BIGINT,
                    create_time TIMESTAMP,
                    deleted TINYINT NOT NULL DEFAULT 0
                )
                """);

        jdbcTemplate.update("""
                INSERT INTO sys_tenant (id, name, plan, max_users, max_assets, status)
                VALUES (?, ?, ?, ?, ?, ?)
                """, TENANT_ID, "Tenant One", "STANDARD", 100, 10000, "ACTIVE");
        insertUser(1L, false, "tenant-user");
        insertUser(2L, false, "file-query-user");
        insertUser(3L, true, "platform-user");
        jdbcTemplate.update("INSERT INTO sys_role (id, tenant_id, role_code, status, deleted) VALUES (?, ?, ?, 1, 0)",
                1L, TENANT_ID, "TENANT_USER");
        jdbcTemplate.update("INSERT INTO sys_role (id, tenant_id, role_code, status, deleted) VALUES (?, ?, ?, 1, 0)",
                2L, TENANT_ID, "FILE_QUERY_USER");
        jdbcTemplate.update("INSERT INTO sys_role (id, tenant_id, role_code, status, deleted) VALUES (?, ?, ?, 1, 0)",
                3L, TENANT_ID, "PLATFORM_OPERATOR");
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?), (?, ?), (?, ?)",
                1L, 1L, 2L, 2L, 3L, 3L);
        jdbcTemplate.update("INSERT INTO sys_permission (id, permission_code, status, deleted) VALUES (?, ?, 1, 0)",
                1L, "system:file-storage:query");
        jdbcTemplate.update("INSERT INTO sys_role_permission (role_id, permission_id) VALUES (?, ?)", 2L, 1L);
        jdbcTemplate.update("""
                INSERT INTO sys_attachment (id, business_type, business_id, file_name, file_path, file_size, file_type, upload_by, create_time, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0),
                       (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0)
                """,
                1L, "asset", 1001L, "tenant-a-report.pdf", "/private/tenant-a-report.pdf", 512L, "application/pdf", 3L,
                2L, "legacy-global", 2001L, CONFIDENTIAL_ATTACHMENT, "/private/tenant-b-confidential.pdf", 1024L, "application/pdf", 3L);
    }

    @AfterEach
    void clearTenantContext() {
        assertThat(TenantContext.getTenantId()).isNull();
        TenantContext.clear();
    }

    @Test
    void catalogRejectsRequestWithoutAuthenticatedSubjectWithoutMetadataLeakage() throws Exception {
        assertCatalogMetadataIsHidden(mockMvc.perform(get(CATALOG_PATH))
                .andExpect(status().isForbidden()));
    }

    @Test
    void catalogRejectsOrdinaryTenantUserWithoutFileStoragePermission() throws Exception {
        assertCatalogMetadataIsHidden(mockMvc.perform(get(CATALOG_PATH)
                        .header("Authorization", "Bearer " + token("tenant-user", 1L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403)));
    }

    @Test
    void catalogRejectsOrdinaryTenantUserEvenWithFileStorageQueryPermission() throws Exception {
        assertCatalogMetadataIsHidden(mockMvc.perform(get(CATALOG_PATH)
                        .header("Authorization", "Bearer " + token("file-query-user", 2L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403)));
    }

    @Test
    void catalogRejectsMalformedTokenWithoutMetadataLeakage() throws Exception {
        assertCatalogMetadataIsHidden(mockMvc.perform(get(CATALOG_PATH)
                        .header("Authorization", "Bearer malformed-token"))
                .andExpect(status().isUnauthorized()));
    }

    @Test
    void catalogBindingFailureDoesNotLeakMetadata() throws Exception {
        assertCatalogMetadataIsHidden(mockMvc.perform(get(CATALOG_PATH)
                        .header("Authorization", "Bearer " + token("platform-user", 3L))
                        .param("page", "not-a-page"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400)));
    }

    @Test
    void catalogAllowsExplicitPlatformAdminThroughJwtFilterAndTenantContext() throws Exception {
        mockMvc.perform(get(CATALOG_PATH)
                        .header("Authorization", "Bearer " + token("platform-user", 3L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.summary.totalAttachmentCount").value(2))
                .andExpect(jsonPath("$.data.attachments[0].fileName").value(CONFIDENTIAL_ATTACHMENT))
                .andExpect(jsonPath("$.data.businessTypes[0]").value("asset"))
                .andExpect(jsonPath("$.data.businessTypes[1]").value("legacy-global"));
    }

    private void assertCatalogMetadataIsHidden(org.springframework.test.web.servlet.ResultActions resultActions) throws Exception {
        resultActions.andExpect(result -> assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .doesNotContain(CONFIDENTIAL_ATTACHMENT)
                .doesNotContain("tenant-a-report.pdf")
                .doesNotContain("legacy-global")
                .doesNotContain("totalAttachmentCount")
                .doesNotContain("businessTypes")
                .doesNotContain("fileTypes")
                .doesNotContain("/private/tenant-b-confidential.pdf"));
    }

    private void insertUser(long id, boolean platformAdmin, String username) {
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, tenant_id, platform_admin, username, password, real_name, status, token_version, deleted)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0)
                """, id, TENANT_ID, platformAdmin ? 1 : 0, username, "{noop}password", username);
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (?, ?, 1)", id, TENANT_ID);
    }

    private String token(String username, long userId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(username)
                .claim("userId", userId)
                .claim("tenant_id", TENANT_ID)
                .claim("token_version", 0)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + 3_600_000))
                .signWith(signingKey())
                .compact();
    }

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }
}
