package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.utils.JwtUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("e2e")
@Transactional
@DisplayName("Workflow platform persistence evidence")
class WorkflowPlatformPersistenceTest {

    private static final String API_CONTEXT_PATH = "/api";
    private static final String BUSINESS_TYPE = "ASSET_TRANSFER";
    private static final String TENANT_ID = "dept:1";
    private static final Long USER_ID = 1L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JwtUtil jwtUtil;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Should persist workflow definition, process, records, and operate logs for four-step asset transfer runtime")
    void shouldPersistAssetTransferRuntimePathAcrossWorkflowApprovalTables() throws Exception {
        String suffix = "DB" + Long.toString(System.currentTimeMillis(), 36).toUpperCase()
                + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        LocalDateTime startedAt = LocalDateTime.now().minusSeconds(1);
        String authorization = authorizationHeader();
        String startFormSource = "<form data-e2e=\"four-step-start-" + suffix
                + "\"><label>四环节申请事由-" + suffix
                + "</label><input name=\"reason\" /><label>四环节申请金额-" + suffix
                + "</label><input name=\"amount\" type=\"number\" /></form>";
        String firstOpinion = "一级审批通过-" + suffix;
        String secondOpinion = "二级审批通过-" + suffix;

        JsonNode draft = apiData(mockMvc.perform(put("/api/workflows/{businessType}/draft", BUSINESS_TYPE)
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "DB资产转移四审批节点流程-" + suffix,
                                "description", "H2直读持久化证据",
                                "definition", fourStepRuntimeDefinition(startFormSource, suffix)
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        assertEquals("DRAFT", draft.path("status").asText());

        JsonNode published = apiData(mockMvc.perform(post("/api/workflows/{businessType}/publish", BUSINESS_TYPE)
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn());
        assertEquals("PUBLISHED", published.path("status").asText());
        assertTrue(published.path("version").asInt() >= 1);

        JsonNode approval = apiData(mockMvc.perform(post("/api/approvals")
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "processType", BUSINESS_TYPE,
                                "businessType", BUSINESS_TYPE,
                                "businessId", 0,
                                "applicantId", USER_ID,
                                "title", "DB资产转移四审批节点审批-" + suffix,
                                "description", "DB direct-read evidence",
                                "businessData", objectMapper.writeValueAsString(Map.of(
                                        "reason", "四环节运行态-" + suffix,
                                        "amount", "3300",
                                        "targetDeptId", 1
                                ))
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long approvalId = approval.path("id").asLong();
        assertTrue(approvalId > 0);

        JsonNode firstApproval = approve(approvalId, firstOpinion, authorization);
        assertEquals(2, firstApproval.path("currentStep").asInt());
        JsonNode secondApproval = approve(approvalId, secondOpinion, authorization);
        assertEquals(3, secondApproval.path("currentStep").asInt());
        assertEquals("PENDING", secondApproval.path("status").asText());

        assertWorkflowDefinitionPersisted(suffix);
        assertApprovalProcessPersisted(approvalId, suffix);
        assertApprovalRecordsPersisted(approvalId, firstOpinion, secondOpinion);
        assertOperateLogsPersisted(approvalId, startedAt);
    }

    @Test
    @DisplayName("Should persist immutable workflow version snapshots and rollback as a new published version")
    void shouldPersistWorkflowVersionSnapshotsAndRollbackAudit() throws Exception {
        String suffix = "VER" + Long.toString(System.currentTimeMillis(), 36).toUpperCase()
                + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        LocalDateTime startedAt = LocalDateTime.now().minusSeconds(1);
        String authorization = authorizationHeader();

        apiData(mockMvc.perform(put("/api/workflows/{businessType}/draft", BUSINESS_TYPE)
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "版本化资产转移流程-" + suffix,
                                "description", "v1 发布快照",
                                "definition", fourStepRuntimeDefinition("<form data-e2e=\"version-v1-" + suffix + "\"></form>", suffix + "-V1")
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        JsonNode v1 = apiData(mockMvc.perform(post("/api/workflows/{businessType}/publish", BUSINESS_TYPE)
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "publishNote", "发布 v1-" + suffix,
                                "impactScope", "后续新发起审批",
                                "rollbackPlan", "回滚到上一发布快照"
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        int version1 = v1.path("version").asInt();

        apiData(mockMvc.perform(put("/api/workflows/{businessType}/draft", BUSINESS_TYPE)
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "版本化资产转移流程-" + suffix,
                                "description", "v2 发布快照",
                                "definition", fourStepRuntimeDefinition("<form data-e2e=\"version-v2-" + suffix + "\"></form>", suffix + "-V2")
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        JsonNode v2 = apiData(mockMvc.perform(post("/api/workflows/{businessType}/publish", BUSINESS_TYPE)
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("publishNote", "发布 v2-" + suffix))))
                .andExpect(status().isOk())
                .andReturn());
        int version2 = v2.path("version").asInt();

        JsonNode rollback = apiData(mockMvc.perform(post("/api/workflows/{businessType}/versions/{version}/rollback", BUSINESS_TYPE, version1)
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "reason", "回滚到 v1-" + suffix,
                                "impactScope", "仅影响后续新发起审批",
                                "rollbackPlan", "必要时回滚到 v2"
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        int rollbackVersion = rollback.path("version").asInt();

        assertEquals(version1 + 1, version2);
        assertEquals(version2 + 1, rollbackVersion);
        assertWorkflowVersionSnapshotsPersisted(version1, version2, rollbackVersion, suffix);
        assertTrue(countOperateLogs("流程回滚", "UPDATE",
                "/api/workflows/" + BUSINESS_TYPE + "/versions/" + version1 + "/rollback", Timestamp.valueOf(startedAt)) >= 1);
    }

    @Test
    @DisplayName("Should persist blocked start availability DB states and audit evidence")
    void shouldPersistBlockedStartAvailabilityDbStatesAndAuditEvidence() throws Exception {
        String authorization = authorizationHeader();

        assertBlockedStartAvailabilityForDefinitionState(
                "DRAFT", 0, "业务流程仍是草稿，发布后才能提交审批", authorization);
        assertBlockedStartAvailabilityForDefinitionState(
                "DISABLED", 2, "业务流程已停用，暂不能提交审批", authorization);
        assertBlockedStartAvailabilityForDefinitionState(
                "PUBLISHED", 0, "流程尚未发布有效版本，暂不能提交审批", authorization);
        assertBlockedStartAvailabilityForUnconfiguredState(authorization);
    }

    private JsonNode approve(long approvalId, String opinion, String authorization) throws Exception {
        return apiData(mockMvc.perform(post("/api/approvals/{id}/approve", approvalId)
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "result", "APPROVED",
                                "opinion", opinion
                        ))))
                .andExpect(status().isOk())
                .andReturn());
    }

    private JsonNode apiData(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertEquals(200, body.path("code").asInt(), body.toString());
        return body.path("data");
    }

    private void assertBlockedStartAvailabilityForDefinitionState(
            String status, int version, String blockReason, String authorization) throws Exception {
        resetBlockedStartAvailabilityState();
        jdbcTemplate.update("""
                INSERT INTO workflow_definition (
                    tenant_id, business_type, name, description, definition_json, status, version, updated_by, deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, TENANT_ID, BUSINESS_TYPE, "Blocked start " + status,
                "H2 blocked-start evidence for " + status,
                "{\"nodes\":[],\"edges\":[]}", status, version, USER_ID);
        assertWorkflowDefinitionState(status, version);
        if ("PUBLISHED".equals(status)) {
            assertNoPublishedWorkflowVersion();
        }

        JsonNode availability = requestStartAvailability(authorization);
        assertBlockedStartAvailability(availability, status, version, blockReason);
        assertStartAvailabilityAuditPersisted();
    }

    private void assertBlockedStartAvailabilityForUnconfiguredState(String authorization) throws Exception {
        resetBlockedStartAvailabilityState();
        assertNoWorkflowDefinition();

        JsonNode availability = requestStartAvailability(authorization);
        assertBlockedStartAvailability(
                availability, "UNCONFIGURED", 0, "请先发布对应业务流程后再提交审批");
        assertStartAvailabilityAuditPersisted();
    }

    private JsonNode requestStartAvailability(String authorization) throws Exception {
        return apiData(mockMvc.perform(get("/api/workflow-runtime/{businessType}/start-availability", BUSINESS_TYPE)
                        .contextPath(API_CONTEXT_PATH)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn());
    }

    private void assertBlockedStartAvailability(
            JsonNode availability, String status, int version, String blockReason) {
        assertEquals(false, availability.path("canStart").asBoolean());
        assertEquals(status, availability.path("status").asText());
        assertEquals(version, availability.path("version").asInt());
        assertEquals(blockReason, availability.path("blockReason").asText());
        assertTrue(availability.path("blockReason").asText().length() > 0);
    }

    private void resetBlockedStartAvailabilityState() {
        jdbcTemplate.update("""
                DELETE FROM workflow_definition_version
                WHERE tenant_id = ? AND business_type = ?
                """, TENANT_ID, BUSINESS_TYPE);
        jdbcTemplate.update("""
                DELETE FROM workflow_definition
                WHERE tenant_id = ? AND business_type = ?
                """, TENANT_ID, BUSINESS_TYPE);
        jdbcTemplate.update("""
                DELETE FROM sys_operate_log
                WHERE operation = ?
                  AND business_type = ?
                  AND request_uri = ?
                """, "审批发起可用性检查", "OTHER",
                "/api/workflow-runtime/" + BUSINESS_TYPE + "/start-availability");
    }

    private void assertWorkflowDefinitionState(String status, int version) {
        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT business_type, status, version, deleted
                FROM workflow_definition
                WHERE tenant_id = ? AND business_type = ?
                """, TENANT_ID, BUSINESS_TYPE);

        assertEquals(BUSINESS_TYPE, row.get("business_type"));
        assertEquals(status, row.get("status"));
        assertEquals(version, ((Number) row.get("version")).intValue());
        assertEquals(0, ((Number) row.get("deleted")).intValue());
    }

    private void assertNoWorkflowDefinition() {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM workflow_definition
                WHERE tenant_id = ? AND business_type = ?
                """, Long.class, TENANT_ID, BUSINESS_TYPE);
        assertNotNull(count);
        assertEquals(0L, count);
    }

    private void assertNoPublishedWorkflowVersion() {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM workflow_definition_version
                WHERE tenant_id = ? AND business_type = ? AND status = 'PUBLISHED'
                """, Long.class, TENANT_ID, BUSINESS_TYPE);
        assertNotNull(count);
        assertEquals(0L, count);
    }

    private void assertStartAvailabilityAuditPersisted() {
        assertTrue(countOperateLogs("审批发起可用性检查", "OTHER",
                "/api/workflow-runtime/" + BUSINESS_TYPE + "/start-availability",
                Timestamp.valueOf(LocalDateTime.now().minusSeconds(5))) >= 1);
    }

    private String authorizationHeader() {
        TenantContext.setTenantId(TENANT_ID);
        return "Bearer " + jwtUtil.generateToken("admin", USER_ID, TENANT_ID);
    }

    private void assertWorkflowDefinitionPersisted(String suffix) {
        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT business_type, status, version, definition_json
                FROM workflow_definition
                WHERE tenant_id = ? AND business_type = ? AND name = ?
                """, TENANT_ID, BUSINESS_TYPE, "DB资产转移四审批节点流程-" + suffix);

        assertEquals(BUSINESS_TYPE, row.get("business_type"));
        assertEquals("PUBLISHED", row.get("status"));
        assertTrue(((Number) row.get("version")).intValue() >= 1);
        String definitionJson = String.valueOf(row.get("definition_json"));
        assertTrue(definitionJson.contains("approval-1"));
        assertTrue(definitionJson.contains("approval-2"));
        assertTrue(definitionJson.contains("approval-3"));
        assertTrue(definitionJson.contains("approval-4"));
        assertTrue(definitionJson.contains("four-step-start-" + suffix));
        assertTrue(definitionJson.contains("approval-1-" + suffix));
        assertTrue(definitionJson.contains("approval-4-" + suffix));
    }

    private void assertWorkflowVersionSnapshotsPersisted(int version1, int version2, int rollbackVersion, String suffix) {
        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT version, action_type, publish_note, rollback_source_version, definition_json
                FROM workflow_definition_version
                WHERE tenant_id = ? AND business_type = ?
                  AND version IN (?, ?, ?)
                ORDER BY version
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("version", rs.getInt("version"));
            row.put("actionType", rs.getString("action_type"));
            row.put("publishNote", rs.getString("publish_note"));
            row.put("rollbackSourceVersion", rs.getObject("rollback_source_version"));
            row.put("definitionJson", rs.getString("definition_json"));
            return row;
        }, TENANT_ID, BUSINESS_TYPE, version1, version2, rollbackVersion);

        assertEquals(3, rows.size());
        assertEquals(version1, rows.get(0).get("version"));
        assertEquals("PUBLISH", rows.get(0).get("actionType"));
        assertEquals("发布 v1-" + suffix, rows.get(0).get("publishNote"));
        assertTrue(String.valueOf(rows.get(0).get("definitionJson")).contains("version-v1-" + suffix));

        assertEquals(version2, rows.get(1).get("version"));
        assertEquals("PUBLISH", rows.get(1).get("actionType"));
        assertTrue(String.valueOf(rows.get(1).get("definitionJson")).contains("version-v2-" + suffix));

        assertEquals(rollbackVersion, rows.get(2).get("version"));
        assertEquals("ROLLBACK", rows.get(2).get("actionType"));
        assertEquals("回滚到 v1-" + suffix, rows.get(2).get("publishNote"));
        assertEquals(version1, ((Number) rows.get(2).get("rollbackSourceVersion")).intValue());
        assertTrue(String.valueOf(rows.get(2).get("definitionJson")).contains("version-v1-" + suffix));
    }

    private void assertApprovalProcessPersisted(long approvalId, String suffix) {
        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT tenant_id, process_type, status, current_step, business_data
                FROM approval_process
                WHERE id = ?
                """, approvalId);

        assertEquals(TENANT_ID, row.get("tenant_id"));
        assertEquals(BUSINESS_TYPE, row.get("process_type"));
        assertEquals("PENDING", row.get("status"));
        assertEquals(3, ((Number) row.get("current_step")).intValue());
        String businessData = String.valueOf(row.get("business_data"));
        assertTrue(businessData.contains("_workflowDefinition"));
        assertTrue(businessData.contains("_approvalPayload"));
        assertTrue(businessData.contains("四环节运行态-" + suffix));
        assertTrue(businessData.contains("targetDeptId"));
    }

    private void assertApprovalRecordsPersisted(long approvalId, String firstOpinion, String secondOpinion) {
        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT step_no, approve_result, approve_opinion
                FROM approval_record
                WHERE process_id = ? AND tenant_id = ?
                ORDER BY step_no
                """, (rs, rowNum) -> Map.of(
                "stepNo", rs.getInt("step_no"),
                "result", rs.getString("approve_result"),
                "opinion", rs.getString("approve_opinion")
        ), approvalId, TENANT_ID);

        assertEquals(2, rows.size());
        assertEquals(1, rows.get(0).get("stepNo"));
        assertEquals("APPROVED", rows.get(0).get("result"));
        assertEquals(firstOpinion, rows.get(0).get("opinion"));
        assertEquals(2, rows.get(1).get("stepNo"));
        assertEquals("APPROVED", rows.get(1).get("result"));
        assertEquals(secondOpinion, rows.get(1).get("opinion"));
    }

    private void assertOperateLogsPersisted(long approvalId, LocalDateTime startedAt) {
        Timestamp from = Timestamp.valueOf(startedAt);
        assertTrue(countOperateLogs("流程草稿保存", "UPDATE",
                "/api/workflows/" + BUSINESS_TYPE + "/draft", from) >= 1);
        assertTrue(countOperateLogs("流程发布", "UPDATE",
                "/api/workflows/" + BUSINESS_TYPE + "/publish", from) >= 1);
        assertTrue(countOperateLogs("审批发起", "INSERT",
                "/api/approvals", from) >= 1);
        assertTrue(countOperateLogs("审批通过", "UPDATE",
                "/api/approvals/" + approvalId + "/approve", from) >= 2);
    }

    private long countOperateLogs(String operation, String businessType, String requestUri, Timestamp from) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM sys_operate_log
                WHERE operation = ?
                  AND business_type = ?
                  AND request_uri = ?
                  AND status = 0
                  AND create_time >= ?
                """, Long.class, operation, businessType, requestUri, from);
        assertNotNull(count);
        return count;
    }

    private Map<String, Object> fourStepRuntimeDefinition(String formSource, String suffix) {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-" + BUSINESS_TYPE);
        definition.put("name", "DB四审批节点运行态流程");
        definition.put("description", "H2直读四审批节点停第三步运行态快照");
        definition.put("businessType", BUSINESS_TYPE);
        definition.put("formSource", formSource);
        definition.put("nodes", List.of(
                workflowNode("start-1", "start", 320, 40, Map.of(
                        "label", "提交申请",
                        "description", "业务表单提交后进入审批流程",
                        "nodeCode", "START_1",
                        "triggerType", "表单提交",
                        "formSource", formSource,
                        "formSectionName", "申请信息",
                        "formSummaryFields", "reason,amount"
                )),
                workflowNode("approval-1", "approval", 200, 190, runtimeApprovalNodeData(1, suffix)),
                workflowNode("approval-2", "approval", 320, 340, runtimeApprovalNodeData(2, suffix)),
                workflowNode("approval-3", "approval", 440, 490, runtimeApprovalNodeData(3, suffix)),
                workflowNode("approval-4", "approval", 560, 640, runtimeApprovalNodeData(4, suffix)),
                workflowNode("end-1", "end", 560, 790, Map.of(
                        "label", "流程结束",
                        "description", "审批通过后归档",
                        "nodeCode", "END_1",
                        "resultAction", "审批完成并同步业务状态"
                ))
        ));
        definition.put("edges", List.of(
                workflowEdge("edge-start-approval-1", "start-1", "approval-1"),
                workflowEdge("edge-approval-1-approval-2", "approval-1", "approval-2"),
                workflowEdge("edge-approval-2-approval-3", "approval-2", "approval-3"),
                workflowEdge("edge-approval-3-approval-4", "approval-3", "approval-4"),
                workflowEdge("edge-approval-4-end", "approval-4", "end-1")
        ));
        return definition;
    }

    private Map<String, Object> runtimeApprovalNodeData(int step, String suffix) {
        String label = switch (step) {
            case 1 -> "一级";
            case 2 -> "二级";
            case 3 -> "三级";
            case 4 -> "四级";
            default -> "第" + step + "级";
        };
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("label", label + "审批");
        data.put("description", label + "审批由超级管理员审批");
        data.put("nodeCode", "APPROVAL_" + step);
        data.put("approverType", "role");
        data.put("approverRole", "SUPER_ADMIN");
        data.put("approvalMode", "sequence");
        data.put("formSource", "<form data-e2e=\"approval-" + step + "-" + suffix
                + "\"><label>" + label + "审批意见-" + suffix
                + "</label><textarea name=\"approvalComment\"></textarea><label>" + label
                + "审批结论-" + suffix + "</label><input name=\"approvalResult\" /></form>");
        data.put("formSectionName", label + "审批-" + suffix);
        data.put("formSummaryFields", "approvalComment,approvalResult");
        return data;
    }

    private Map<String, Object> workflowNode(String id, String type, int x, int y, Map<String, ?> patch) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("type", type);
        data.put("label", "");
        data.put("description", "");
        data.put("nodeCode", "");
        data.put("triggerType", "");
        data.put("approverType", "approval".equals(type) ? "role" : "");
        data.put("approverRole", "");
        data.put("approverRoleName", "");
        data.put("approverId", "");
        data.put("approvalMode", "sequence");
        data.put("conditionExpression", "");
        data.put("trueLabel", "");
        data.put("falseLabel", "");
        data.put("resultAction", "");
        data.put("formSource", "");
        data.put("formSectionName", "");
        data.put("formSummaryFields", "");
        data.putAll(patch);

        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", id);
        node.put("type", type);
        node.put("position", Map.of("x", x, "y", y));
        node.put("data", data);
        return node;
    }

    private Map<String, Object> workflowEdge(String id, String source, String target) {
        Map<String, Object> edge = new LinkedHashMap<>();
        edge.put("id", id);
        edge.put("source", source);
        edge.put("target", target);
        edge.put("sourceHandle", null);
        edge.put("targetHandle", null);
        edge.put("type", "smoothstep");
        edge.put("animated", true);
        edge.put("label", null);
        edge.put("markerEnd", Map.of("type", "arrowclosed", "color", "var(--color-primary)"));
        edge.put("style", Map.of("stroke", "var(--color-primary)", "strokeWidth", 2));
        edge.put("labelStyle", Map.of("fill", "var(--color-foreground)", "fontSize", 12, "fontWeight", 600));
        edge.put("labelBgStyle", Map.of("fill", "var(--workflow-surface)", "fillOpacity", 1));
        return edge;
    }
}
