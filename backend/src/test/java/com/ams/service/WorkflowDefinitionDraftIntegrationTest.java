package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.common.exception.ConflictException;
import com.ams.dto.FlowDesignerOperationDTO;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowDesignerDraftDTO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
class WorkflowDefinitionDraftIntegrationTest {

    @Autowired
    private WorkflowDefinitionService workflowDefinitionService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUpSchema() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS workflow_definition_version");
        jdbcTemplate.execute("DROP TABLE IF EXISTS workflow_definition_draft");
        jdbcTemplate.execute("DROP TABLE IF EXISTS workflow_definition");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS sys_user ("
                + "id BIGINT AUTO_INCREMENT PRIMARY KEY,"
                + "tenant_id VARCHAR(64),"
                + "username VARCHAR(64) NOT NULL UNIQUE,"
                + "password VARCHAR(128) NOT NULL,"
                + "real_name VARCHAR(64) NOT NULL,"
                + "status TINYINT DEFAULT 1,"
                + "deleted TINYINT DEFAULT 0)");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS sys_user_tenant ("
                + "id BIGINT AUTO_INCREMENT PRIMARY KEY,"
                + "user_id BIGINT NOT NULL,"
                + "tenant_id VARCHAR(64) NOT NULL,"
                + "status TINYINT NOT NULL DEFAULT 1)");
        jdbcTemplate.update("DELETE FROM sys_user_tenant WHERE user_id = 8");
        jdbcTemplate.update("DELETE FROM sys_user WHERE id = 8 OR username = 'approver-publish-8'");
        jdbcTemplate.update("INSERT INTO sys_user (id, tenant_id, username, password, real_name, status, deleted) "
                + "VALUES (8, 'T001', 'approver-publish-8', 'x', 'Approver', 1, 0)");
        jdbcTemplate.update("INSERT INTO sys_user_tenant (user_id, tenant_id, status) VALUES (8, 'T001', 1)");
        jdbcTemplate.execute("""
                CREATE TABLE workflow_definition (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    business_type VARCHAR(64) NOT NULL,
                    name VARCHAR(128) NOT NULL,
                    description CLOB,
                    definition_json CLOB NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    version INT NOT NULL,
                    updated_by BIGINT,
                    published_by BIGINT,
                    published_at TIMESTAMP,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE (tenant_id, business_type)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE workflow_definition_draft (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    business_type VARCHAR(64) NOT NULL,
                    name VARCHAR(128) NOT NULL,
                    description CLOB,
                    definition_json CLOB NOT NULL,
                    revision INT NOT NULL DEFAULT 0,
                    updated_by BIGINT,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE (tenant_id, business_type)
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
                    description CLOB,
                    definition_json CLOB NOT NULL,
                    publish_note VARCHAR(512),
                    impact_scope VARCHAR(512),
                    rollback_plan VARCHAR(512),
                    rollback_source_version INT,
                    operator_id BIGINT NOT NULL,
                    published_at TIMESTAMP NOT NULL,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (tenant_id, business_type, version)
                )
                """);
        TenantContext.setTenantId("T001");
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void draftV2StaysIsolatedUntilPublishAndRollbackAppendsAnotherVersion() {
        WorkflowDefinitionDTO draftV1 = workflowDefinitionService.saveDraft("ASSET_TRANSFER", save("v1", null));
        WorkflowDefinitionDTO publishedV1 = workflowDefinitionService.publish("ASSET_TRANSFER", operation("发布 v1", 1, 1));

        WorkflowDesignerDraftDTO reviewedAfterPublish = workflowDefinitionService.getDesignerDraft("ASSET_TRANSFER");
        WorkflowDefinitionDTO draftV2 = workflowDefinitionService.saveDraft("ASSET_TRANSFER",
                save("v2", reviewedAfterPublish.getRevision()));
        WorkflowDefinitionDTO runtimeBeforePublish = workflowDefinitionService.getDefinition("ASSET_TRANSFER");
        WorkflowDesignerDraftDTO designerDraft = workflowDefinitionService.getDesignerDraft("ASSET_TRANSFER");

        assertEquals(1, publishedV1.getVersion());
        assertEquals("v1", runtimeBeforePublish.getName());
        assertEquals(1, runtimeBeforePublish.getVersion());
        assertEquals("v2", designerDraft.getName());
        assertEquals(1, designerDraft.getPublishedVersion());

        WorkflowDefinitionDTO publishedV2 = workflowDefinitionService.publish("ASSET_TRANSFER",
                operation("发布 v2", draftV2.getDraftRevision(), 2));
        assertEquals(2, publishedV2.getVersion());
        assertEquals("v2", workflowDefinitionService.getDefinition("ASSET_TRANSFER").getName());

        WorkflowDefinitionDTO rolledBack = workflowDefinitionService.rollback("ASSET_TRANSFER", 1,
                operation("回滚到 v1", 4, 2));
        assertEquals(3, rolledBack.getVersion());
        assertEquals("v1", rolledBack.getName());
        assertEquals(3, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM workflow_definition_version", Integer.class));
        assertEquals("ROLLBACK", jdbcTemplate.queryForObject(
                "SELECT action_type FROM workflow_definition_version WHERE version = 3", String.class));
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT rollback_source_version FROM workflow_definition_version WHERE version = 3", Integer.class));
    }

    @Test
    void draftMustNotLeakAcrossTenants() {
        workflowDefinitionService.saveDraft("WORK_ORDER", save("tenant-one-draft", null));

        TenantContext.setTenantId("T002");
        WorkflowDesignerDraftDTO otherTenantDraft = workflowDefinitionService.getDesignerDraft("WORK_ORDER");
        WorkflowDefinitionDTO otherTenantPublished = workflowDefinitionService.getDefinition("WORK_ORDER");

        assertEquals("UNCONFIGURED", otherTenantDraft.getStatus());
        assertNotEquals("tenant-one-draft", otherTenantDraft.getName());
        assertEquals("UNCONFIGURED", otherTenantPublished.getStatus());
        assertFalse(otherTenantDraft.getDefinition().containsValue("tenant-one-draft"));
    }

    @Test
    void twoEditorsCannotSilentlyOverwriteTheSameDraft() {
        WorkflowDefinitionDTO initial = workflowDefinitionService.saveDraft("WORK_ORDER", save("initial", null));
        WorkflowDefinitionDTO firstEditor = workflowDefinitionService.saveDraft("WORK_ORDER",
                save("first-editor", initial.getDraftRevision()));

        ConflictException conflict = assertThrows(ConflictException.class,
                () -> workflowDefinitionService.saveDraft("WORK_ORDER", save("second-editor", initial.getDraftRevision())));

        assertEquals(2, firstEditor.getDraftRevision());
        assertEquals("first-editor", jdbcTemplate.queryForObject(
                "SELECT name FROM workflow_definition_draft WHERE tenant_id = ? AND business_type = ?",
                String.class, "T001", "WORK_ORDER"));
        assertEquals(2, jdbcTemplate.queryForObject(
                "SELECT revision FROM workflow_definition_draft WHERE tenant_id = ? AND business_type = ?",
                Integer.class, "T001", "WORK_ORDER"));
        assertEquals(true, conflict.getMessage().contains("当前 revision=2"));
    }

    @Test
    void concurrentPublishWithTheSameReviewedRevisionAppendsOnlyOneVersionAndAllowsLaterEditing() throws Exception {
        workflowDefinitionService.saveDraft("WORK_ORDER", save("concurrent-v1", null));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> first = executor.submit(() -> publishFromConcurrentRequest(ready, start));
            Future<Boolean> second = executor.submit(() -> publishFromConcurrentRequest(ready, start));
            assertEquals(true, ready.await(10, TimeUnit.SECONDS));
            start.countDown();

            assertEquals(1, (first.get(10, TimeUnit.SECONDS) ? 1 : 0)
                    + (second.get(10, TimeUnit.SECONDS) ? 1 : 0));
            assertEquals(1, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM workflow_definition_version", Integer.class));
            assertEquals(2, jdbcTemplate.queryForObject(
                    "SELECT revision FROM workflow_definition_draft WHERE tenant_id = ? AND business_type = ?",
                    Integer.class, "T001", "WORK_ORDER"));

            WorkflowDefinitionDTO edited = workflowDefinitionService.saveDraft("WORK_ORDER", save("concurrent-v2", 2));
            WorkflowDefinitionDTO republished = workflowDefinitionService.publish("WORK_ORDER",
                    operation("发布并发后的 v2", edited.getDraftRevision(), 1));
            assertEquals(2, republished.getVersion());
            assertEquals(2, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM workflow_definition_version", Integer.class));
        } finally {
            executor.shutdownNow();
        }
    }

    private boolean publishFromConcurrentRequest(CountDownLatch ready, CountDownLatch start) throws Exception {
        TenantContext.setTenantId("T001");
        try {
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) {
                throw new AssertionError("并发发布未同时启动");
            }
            workflowDefinitionService.publish("WORK_ORDER", operation("并发发布", 1, 1));
            return true;
        } catch (ConflictException exception) {
            return false;
        } finally {
            TenantContext.clear();
        }
    }

    private WorkflowDefinitionSaveDTO save(String name, Integer expectedRevision) {
        WorkflowDefinitionSaveDTO dto = new WorkflowDefinitionSaveDTO();
        dto.setName(name);
        dto.setDescription(name + " 描述");
        dto.setDefinition(Map.of(
                "name", name,
                "nodes", List.of(
                        Map.of("id", "start", "type", "START"),
                        Map.of("id", "approval", "type", "APPROVAL", "config", Map.of(
                                "approverType", "user", "approverId", "8", "approvalMode", "sequence")),
                        Map.of("id", "end", "type", "END")),
                "edges", List.of(
                        Map.of("source", "start", "target", "approval"),
                        Map.of("source", "approval", "target", "end"))));
        dto.setExpectedRevision(expectedRevision);
        dto.setOperatorId(9L);
        return dto;
    }

    private FlowDesignerOperationDTO operation(String reason, Integer expectedDraftRevision,
                                                Integer expectedPublishedVersion) {
        FlowDesignerOperationDTO dto = new FlowDesignerOperationDTO();
        dto.setOperatorId(9L);
        dto.setConfirmed(true);
        dto.setReason(reason);
        dto.setImpactScope("仅影响后续新发起流程");
        dto.setRollbackPlan("使用不可变历史版本前向回滚");
        dto.setExpectedDraftRevision(expectedDraftRevision);
        dto.setExpectedPublishedVersion(expectedPublishedVersion);
        return dto;
    }
}
