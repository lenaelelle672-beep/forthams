package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.FlowDesignerGraphDTO;
import com.ams.dto.FlowDesignerOperationDTO;
import com.ams.dto.FlowDesignerValidationResultDTO;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.WorkflowDefinitionVersion;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowDefinitionServiceTest {

    @Mock
    private WorkflowDefinitionMapper workflowDefinitionMapper;

    @Mock
    private JdbcTemplate jdbcTemplate;

    private WorkflowDefinitionService workflowDefinitionService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        workflowDefinitionService = new WorkflowDefinitionService(workflowDefinitionMapper, new ObjectMapper(), jdbcTemplate);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldListDefaultWorkflowTemplatesWhenTenantHasNoDefinitions() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        List<WorkflowDefinitionDTO> definitions = workflowDefinitionService.listDefinitions();

        assertEquals(4, definitions.size());
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
    void shouldPublishExistingDraftAndIncrementVersion() {
        WorkflowDefinition definition = definition("DRAFT", 0);
        definition.setDefinitionJson(validDefinitionJson());
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        WorkflowDefinitionDTO published = workflowDefinitionService.publish("ASSET_TRANSFER", publishOperation(11L));

        assertEquals("PUBLISHED", published.getStatus());
        assertEquals(1, published.getVersion());
        assertEquals(11L, published.getPublishedBy());
        assertNotNull(published.getPublishedAt());
        verify(workflowDefinitionMapper).updateById(definition);
        verify(jdbcTemplate).update(contains("INSERT INTO workflow_definition_version"), any(Object[].class));
    }

    @Test
    void shouldRejectPublishWhenDefinitionHasNoNodes() {
        WorkflowDefinition definition = definition("DRAFT", 0);
        definition.setDefinitionJson("{\"nodes\":[],\"edges\":[]}");
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", publishOperation(11L)));

        assertTrue(exception.getMessage().contains("流程图不能为空"));
    }

    @Test
    void shouldValidateFlowDesignerGraphStructure() {
        FlowDesignerValidationResultDTO empty = workflowDefinitionService.validateDesignerGraph(new FlowDesignerGraphDTO());
        assertTrue(empty.getErrors().stream().anyMatch(error -> error.contains("流程图不能为空")));

        FlowDesignerValidationResultDTO duplicate = workflowDefinitionService.validateDesignerGraph(graph(
                List.of(node("start", "START"), node("start", "APPROVAL"), node("end", "END")),
                List.of(edge("start", "end"))));
        assertTrue(duplicate.getErrors().stream().anyMatch(error -> error.contains("节点 ID 重复")));

        FlowDesignerValidationResultDTO missingTarget = workflowDefinitionService.validateDesignerGraph(graph(
                List.of(node("start", "START"), node("approval", "APPROVAL"), node("end", "END")),
                List.of(edge("start", "missing"), edge("approval", "end"))));
        assertTrue(missingTarget.getErrors().stream().anyMatch(error -> error.contains("连线 target 不存在")));

        FlowDesignerValidationResultDTO isolated = workflowDefinitionService.validateDesignerGraph(graph(
                List.of(node("start", "START"), node("approval", "APPROVAL"), node("end", "END")),
                List.of(edge("start", "end"))));
        assertTrue(isolated.getErrors().stream().anyMatch(error -> error.contains("存在孤立节点")));

        FlowDesignerValidationResultDTO illegalType = workflowDefinitionService.validateDesignerGraph(graph(
                List.of(node("start", "START"), node("robot", "SHELL"), node("end", "END")),
                List.of(edge("start", "robot"), edge("robot", "end"))));
        assertTrue(illegalType.getErrors().stream().anyMatch(error -> error.contains("非法节点类型")));
    }

    @Test
    void shouldRollbackToVersionSnapshotAndAppendAuditVersion() {
        WorkflowDefinition definition = definition("PUBLISHED", 2);
        definition.setDefinitionJson(validDefinitionJson());
        WorkflowDefinitionVersion sourceVersion = version(1, validDefinitionJson());
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), eq("T001"), eq("ASSET_TRANSFER"), eq(1)))
                .thenReturn(List.of(sourceVersion));

        WorkflowDefinitionDTO rolledBack = workflowDefinitionService.rollback("ASSET_TRANSFER", 1, rollbackOperation(12L));

        assertEquals("PUBLISHED", rolledBack.getStatus());
        assertEquals(3, rolledBack.getVersion());
        assertEquals(12L, rolledBack.getPublishedBy());
        verify(workflowDefinitionMapper).updateById(definition);
        verify(jdbcTemplate).update(contains("INSERT INTO workflow_definition_version"), any(Object[].class));
    }

    @Test
    void shouldRequireConfirmedOperationForPublishAndRollbackAudit() {
        WorkflowDefinition definition = definition("DRAFT", 0);
        definition.setDefinitionJson(validDefinitionJson());
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        FlowDesignerOperationDTO operation = publishOperation(11L);
        operation.setConfirmed(false);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", operation));

        assertTrue(exception.getMessage().contains("二次确认"));
    }

    @Test
    void shouldRequireImpactScopeAndRollbackPlanForPublishAndRollbackAudit() {
        WorkflowDefinition definition = definition("DRAFT", 0);
        definition.setDefinitionJson(validDefinitionJson());
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        FlowDesignerOperationDTO missingImpactScope = publishOperation(11L);
        missingImpactScope.setImpactScope(" ");
        BusinessException publishScopeException = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", missingImpactScope));
        assertTrue(publishScopeException.getMessage().contains("影响范围"));

        FlowDesignerOperationDTO missingRollbackPlan = publishOperation(11L);
        missingRollbackPlan.setRollbackPlan(null);
        BusinessException publishRollbackPlanException = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", missingRollbackPlan));
        assertTrue(publishRollbackPlanException.getMessage().contains("回滚预案"));

        FlowDesignerOperationDTO rollbackMissingImpactScope = rollbackOperation(12L);
        rollbackMissingImpactScope.setImpactScope("");
        BusinessException rollbackScopeException = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.rollback("ASSET_TRANSFER", 1, rollbackMissingImpactScope));
        assertTrue(rollbackScopeException.getMessage().contains("影响范围"));
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

    private WorkflowDefinition definition(String status, Integer version) {
        WorkflowDefinition definition = new WorkflowDefinition();
        definition.setId(1L);
        definition.setTenantId("T001");
        definition.setBusinessType("ASSET_TRANSFER");
        definition.setName("资产转移流程");
        definition.setDescription("用于资产转移审批");
        definition.setDefinitionJson(validDefinitionJson());
        definition.setStatus(status);
        definition.setVersion(version);
        return definition;
    }

    private String validDefinitionJson() {
        return "{\"nodes\":[{\"id\":\"start\",\"type\":\"START\"},{\"id\":\"approval\",\"type\":\"APPROVAL\"},{\"id\":\"end\",\"type\":\"END\"}],\"edges\":[{\"source\":\"start\",\"target\":\"approval\"},{\"source\":\"approval\",\"target\":\"end\"}]}";
    }

    private FlowDesignerOperationDTO publishOperation(Long operatorId) {
        FlowDesignerOperationDTO operation = new FlowDesignerOperationDTO();
        operation.setOperatorId(operatorId);
        operation.setConfirmed(true);
        operation.setPublishNote("发布稳定版本");
        operation.setImpactScope("后续新发起审批");
        operation.setRollbackPlan("恢复上一版本");
        return operation;
    }

    private FlowDesignerOperationDTO rollbackOperation(Long operatorId) {
        FlowDesignerOperationDTO operation = publishOperation(operatorId);
        operation.setReason("恢复稳定版本");
        return operation;
    }

    private FlowDesignerGraphDTO graph(List<FlowDesignerGraphDTO.NodeDTO> nodes, List<FlowDesignerGraphDTO.EdgeDTO> edges) {
        FlowDesignerGraphDTO graph = new FlowDesignerGraphDTO();
        graph.setNodes(nodes);
        graph.setEdges(edges);
        return graph;
    }

    private FlowDesignerGraphDTO.NodeDTO node(String id, String type) {
        FlowDesignerGraphDTO.NodeDTO node = new FlowDesignerGraphDTO.NodeDTO();
        node.setId(id);
        node.setType(type);
        return node;
    }

    private FlowDesignerGraphDTO.EdgeDTO edge(String source, String target) {
        FlowDesignerGraphDTO.EdgeDTO edge = new FlowDesignerGraphDTO.EdgeDTO();
        edge.setSource(source);
        edge.setTarget(target);
        return edge;
    }

    private WorkflowDefinitionVersion version(Integer version, String definitionJson) {
        WorkflowDefinitionVersion snapshot = new WorkflowDefinitionVersion();
        snapshot.setId(99L);
        snapshot.setDefinitionId(1L);
        snapshot.setBusinessType("ASSET_TRANSFER");
        snapshot.setVersion(version);
        snapshot.setActionType("PUBLISH");
        snapshot.setStatus("PUBLISHED");
        snapshot.setName("资产转移流程");
        snapshot.setDescription("用于资产转移审批");
        snapshot.setDefinitionJson(definitionJson);
        snapshot.setOperatorId(11L);
        return snapshot;
    }
}
