package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.User;
import com.ams.entity.WorkflowDefinition;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowDefinitionServiceTest {

    @Mock
    private WorkflowDefinitionMapper workflowDefinitionMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private UserMapper userMapper;

    private WorkflowDefinitionService workflowDefinitionService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        objectMapper = new ObjectMapper();
        lenient().when(userRoleMapper.selectActiveUserIdsByRole(anyString())).thenReturn(List.of(1L));
        lenient().when(userRoleMapper.countActiveByRoleCode(anyString())).thenReturn(1);
        workflowDefinitionService = new WorkflowDefinitionService(workflowDefinitionMapper, userRoleMapper, userMapper, objectMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldListDefaultWorkflowTemplatesWhenTenantHasNoDefinitions() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        List<WorkflowDefinitionDTO> definitions = workflowDefinitionService.listDefinitions();

        assertEquals(5, definitions.size());
        assertEquals("ASSET_TRANSFER", definitions.get(0).getBusinessType());
        assertTrue(definitions.stream().allMatch(definition -> "UNCONFIGURED".equals(definition.getStatus())));
        assertTrue(definitions.stream().allMatch(definition -> definition.getVersion() == 0));
    }

    @Test
    void shouldCreateDraftForCurrentTenant() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        WorkflowDefinitionSaveDTO dto = new WorkflowDefinitionSaveDTO();
        dto.setName("自定义转移流程");
        dto.setDescription("自定义说明");
        dto.setDefinition(Map.of("nodes", List.of(Map.of("id", "approval-1")), "edges", List.of()));
        dto.setOperatorId(9L);

        WorkflowDefinitionDTO saved = workflowDefinitionService.saveDraft("ASSET_TRANSFER", dto);

        ArgumentCaptor<WorkflowDefinition> captor = ArgumentCaptor.forClass(WorkflowDefinition.class);
        verify(workflowDefinitionMapper).insert(captor.capture());
        WorkflowDefinition definition = captor.getValue();
        assertEquals("T001", definition.getTenantId());
        assertEquals("ASSET_TRANSFER", definition.getBusinessType());
        assertEquals("DRAFT", definition.getStatus());
        assertEquals(0, definition.getVersion());
        assertEquals(9L, definition.getUpdatedBy());
        assertTrue(definition.getDefinitionJson().contains("approval-1"));
        assertEquals("DRAFT", saved.getStatus());
    }

    @Test
    void shouldPersistEveryWorkflowDesignerFieldInDraftAndDto() throws Exception {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        Map<String, Object> fullDefinition = fullWorkflowDefinition();
        WorkflowDefinitionSaveDTO dto = new WorkflowDefinitionSaveDTO();
        dto.setName("字段完整流程");
        dto.setDescription("验证前端流程设计器每个字段都能落库并回读");
        dto.setDefinition(fullDefinition);
        dto.setOperatorId(88L);

        WorkflowDefinitionDTO saved = workflowDefinitionService.saveDraft("ASSET_TRANSFER", dto);

        ArgumentCaptor<WorkflowDefinition> captor = ArgumentCaptor.forClass(WorkflowDefinition.class);
        verify(workflowDefinitionMapper).insert(captor.capture());
        WorkflowDefinition persisted = captor.getValue();
        Map<String, Object> persistedDefinition = objectMapper.readValue(
                persisted.getDefinitionJson(), new TypeReference<>() {});

        assertEquals("字段完整流程", persisted.getName());
        assertEquals("验证前端流程设计器每个字段都能落库并回读", persisted.getDescription());
        assertEquals(88L, persisted.getUpdatedBy());
        assertWorkflowDefinitionFields(fullDefinition, persistedDefinition);
        assertWorkflowDefinitionFields(fullDefinition, saved.getDefinition());
    }

    @Test
    void shouldExposeAllFieldsForEveryDefaultWorkflowTemplate() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        List<WorkflowDefinitionDTO> definitions = workflowDefinitionService.listDefinitions();

        assertDefaultTemplate(definitions.get(0), "ASSET_TRANSFER", "资产转移流程", 4);
        assertDefaultTemplate(definitions.get(1), "ASSET_CLEARANCE", "资产清退流程", 4);
        assertDefaultTemplate(definitions.get(2), "ASSET_SCRAP", "资产报废转让流程", 4);
        assertDefaultTemplate(definitions.get(3), "ASSET_COMPENSATION", "资产赔偿流程", 4);
    }

    @Test
    void shouldPublishExistingDraftAndIncrementVersion() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        definition.setDefinitionJson(objectMapper.writeValueAsString(fullWorkflowDefinition()));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        WorkflowDefinitionDTO published = workflowDefinitionService.publish("ASSET_TRANSFER", 11L);

        assertEquals("PUBLISHED", published.getStatus());
        assertEquals(1, published.getVersion());
        assertEquals(11L, published.getPublishedBy());
        assertNotNull(published.getPublishedAt());
        verify(workflowDefinitionMapper).updateById(definition);
    }

    @Test
    void shouldRejectPublishWhenDefinitionHasNoNodes() {
        WorkflowDefinition definition = definition("DRAFT", 0);
        definition.setDefinitionJson("{\"id\":\"WF-ASSET_TRANSFER\",\"name\":\"资产转移流程\",\"description\":\"用于资产转移审批\",\"businessType\":\"ASSET_TRANSFER\",\"nodes\":[],\"edges\":[]}");
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("流程定义至少需要一个节点", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenApprovalRoleIsMissing() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approverRole", "");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("审批节点审批角色不能为空", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenApprovalRoleDoesNotExistInRoleTable() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approverRole", "GHOST_ROLE");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(userRoleMapper.countActiveByRoleCode("GHOST_ROLE")).thenReturn(0);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertTrue(exception.getMessage().contains("审批角色不存在或已禁用"));
    }

    @Test
    void shouldRejectPublishWhenApprovalRoleHasNoActiveApprover() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approverRole", "不存在的角色");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(userRoleMapper.selectActiveUserIdsByRole("不存在的角色")).thenReturn(List.of());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("节点approval-1审批角色未配置有效审批人: 不存在的角色", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenConditionBranchIsIncomplete() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> edges = (List<Map<String, Object>>) invalid.get("edges");
        invalid.put("edges", edges.stream()
                .filter(edge -> !"edge-condition-false".equals(edge.get("id")))
                .toList());
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("条件节点必须同时配置满足和不满足两条分支", exception.getMessage());
    }

    @Test
    void shouldResolveRuntimeApprovalPathFromConditionExpressionAndNodeMetadata() throws Exception {
        WorkflowDefinition definition = definition("PUBLISHED", 1);
        definition.setDefinitionJson(objectMapper.writeValueAsString(branchingWorkflowDefinition()));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        WorkflowDefinitionService.WorkflowRuntimePlan highAmountPlan =
                workflowDefinitionService.getPublishedRuntimePlan("ASSET_TRANSFER", "{\"amount\":6000}", 3);
        WorkflowDefinitionService.WorkflowRuntimePlan lowAmountPlan =
                workflowDefinitionService.getPublishedRuntimePlan("ASSET_TRANSFER", "{\"amount\":100}", 3);

        assertEquals(2, highAmountPlan.approvalNodes().size());
        assertEquals("APP-DEPT", highAmountPlan.approvalNodes().get(0).nodeCode());
        assertEquals("部门负责人", highAmountPlan.approvalNodes().get(0).approverRole());
        assertEquals("sequence", highAmountPlan.approvalNodes().get(0).approvalMode());
        assertEquals("APP-FINANCE", highAmountPlan.approvalNodes().get(1).nodeCode());
        assertEquals("all", highAmountPlan.approvalNodes().get(1).approvalMode());
        assertEquals("归档并同步到审批列表", highAmountPlan.resultAction());
        assertEquals(1, lowAmountPlan.approvalNodes().size());
        assertEquals("APP-DEPT", lowAmountPlan.approvalNodes().get(0).nodeCode());
    }

    @Test
    void shouldDisableAndEnablePublishedDefinition() {
        WorkflowDefinition definition = definition("PUBLISHED", 2);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        WorkflowStatusUpdateDTO disable = new WorkflowStatusUpdateDTO();
        disable.setStatus("DISABLED");
        disable.setOperatorId(12L);

        WorkflowDefinitionDTO disabled = workflowDefinitionService.updateStatus("ASSET_TRANSFER", disable);

        assertEquals("DISABLED", disabled.getStatus());
        assertEquals(12L, definition.getUpdatedBy());

        WorkflowStatusUpdateDTO enable = new WorkflowStatusUpdateDTO();
        enable.setStatus("ENABLED");
        enable.setOperatorId(13L);

        WorkflowDefinitionDTO enabled = workflowDefinitionService.updateStatus("ASSET_TRANSFER", enable);

        assertEquals("PUBLISHED", enabled.getStatus());
        assertEquals(13L, definition.getUpdatedBy());
    }

    @Test
    void shouldRejectBusinessSubmissionWhenDefinitionIsNotPublished() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition("DISABLED", 1));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER"));

        assertEquals("请先发布对应业务流程后再提交审批", exception.getMessage());
    }

    @Test
    void shouldApproveRoleValidationPassWhenRoleHasActiveUsers() {
        // The default setUp mocks selectActiveUserIdsByRole to return List.of(1L)
        // so validation should pass for any role that has users
        List<Long> activeUsers = userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN");
        assertNotNull(activeUsers);
        assertEquals(1, activeUsers.size());
    }

    @Test
    void shouldRejectPublishWhenApproverUserDoesNotExist() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approverType", "user");
        data.put("approverId", "99999");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertTrue(exception.getMessage().contains("审批人不存在或已禁用"));
    }

    @Test
    void shouldRejectPublishWhenApproverUserIdIsEmpty() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approverType", "user");
        data.put("approverId", "");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("节点approval-1指定用户审批时审批人ID不能为空", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenApproverRoleIsEmpty() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        // Set approverRole to empty string on approval node
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approverRole", "");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("审批节点审批角色不能为空", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenUserApproverApprovalModeIsInvalid() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approverType", "user");
        data.put("approverId", "7");
        data.put("approvalMode", "parallel");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        User activeUser = new User();
        activeUser.setId(7L);
        activeUser.setStatus(1);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(userMapper.selectById(7L)).thenReturn(activeUser);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("审批节点审批模式仅支持 sequence/all/any", exception.getMessage());
    }

    private WorkflowDefinition definition(String status, Integer version) {
        WorkflowDefinition definition = new WorkflowDefinition();
        definition.setId(1L);
        definition.setTenantId("T001");
        definition.setBusinessType("ASSET_TRANSFER");
        definition.setName("资产转移流程");
        definition.setDescription("用于资产转移审批");
        definition.setDefinitionJson("{\"nodes\":[{\"id\":\"approval-1\"}],\"edges\":[]}");
        definition.setStatus(status);
        definition.setVersion(version);
        return definition;
    }

    private Map<String, Object> branchingWorkflowDefinition() {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-ASSET_TRANSFER");
        definition.put("name", "条件分支流程");
        definition.put("description", "高金额进入财务复核，低金额直接结束");
        definition.put("businessType", "ASSET_TRANSFER");
        definition.put("nodes", List.of(
                node("start-1", "start", 120, 40, data("start", "提交申请", "提交后进入流程", "START-APPLY", "表单提交", "", "sequence", "", "", "", "")),
                node("approval-1", "approval", 120, 200, data("approval", "部门审批", "部门负责人确认", "APP-DEPT", "", "部门负责人", "sequence", "", "", "", "")),
                node("condition-1", "condition", 120, 360, data("condition", "金额判断", "根据金额分支", "COND-AMOUNT", "", "", "sequence", "申请金额 >= 5000", "大额采购", "常规采购", "")),
                node("approval-2", "approval", 120, 520, data("approval", "财务复核", "财务确认预算", "APP-FINANCE", "", "财务经理", "all", "", "", "", "")),
                node("end-1", "end", 120, 680, data("end", "流程结束", "归档并同步业务状态", "END-ARCHIVE", "", "", "sequence", "", "", "", "归档并同步到审批列表"))
        ));
        definition.put("edges", List.of(
                edge("edge-start-approval", "start-1", "approval-1", null, null, true, null),
                edge("edge-approval-condition", "approval-1", "condition-1", null, null, true, null),
                edge("edge-condition-true", "condition-1", "approval-2", "condition-true", "target-main", false, "大额采购"),
                edge("edge-condition-false", "condition-1", "end-1", "condition-false", "target-alt", false, "常规采购"),
                edge("edge-finance-end", "approval-2", "end-1", null, null, true, null)
        ));
        return definition;
    }

    @SuppressWarnings("unchecked")
    private void assertWorkflowDefinitionFields(Map<String, Object> expected, Map<String, Object> actual) {
        assertEquals(expected.get("id"), actual.get("id"));
        assertEquals(expected.get("name"), actual.get("name"));
        assertEquals(expected.get("description"), actual.get("description"));
        assertEquals(expected.get("businessType"), actual.get("businessType"));

        List<Map<String, Object>> expectedNodes = (List<Map<String, Object>>) expected.get("nodes");
        List<Map<String, Object>> actualNodes = (List<Map<String, Object>>) actual.get("nodes");
        assertEquals(expectedNodes.size(), actualNodes.size());
        for (int index = 0; index < expectedNodes.size(); index++) {
            assertNodeFields(expectedNodes.get(index), actualNodes.get(index));
        }

        List<Map<String, Object>> expectedEdges = (List<Map<String, Object>>) expected.get("edges");
        List<Map<String, Object>> actualEdges = (List<Map<String, Object>>) actual.get("edges");
        assertEquals(expectedEdges.size(), actualEdges.size());
        for (int index = 0; index < expectedEdges.size(); index++) {
            assertEdgeFields(expectedEdges.get(index), actualEdges.get(index));
        }
    }

    @SuppressWarnings("unchecked")
    private void assertNodeFields(Map<String, Object> expected, Map<String, Object> actual) {
        assertEquals(expected.get("id"), actual.get("id"));
        assertEquals(expected.get("type"), actual.get("type"));
        assertEquals(((Map<String, Object>) expected.get("position")).get("x"), ((Map<String, Object>) actual.get("position")).get("x"));
        assertEquals(((Map<String, Object>) expected.get("position")).get("y"), ((Map<String, Object>) actual.get("position")).get("y"));

        Map<String, Object> expectedData = (Map<String, Object>) expected.get("data");
        Map<String, Object> actualData = (Map<String, Object>) actual.get("data");
        assertEquals(expectedData.get("type"), actualData.get("type"));
        assertEquals(expectedData.get("label"), actualData.get("label"));
        assertEquals(expectedData.get("description"), actualData.get("description"));
        assertEquals(expectedData.get("nodeCode"), actualData.get("nodeCode"));
        assertEquals(expectedData.get("triggerType"), actualData.get("triggerType"));
        assertEquals(expectedData.get("approverRole"), actualData.get("approverRole"));
        assertEquals(expectedData.get("approvalMode"), actualData.get("approvalMode"));
        assertEquals(expectedData.get("conditionExpression"), actualData.get("conditionExpression"));
        assertEquals(expectedData.get("trueLabel"), actualData.get("trueLabel"));
        assertEquals(expectedData.get("falseLabel"), actualData.get("falseLabel"));
        assertEquals(expectedData.get("resultAction"), actualData.get("resultAction"));
    }

    @SuppressWarnings("unchecked")
    private void assertEdgeFields(Map<String, Object> expected, Map<String, Object> actual) {
        assertEquals(expected.get("id"), actual.get("id"));
        assertEquals(expected.get("source"), actual.get("source"));
        assertEquals(expected.get("target"), actual.get("target"));
        assertEquals(expected.get("sourceHandle"), actual.get("sourceHandle"));
        assertEquals(expected.get("targetHandle"), actual.get("targetHandle"));
        assertEquals(expected.get("type"), actual.get("type"));
        assertEquals(expected.get("animated"), actual.get("animated"));
        assertEquals(expected.get("label"), actual.get("label"));
        assertEquals(((Map<String, Object>) expected.get("markerEnd")).get("type"), ((Map<String, Object>) actual.get("markerEnd")).get("type"));
        assertEquals(((Map<String, Object>) expected.get("markerEnd")).get("color"), ((Map<String, Object>) actual.get("markerEnd")).get("color"));
        assertEquals(((Map<String, Object>) expected.get("style")).get("stroke"), ((Map<String, Object>) actual.get("style")).get("stroke"));
        assertEquals(((Map<String, Object>) expected.get("style")).get("strokeWidth"), ((Map<String, Object>) actual.get("style")).get("strokeWidth"));
        assertEquals(((Map<String, Object>) expected.get("labelStyle")).get("fill"), ((Map<String, Object>) actual.get("labelStyle")).get("fill"));
        assertEquals(((Map<String, Object>) expected.get("labelStyle")).get("fontSize"), ((Map<String, Object>) actual.get("labelStyle")).get("fontSize"));
        assertEquals(((Map<String, Object>) expected.get("labelStyle")).get("fontWeight"), ((Map<String, Object>) actual.get("labelStyle")).get("fontWeight"));
        assertEquals(((Map<String, Object>) expected.get("labelBgStyle")).get("fill"), ((Map<String, Object>) actual.get("labelBgStyle")).get("fill"));
        assertEquals(((Map<String, Object>) expected.get("labelBgStyle")).get("fillOpacity"), ((Map<String, Object>) actual.get("labelBgStyle")).get("fillOpacity"));
    }

    @SuppressWarnings("unchecked")
    private void assertDefaultTemplate(WorkflowDefinitionDTO definition, String businessType, String name, int approvalStepCount) {
        assertEquals(businessType, definition.getBusinessType());
        assertEquals(name, definition.getName());
        assertEquals("UNCONFIGURED", definition.getStatus());
        assertEquals(0, definition.getVersion());
        assertEquals("WF-" + businessType, definition.getDefinition().get("id"));
        assertEquals(name, definition.getDefinition().get("name"));
        assertTrue(String.valueOf(definition.getDefinition().get("description")).startsWith("用于"));
        assertEquals(businessType, definition.getDefinition().get("businessType"));

        List<Map<String, Object>> nodes = (List<Map<String, Object>>) definition.getDefinition().get("nodes");
        List<Map<String, Object>> edges = (List<Map<String, Object>>) definition.getDefinition().get("edges");
        assertEquals(approvalStepCount + 2, nodes.size());
        assertEquals(approvalStepCount + 1, edges.size());

        assertDefaultNodeHasAllFields(nodes.get(0), "start-1", "start");
        for (int index = 1; index <= approvalStepCount; index++) {
            assertDefaultNodeHasAllFields(nodes.get(index), "approval-" + index, "approval");
        }
        assertDefaultNodeHasAllFields(nodes.get(nodes.size() - 1), "end-1", "end");

        for (Map<String, Object> edge : edges) {
            assertNotNull(edge.get("id"));
            assertNotNull(edge.get("source"));
            assertNotNull(edge.get("target"));
            assertEquals("smoothstep", edge.get("type"));
            assertEquals(true, edge.get("animated"));
            assertNotNull(edge.get("markerEnd"));
            assertNotNull(edge.get("style"));
            assertNotNull(edge.get("labelStyle"));
            assertNotNull(edge.get("labelBgStyle"));
        }
    }

    @SuppressWarnings("unchecked")
    private void assertDefaultNodeHasAllFields(Map<String, Object> node, String id, String type) {
        assertEquals(id, node.get("id"));
        assertEquals(type, node.get("type"));
        assertNotNull(((Map<String, Object>) node.get("position")).get("x"));
        assertNotNull(((Map<String, Object>) node.get("position")).get("y"));
        Map<String, Object> data = (Map<String, Object>) node.get("data");
        assertEquals(type, data.get("type"));
        assertNotNull(data.get("label"));
        assertNotNull(data.get("description"));
        assertNotNull(data.get("nodeCode"));
        assertNotNull(data.get("triggerType"));
        if ("approval".equals(type)) {
            assertEquals("SUPER_ADMIN", data.get("approverRole"));
        } else {
            assertNotNull(data.get("approverRole"));
        }
        assertEquals("sequence", data.get("approvalMode"));
        assertNotNull(data.get("conditionExpression"));
        assertNotNull(data.get("trueLabel"));
        assertNotNull(data.get("falseLabel"));
        assertNotNull(data.get("resultAction"));
    }

    private Map<String, Object> fullWorkflowDefinition() {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-ASSET_TRANSFER");
        definition.put("name", "字段完整流程");
        definition.put("description", "覆盖开始、审批、条件、结束节点和连线字段");
        definition.put("businessType", "ASSET_TRANSFER");
        definition.put("nodes", List.of(
                node("start-1", "start", 120, 40, data("start", "提交申请", "提交后进入流程", "START-APPLY", "表单提交", "", "sequence", "", "", "", "")),
                node("approval-1", "approval", 120, 200, data("approval", "部门审批", "部门负责人确认", "APP-DEPT", "", "部门负责人", "sequence", "", "", "", "")),
                node("condition-1", "condition", 120, 360, data("condition", "金额判断", "根据金额分支", "COND-AMOUNT", "", "", "sequence", "申请金额 >= 5000", "大额采购", "常规采购", "")),
                node("end-1", "end", 120, 520, data("end", "流程结束", "归档并同步业务状态", "END-ARCHIVE", "", "", "sequence", "", "", "", "归档并同步到审批列表"))
        ));
        definition.put("edges", List.of(
                edge("edge-start-approval", "start-1", "approval-1", null, null, true, null),
                edge("edge-approval-condition", "approval-1", "condition-1", null, null, true, null),
                edge("edge-condition-true", "condition-1", "end-1", "condition-true", "target-main", false, "大额采购"),
                edge("edge-condition-false", "condition-1", "end-1", "condition-false", "target-alt", false, "常规采购")
        ));
        return definition;
    }

    private Map<String, Object> node(String id, String type, int x, int y, Map<String, Object> data) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", id);
        node.put("type", type);
        node.put("position", Map.of("x", x, "y", y));
        node.put("data", data);
        return node;
    }

    private Map<String, Object> data(String type, String label, String description, String nodeCode,
                                     String triggerType, String approverRole, String approvalMode,
                                     String conditionExpression, String trueLabel, String falseLabel,
                                     String resultAction) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("type", type);
        data.put("label", label);
        data.put("description", description);
        data.put("nodeCode", nodeCode);
        data.put("triggerType", triggerType);
        data.put("approverRole", approverRole);
        data.put("approvalMode", approvalMode);
        data.put("conditionExpression", conditionExpression);
        data.put("trueLabel", trueLabel);
        data.put("falseLabel", falseLabel);
        data.put("resultAction", resultAction);
        return data;
    }

    private Map<String, Object> edge(String id, String source, String target, String sourceHandle,
                                     String targetHandle, boolean animated, String label) {
        Map<String, Object> edge = new LinkedHashMap<>();
        edge.put("id", id);
        edge.put("source", source);
        edge.put("target", target);
        edge.put("sourceHandle", sourceHandle);
        edge.put("targetHandle", targetHandle);
        edge.put("type", "smoothstep");
        edge.put("animated", animated);
        edge.put("label", label);
        edge.put("markerEnd", Map.of("type", "arrowclosed", "color", "var(--color-primary)"));
        edge.put("style", Map.of("stroke", "var(--color-primary)", "strokeWidth", 2));
        edge.put("labelStyle", Map.of("fill", "var(--color-foreground)", "fontSize", 12, "fontWeight", 600));
        edge.put("labelBgStyle", Map.of("fill", "var(--workflow-surface)", "fillOpacity", 1));
        return edge;
    }
}
