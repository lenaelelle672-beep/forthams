package com.ams.tenant;

import com.ams.context.TenantContext;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for Phase 1 multi-tenant data isolation.
 *
 * <p>Validates the complete tenant isolation pipeline:
 * <ol>
 *   <li>{@code TenantContext} (ThreadLocal) lifecycle management</li>
 *   <li>JWT token {@code tenant_id} extraction and context injection</li>
 *   <li>MyBatis-Plus tenant interceptor for SQL-level data isolation</li>
 *   <li>Automatic {@code tenant_id} injection on entity persistence</li>
 * </ol>
 *
 * <p>Acceptance Test Benchmarks covered: ATB-TC-01 through ATB-TC-05.
 *
 * <p>Prerequisites:
 * <ul>
 *   <li>{@code jwt.secret} must be configured in application-test.yml or via env var</li>
 *   <li>Asset table must contain {@code tenant_id} column (VARCHAR)</li>
 *   <li>{@code JwtAuthenticationFilter} must be active in the security filter chain</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TenantIsolationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * JWT secret injected from application configuration (jwt.secret property).
     * Must match the secret used by JwtAuthenticationFilter for token validation.
     */
    @Value("${jwt.secret:aVeryLongDefaultSecretKeyForTestingThatIsAtLeast256BitsLongForHS256Algorithm!!}")
    private String jwtSecret;

    private static final String TENANT_T001 = "T001";
    private static final String TENANT_T002 = "T002";

    // ================================================================
    // JWT Token Generation Helpers
    // ================================================================

    /**
     * Builds a JJWT {@link SecretKey} from the configured jwt.secret string.
     * Supports both raw string and Base64-encoded secrets.
     *
     * @return HMAC-SHA signing key derived from application jwt.secret
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        // Ensure key is at least 256 bits for HS256
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, keyBytes.length);
            keyBytes = padded;
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Generates a signed JWT token with the specified claims for testing purposes.
     * Automatically includes {@code sub}, {@code iat}, and {@code exp} claims.
     *
     * @param claims custom claims to embed (e.g., "tenant_id" -> "T001")
     * @return a compact, URL-safe JWT string signed with the application's secret
     */
    private String generateJwt(Map<String, Object> claims) {
        Map<String, Object> allClaims = new HashMap<>();
        allClaims.put("sub", "integration-test-user");
        allClaims.put("iat", new Date(System.currentTimeMillis()));
        allClaims.put("exp", new Date(System.currentTimeMillis() + 3600_000)); // 1 hour
        allClaims.putAll(claims);
        return Jwts.builder()
                .claims(allClaims)
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Convenience method: generates a valid JWT containing a specific tenant_id claim.
     *
     * @param tenantId the tenant identifier to embed in the JWT
     * @return a signed JWT token with tenant_id claim
     */
    private String generateTenantJwt(String tenantId) {
        return generateJwt(Map.of("tenant_id", tenantId));
    }

    // ================================================================
    // ATB Test Cases
    // ================================================================

    /**
     * ATB-TC-01: JWT 解析与上下文注入测试.
     *
     * <p><b>动作:</b> 携带包含有效 {@code tenant_id} (T001) 的 JWT 向受保护的 API
     * 发起 GET 请求。
     *
     * <p><b>物理期待:</b> 后端过滤器成功解析 JWT，将 {@code tenant_id} 注入
     * {@link TenantContext}，请求正常处理并返回 HTTP 200。
     *
     * <p><b>验证策略:</b> 由于 MockMvc 同步执行，过滤器 finally 块在
     * {@code perform()} 返回时已清理上下文，因此无法在请求后直接断言
     * {@code TenantContext}。成功的 200 响应（对比 403）间接证明
     * JWT 解析成功且 {@code tenant_id} 被正确提取并注入。
     */
    @Test
    @Order(1)
    @Transactional
    void atbTc01_jwtParsingAndContextInjection() throws Exception {
        // Seed test data so the endpoint returns meaningful results
        jdbcTemplate.update(
                "INSERT INTO asset (name, code, tenant_id) VALUES (?, ?, ?)",
                "TC01-TestAsset", "TC01-001", TENANT_T001);

        String token = generateTenantJwt(TENANT_T001);

        mockMvc.perform(get("/api/assets")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // HTTP 200 (rather than 403) confirms:
        // 1. JWT was successfully parsed by JwtAuthenticationFilter
        // 2. tenant_id claim was extracted
        // 3. TenantContext was populated during request processing
    }

    /**
     * ATB-TC-02: 缺失租户标识拦截测试.
     *
     * <p><b>动作:</b> 携带不包含 {@code tenant_id} 字段的合法 JWT 发起 API 请求。
     *
     * <p><b>物理期待:</b> 请求在过滤器层被直接拦截，不进入 Controller。
     * 响应 HTTP 状态码 403 Forbidden。
     */
    @Test
    @Order(2)
    void atbTc02_missingTenantIdentifierInterception() throws Exception {
        // Generate a valid JWT with NO tenant_id claim
        String tokenWithoutTenant = generateJwt(Map.of());

        mockMvc.perform(get("/api/assets")
                        .header("Authorization", "Bearer " + tokenWithoutTenant))
                .andExpect(status().isForbidden());

        // Verify TenantContext was never populated (remains null after rejection)
        assertThat(TenantContext.getTenantId())
                .as("TenantContext must remain null when JWT lacks tenant_id claim")
                .isNull();
    }

    /**
     * ATB-TC-03: 数据读取隔离测试 (核心).
     *
     * <p><b>动作:</b>
     * <ol>
     *   <li>使用 JdbcTemplate 直接向数据库插入两条 Asset 记录，
     *       {@code tenant_id} 分别为 T001 和 T002（绕过应用层租户拦截器）</li>
     *   <li>携带 T001 的 JWT 发起查询列表请求 ({@code GET /api/assets})</li>
     * </ol>
     *
     * <p><b>物理期待:</b> 响应 JSON 中只包含 T001 的数据。T002 的数据在
     * 数据库中存在但不可见于 API 响应。MyBatis-Plus 拦截器在 SQL 中自动
     * 追加了 {@code WHERE tenant_id = 'T001'} 条件。
     */
    @Test
    @Order(3)
    @Transactional
    void atbTc03_dataReadingIsolation() throws Exception {
        // 1. Seed cross-tenant data via JdbcTemplate (bypasses application interceptor)
        jdbcTemplate.update(
                "INSERT INTO asset (name, code, tenant_id) VALUES (?, ?, ?)",
                "Isolation-T001-Alpha", "ISO-T001-001", TENANT_T001);
        jdbcTemplate.update(
                "INSERT INTO asset (name, code, tenant_id) VALUES (?, ?, ?)",
                "Isolation-T002-Beta", "ISO-T002-001", TENANT_T002);

        // 2. Verify both records physically exist in the database
        Integer totalRecords = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM asset WHERE code IN ('ISO-T001-001', 'ISO-T002-001')",
                Integer.class);
        assertThat(totalRecords)
                .as("Both T001 and T002 records must exist in the database")
                .isEqualTo(2);

        // 3. Query the API as T001 tenant
        String token = generateTenantJwt(TENANT_T001);

        mockMvc.perform(get("/api/assets")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String responseBody = result.getResponse().getContentAsString();
                    // T001's data must be present in the response
                    assertThat(responseBody)
                            .as("Response must contain T001's data")
                            .contains("Isolation-T001-Alpha");
                    // T002's data must NOT be present (proves SQL-level isolation)
                    assertThat(responseBody)
                            .as("Response must NOT contain T002's data - tenant isolation failed")
                            .doesNotContain("Isolation-T002-Beta");
                });

        // 4. Confirm T002's data still physically exists in DB (not deleted, just filtered)
        Integer t002Exists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM asset WHERE tenant_id = ? AND code = 'ISO-T002-001'",
                Integer.class, TENANT_T002);
        assertThat(t002Exists)
                .as("T002 data must still exist in DB; it is filtered out, not deleted")
                .isEqualTo(1);
    }

    /**
     * ATB-TC-04: 数据写入自动注入测试.
     *
     * <p><b>动作:</b> 携带 {@code tenant_id} 为 T001 的 JWT 发起创建请求
     * ({@code POST /api/assets})，请求体中<b>不包含</b> {@code tenant_id} 字段。
     *
     * <p><b>物理期待:</b> 数据库中新生成的记录其 {@code tenant_id} 必须自动
     * 填充为 T001。由 {@code MyBatisPlusMetaObjectHandler} 从
     * {@link TenantContext} 自动注入。
     */
    @Test
    @Order(4)
    @Transactional
    void atbTc04_dataWritingAutomaticInjection() throws Exception {
        String token = generateTenantJwt(TENANT_T001);

        // Request body intentionally omits tenant_id
        String requestBody = """
                {
                    "name": "AutoInject-TestAsset",
                    "code": "AI-TC04-001"
                }
                """;

        mockMvc.perform(post("/api/assets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk());

        // Directly query DB to verify tenant_id was auto-injected
        String persistedTenantId = jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM asset WHERE code = 'AI-TC04-001'",
                String.class);

        assertThat(persistedTenantId)
                .as("tenant_id must be automatically injected from TenantContext on entity creation")
                .isEqualTo(TENANT_T001);
    }

    /**
     * ATB-TC-05: ThreadLocal 清理验证测试.
     *
     * <p><b>动作:</b> 发起一次成功的请求后，检查当前线程的
     * {@link TenantContext} 状态。
     *
     * <p><b>物理期待:</b> {@link TenantContext#getTenantId()} 返回 {@code null}，
     * 证明 {@code TenantContext.clear()} 在 {@code FilterChain.doFilter()}
     * 执行后被精确调用，防止线程池复用时发生上下文串越。
     *
     * <p><b>验证策略:</b> MockMvc 默认在同一线程同步执行请求。过滤器
     * finally 块中的 {@code TenantContext.clear()} 在请求处理完成后调用。
     * 通过断言请求后 ThreadLocal 值为 null 来验证清理行为。
     */
    @Test
    @Order(5)
    void atbTc05_threadLocalCleanupVerification() throws Exception {
        // Precondition: ensure TenantContext is clean before the test
        TenantContext.clear();
        assertThat(TenantContext.getTenantId())
                .as("Precondition: TenantContext must be null before test")
                .isNull();

        String token = generateTenantJwt(TENANT_T001);

        mockMvc.perform(get("/api/assets")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // After the filter chain completes, TenantContext MUST be cleared
        // This prevents thread pool reuse from leaking tenant context
        assertThat(TenantContext.getTenantId())
                .as("TenantContext MUST be cleared after request completion "
                    + "to prevent thread pool pollution and cross-tenant data leakage")
                .isNull();
    }

    // ================================================================
    // Lifecycle Cleanup
    // ================================================================

    /**
     * Ensures {@link TenantContext} is cleared after each test method
     * to prevent cross-test ThreadLocal pollution.
     */
    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    /**
     * Cleans up any residual test data from the asset table.
     * Uses unique code prefixes that identify test records.
     * This is a safety net in case @Transactional rollback does not apply
     * (e.g., when tests run against an external database).
     */
    @AfterAll
    void cleanUpTestData() {
        try {
            jdbcTemplate.update(
                    "DELETE FROM asset WHERE code LIKE 'TC01-%' "
                    + "OR code LIKE 'ISO-%' "
                    + "OR code LIKE 'AI-TC04-%'");
        } catch (Exception e) {
            // Cleanup failure should not cause test suite failure
            // Log and continue silently
        }
    }
}