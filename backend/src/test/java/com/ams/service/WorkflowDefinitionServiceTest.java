package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.WorkflowDefinition;
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

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowDefinitionServiceTest {

    @Mock
    private WorkflowDefinitionMapper workflowDefinitionMapper;

    private WorkflowDefinitionService workflowDefinitionService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        workflowDefinitionService = new WorkflowDefinitionService(workflowDefinitionMapper, new ObjectMapper());
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
        definition.setDefinitionJson("{\"nodes\":[{\"id\":\"approval-1\"}],\"edges\":[]}");
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
        definition.setDefinitionJson("{\"nodes\":[],\"edges\":[]}");
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("流程定义至少需要一个节点", exception.getMessage());
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
        definition.setDefinitionJson("{\"nodes\":[{\"id\":\"approval-1\"}],\"edges\":[]}");
        definition.setStatus(status);
        definition.setVersion(version);
        return definition;
    }
}
