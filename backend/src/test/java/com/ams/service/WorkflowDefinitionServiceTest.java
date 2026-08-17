package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.common.exception.ConflictException;
import com.ams.context.TenantContext;
import com.ams.dto.FlowDesignerGraphDTO;
import com.ams.dto.FlowDesignerOperationDTO;
import com.ams.dto.FlowDesignerValidationResultDTO;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.WorkflowDefinitionDraft;
import com.ams.entity.WorkflowDefinitionVersion;
import com.ams.mapper.WorkflowDefinitionDraftMapper;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.ams.mapper.WorkflowDefinitionVersionMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowDefinitionServiceTest {

    @BeforeAll
    static void initMybatisPlusTableInfo() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), WorkflowDefinition.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), WorkflowDefinitionDraft.class);
    }

    @Mock
    private WorkflowDefinitionMapper workflowDefinitionMapper;

    @Mock
    private WorkflowDefinitionDraftMapper workflowDefinitionDraftMapper;

    @Mock
    private WorkflowDefinitionVersionMapper workflowDefinitionVersionMapper;

    @Mock
    private ApprovalAssignmentService approvalAssignmentService;

    private WorkflowDefinitionService workflowDefinitionService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        workflowDefinitionService = new WorkflowDefinitionService(
                workflowDefinitionMapper,
                workflowDefinitionDraftMapper,
                workflowDefinitionVersionMapper,
                approvalAssignmentService,
                new ObjectMapper());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldListAllConfigurableTemplatesWhenTenantHasNoPublishedDefinitions() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        List<WorkflowDefinitionDTO> definitions = workflowDefinitionService.listDefinitions();

        assertEquals(6, definitions.size());
        assertTrue(definitions.stream().anyMatch(definition -> "RETIREMENT".equals(definition.getBusinessType())));
        assertTrue(definitions.stream().anyMatch(definition -> "WORK_ORDER".equals(definition.getBusinessType())));
        assertTrue(definitions.stream().allMatch(definition -> "UNCONFIGURED".equals(definition.getStatus())));
    }

    @Test
    void shouldSaveDraftOnlyToIndependentDraftProjection() {
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(workflowDefinitionDraftMapper.insert(any(WorkflowDefinitionDraft.class))).thenAnswer(invocation -> {
            invocation.getArgument(0, WorkflowDefinitionDraft.class).setId(41L);
            return 1;
        });

        WorkflowDefinitionDTO saved = workflowDefinitionService.saveDraft("ASSET_TRANSFER", saveDto("草稿 v2", validDefinition()));

        assertEquals("DRAFT", saved.getStatus());
        assertEquals(1, saved.getVersion());
        assertEquals(1, saved.getDraftRevision());
        assertEquals("草稿 v2", saved.getName());
        ArgumentCaptor<WorkflowDefinitionDraft> draftCaptor = ArgumentCaptor.forClass(WorkflowDefinitionDraft.class);
        verify(workflowDefinitionDraftMapper).insert(draftCaptor.capture());
        assertEquals("T001", draftCaptor.getValue().getTenantId());
        assertTrue(draftCaptor.getValue().getDefinitionJson().contains("approval"));
        verifyNoInteractions(workflowDefinitionMapper, workflowDefinitionVersionMapper);
    }

    @Test
    void draftV2MustNotChangePublishedV1Read() {
        WorkflowDefinition published = definition("PUBLISHED", 1, "projection-must-not-be-read");
        WorkflowDefinitionVersion snapshot = version(1, validDefinitionJson("v1"));
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(workflowDefinitionDraftMapper.insert(any(WorkflowDefinitionDraft.class))).thenReturn(1);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(published);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot);

        workflowDefinitionService.saveDraft("ASSET_TRANSFER", saveDto("草稿 v2", validDefinition("v2")));
        WorkflowDefinitionDTO runtimeRead = workflowDefinitionService.getDefinition("ASSET_TRANSFER");

        assertEquals("PUBLISHED", runtimeRead.getStatus());
        assertEquals(1, runtimeRead.getVersion());
        assertEquals("v1", runtimeRead.getName());
        assertEquals("v1", runtimeRead.getDefinition().get("name"));
        verify(workflowDefinitionMapper, never()).updateById(any(WorkflowDefinition.class));
    }

    @Test
    void onlyPublishMustSwitchPublishedProjectionAndAppendSnapshot() {
        WorkflowDefinition published = definition("PUBLISHED", 1, validDefinitionJson("v1"));
        WorkflowDefinitionDraft draft = draft("草稿 v2", validDefinitionJson("v2"));
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(published);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(version(1, validDefinitionJson("v1")));
        when(workflowDefinitionDraftMapper.consumeRevision(41L, "T001", "ASSET_TRANSFER", 1)).thenReturn(1);
        when(workflowDefinitionMapper.updateById(published)).thenReturn(1);
        when(workflowDefinitionVersionMapper.insert(any(WorkflowDefinitionVersion.class))).thenAnswer(invocation -> {
            invocation.getArgument(0, WorkflowDefinitionVersion.class).setId(102L);
            return 1;
        });

        WorkflowDefinitionDTO result = workflowDefinitionService.publish("ASSET_TRANSFER", publishOperation(11L, 1));

        assertEquals("PUBLISHED", result.getStatus());
        assertEquals(2, result.getVersion());
        assertEquals("草稿 v2", result.getName());
        assertEquals("v2", result.getDefinition().get("name"));
        ArgumentCaptor<WorkflowDefinitionVersion> versionCaptor = ArgumentCaptor.forClass(WorkflowDefinitionVersion.class);
        verify(workflowDefinitionVersionMapper).insert(versionCaptor.capture());
        assertEquals("PUBLISH", versionCaptor.getValue().getActionType());
        assertEquals(2, versionCaptor.getValue().getVersion());
        assertEquals("v2", definitionName(versionCaptor.getValue().getDefinitionJson()));
        verify(approvalAssignmentService).requirePublishableAssignees(draft.getDefinitionJson(), "T001");
    }

    @Test
    void publishMustFailClosedBeforeConsumingDraftWhenAssigneesCannotBeResolved() {
        WorkflowDefinitionDraft draft = draft("草稿 v2", validDefinitionJson("v2"));
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft);
        org.mockito.Mockito.doThrow(new BusinessException("无法发布：禁止使用 SUPER_ADMIN 作为审批角色"))
                .when(approvalAssignmentService).requirePublishableAssignees(any(), eq("T001"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", publishOperation(11L, 1)));

        assertEquals("无法发布：禁止使用 SUPER_ADMIN 作为审批角色", exception.getMessage());
        verify(workflowDefinitionDraftMapper, never()).consumeRevision(any(), any(), any(), any());
        verifyNoInteractions(workflowDefinitionVersionMapper);
    }

    @Test
    void migratedLegacyDraftMustPublishFromIndependentDraftWithoutTreatingDraftRevisionAsPublished() {
        WorkflowDefinition legacyDraftProjection = definition("DRAFT", 7, validDefinitionJson("legacy-draft"));
        WorkflowDefinitionDraft migratedDraft = draft("迁移草稿", validDefinitionJson("migrated"));
        migratedDraft.setRevision(7);
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(migratedDraft);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(legacyDraftProjection);
        when(workflowDefinitionDraftMapper.consumeRevision(41L, "T001", "ASSET_TRANSFER", 7)).thenReturn(1);
        when(workflowDefinitionMapper.updateById(legacyDraftProjection)).thenReturn(1);
        when(workflowDefinitionVersionMapper.insert(any(WorkflowDefinitionVersion.class))).thenReturn(1);

        WorkflowDefinitionDTO published = workflowDefinitionService.publish("ASSET_TRANSFER", publishOperation(11L, 7));

        assertEquals(1, published.getVersion());
        assertEquals("迁移草稿", published.getName());
        assertEquals("migrated", published.getDefinition().get("name"));
        verify(workflowDefinitionVersionMapper, never()).selectOne(any(LambdaQueryWrapper.class));
    }

    @Test
    void rollbackMustAppendNewVersionWithoutMutatingSourceSnapshot() {
        WorkflowDefinition published = definition("PUBLISHED", 2, validDefinitionJson("v2"));
        WorkflowDefinitionVersion currentSnapshot = version(2, validDefinitionJson("v2"));
        WorkflowDefinitionVersion sourceSnapshot = version(1, validDefinitionJson("v1"));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(published);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(currentSnapshot, sourceSnapshot);
        when(workflowDefinitionMapper.updateById(published)).thenReturn(1);
        when(workflowDefinitionVersionMapper.insert(any(WorkflowDefinitionVersion.class))).thenReturn(1);

        WorkflowDefinitionDTO rolledBack = workflowDefinitionService.rollback("ASSET_TRANSFER", 1,
                rollbackOperation(12L, null, true, 2));

        assertEquals(3, rolledBack.getVersion());
        assertEquals("v1", rolledBack.getDefinition().get("name"));
        assertEquals("v1", sourceSnapshot.getName());
        assertEquals("v1", definitionName(sourceSnapshot.getDefinitionJson()));
        ArgumentCaptor<WorkflowDefinitionVersion> versionCaptor = ArgumentCaptor.forClass(WorkflowDefinitionVersion.class);
        verify(workflowDefinitionVersionMapper).insert(versionCaptor.capture());
        assertEquals("ROLLBACK", versionCaptor.getValue().getActionType());
        assertEquals(1, versionCaptor.getValue().getRollbackSourceVersion());
        verify(workflowDefinitionDraftMapper).selectOne(any(LambdaQueryWrapper.class));
    }

    @Test
    void shouldFailClosedWhenPublishedProjectionHasNoTrustedSnapshot() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(definition("PUBLISHED", 1, validDefinitionJson("tampered")));
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER"));

        assertTrue(exception.getMessage().contains("快照缺失"));
    }

    @Test
    void retirementAndWorkOrderRemainConfigurableButFailClosedBeforePublish() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        WorkflowDefinitionDTO retirement = workflowDefinitionService.getDefinition("RETIREMENT");
        WorkflowDefinitionDTO workOrder = workflowDefinitionService.getDefinition("WORK_ORDER");

        assertEquals("UNCONFIGURED", retirement.getStatus());
        assertEquals("UNCONFIGURED", workOrder.getStatus());
        assertThrows(BusinessException.class,
                () -> workflowDefinitionService.requirePublishedDefinition("RETIREMENT"));
        assertThrows(BusinessException.class,
                () -> workflowDefinitionService.requirePublishedDefinition("WORK_ORDER"));
    }

    @Test
    void shouldRejectUnsupportedGraphAndAmbiguousApprovalModesWithActionableErrors() {
        FlowDesignerGraphDTO graph = new FlowDesignerGraphDTO();
        graph.setNodes(List.of(
                node("start", "START", Map.of()),
                node("gateway", "PARALLEL_GATEWAY", Map.of()),
                node("approval", "APPROVAL", Map.of(
                        "approverType", "user", "approverId", "8", "approvalMode", "any")),
                node("end", "END", Map.of())));
        graph.setEdges(List.of(
                edge("start", "gateway"), edge("gateway", "approval"), edge("gateway", "end"), edge("approval", "end")));

        FlowDesignerValidationResultDTO result = workflowDefinitionService.validateDesignerGraph(graph);

        assertTrue(!result.isValid());
        assertTrue(result.getErrors().stream().anyMatch(error -> error.contains("仅支持 START、APPROVAL、END")));
        assertTrue(result.getErrors().stream().anyMatch(error -> error.contains("仅支持明确的 sequence")));
        assertTrue(result.getErrors().stream().anyMatch(error -> error.contains("单一路径")));
    }

    @Test
    void shouldRejectConditionHandleSentByDesignerGraph() {
        FlowDesignerGraphDTO graph = new FlowDesignerGraphDTO();
        graph.setNodes(List.of(
                node("start", "START", Map.of()),
                node("approval", "APPROVAL", Map.of(
                        "approverType", "user", "approverId", "8", "approvalMode", "sequence")),
                node("end", "END", Map.of())));
        FlowDesignerGraphDTO.EdgeDTO first = edge("start", "approval");
        first.setSourceHandle("condition-true");
        graph.setEdges(List.of(first, edge("approval", "end")));

        FlowDesignerValidationResultDTO result = workflowDefinitionService.validateDesignerGraph(graph);

        assertTrue(!result.isValid());
        assertTrue(result.getErrors().stream().anyMatch(error -> error.contains("条件或分支出口")));
    }

    @Test
    void strictRuntimeSchemaMustRejectNestedEdgeDataAndUnknownNodeFields() {
        LinearWorkflowDefinitionValidator.ValidationResult nestedEdge = LinearWorkflowDefinitionValidator.validate(Map.of(
                "nodes", List.of(
                        Map.of("id", "start", "type", "START"),
                        Map.of("id", "approval", "type", "APPROVAL", "config", Map.of(
                                "approverType", "user", "approverId", "8", "approvalMode", "sequence")),
                        Map.of("id", "end", "type", "END")),
                "edges", List.of(
                        Map.of("source", "start", "target", "approval", "data", Map.of("conditionExpression", "amount > 1000")),
                        Map.of("source", "approval", "target", "end"))));
        LinearWorkflowDefinitionValidator.ValidationResult unknownNode = LinearWorkflowDefinitionValidator.validate(Map.of(
                "nodes", List.of(
                        Map.of("id", "start", "type", "START"),
                        Map.of("id", "approval", "type", "APPROVAL", "config", Map.of(
                                "approverType", "user", "approverId", "8", "approvalMode", "sequence"),
                                "gatewayMode", "xor"),
                        Map.of("id", "end", "type", "END")),
                "edges", List.of(
                        Map.of("source", "start", "target", "approval"),
                        Map.of("source", "approval", "target", "end"))));

        assertTrue(!nestedEdge.valid());
        assertTrue(nestedEdge.errors().stream().anyMatch(error -> error.contains("嵌套 data")));
        assertTrue(!unknownNode.valid());
        assertTrue(unknownNode.errors().stream().anyMatch(error -> error.contains("未支持字段")));
    }

    @Test
    void strictRuntimeSchemaMustRetainConfirmedPureLinearDesignerShape() {
        LinearWorkflowDefinitionValidator.ValidationResult result = LinearWorkflowDefinitionValidator.validate(Map.of(
                "id", "WF-ASSET_TRANSFER",
                "nodes", List.of(
                        Map.of("id", "start", "type", "START", "position", Map.of("x", 0, "y", 0)),
                        Map.of("id", "approval", "type", "APPROVAL", "label", "部门审批", "config", Map.of(
                                "approverType", "user", "approverId", "8", "approvalMode", "sequence",
                                "description", "顺序审批", "position", Map.of("x", 320, "y", 120),
                                "conditionExpression", "")),
                        Map.of("id", "end", "type", "END")),
                "edges", List.of(
                        Map.of("id", "e1", "source", "start", "target", "approval", "data", Map.of()),
                        Map.of("id", "e2", "source", "approval", "target", "end"))));

        assertTrue(result.valid());
    }

    @Test
    void designerDtoMustPreserveNestedEdgeDataForFailClosedValidation() {
        FlowDesignerGraphDTO graph = new FlowDesignerGraphDTO();
        graph.setNodes(List.of(
                node("start", "START", Map.of()),
                node("approval", "APPROVAL", Map.of(
                        "approverType", "user", "approverId", "8", "approvalMode", "sequence")),
                node("end", "END", Map.of())));
        FlowDesignerGraphDTO.EdgeDTO first = edge("start", "approval");
        first.getAdditionalProperties().put("data", Map.of("conditionExpression", "amount > 1000"));
        graph.setEdges(List.of(first, edge("approval", "end")));

        FlowDesignerValidationResultDTO result = workflowDefinitionService.validateDesignerGraph(graph);

        assertTrue(!result.isValid());
        assertTrue(result.getErrors().stream().anyMatch(error -> error.contains("嵌套 data")));
    }

    @Test
    void shouldRequireAuditEvidenceForPublishAndRollback() {
        FlowDesignerOperationDTO operation = publishOperation(11L, 1);
        operation.setConfirmed(false);
        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", operation));

        assertTrue(exception.getMessage().contains("二次确认"));
        verifyNoInteractions(workflowDefinitionMapper, workflowDefinitionVersionMapper);
    }

    @Test
    void draftUpdateMustUseExactRevisionCasAndRejectAStaleEditor() {
        WorkflowDefinitionDraft firstEditorView = draft("编辑者一", validDefinitionJson("editor-one"));
        firstEditorView.setRevision(4);
        WorkflowDefinitionDraft staleEditorView = draft("编辑者一已保存", validDefinitionJson("editor-one"));
        staleEditorView.setRevision(5);
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(firstEditorView, staleEditorView);
        when(workflowDefinitionDraftMapper.updateWithExpectedRevision(
                any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);

        WorkflowDefinitionDTO saved = workflowDefinitionService.saveDraft("ASSET_TRANSFER",
                saveDto("编辑者一", validDefinition("editor-one"), 4));

        assertEquals(5, saved.getDraftRevision());
        verify(workflowDefinitionDraftMapper).updateWithExpectedRevision(
                eq(41L), eq("T001"), eq("ASSET_TRANSFER"), eq(4),
                eq("编辑者一"), eq("说明"), any(), eq(9L));

        ConflictException exception = assertThrows(ConflictException.class,
                () -> workflowDefinitionService.saveDraft("ASSET_TRANSFER",
                        saveDto("编辑者二", validDefinition("editor-two"), 4)));

        assertTrue(exception.getMessage().contains("当前 revision=5"));
    }

    @Test
    void draftUpdateMustReturnConflictWhenDatabaseCasLosesTheRace() {
        WorkflowDefinitionDraft draft = draft("当前草稿", validDefinitionJson("current"));
        draft.setRevision(5);
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft);
        when(workflowDefinitionDraftMapper.updateWithExpectedRevision(
                any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(0);

        ConflictException exception = assertThrows(ConflictException.class,
                () -> workflowDefinitionService.saveDraft("ASSET_TRANSFER",
                        saveDto("陈旧草稿", validDefinition("stale"), 5)));

        assertTrue(exception.getMessage().contains("其他编辑者更新"));
    }

    @Test
    void publisherMustNotPublishDraftChangedByAnEditOnlyActorAfterReview() {
        WorkflowDefinitionDraft changedDraft = draft("编辑者已替换", validDefinitionJson("changed"));
        changedDraft.setRevision(8);
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(changedDraft);

        ConflictException exception = assertThrows(ConflictException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", publishOperation(11L, 7)));

        assertTrue(exception.getMessage().contains("重新审阅"));
        verifyNoInteractions(workflowDefinitionMapper, workflowDefinitionVersionMapper);
    }

    @Test
    void publishMustConsumeTheReviewedDraftRevisionBeforeAppendingASnapshot() {
        WorkflowDefinitionDraft draft = draft("待发布", validDefinitionJson("draft"));
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft);
        when(workflowDefinitionDraftMapper.consumeRevision(41L, "T001", "ASSET_TRANSFER", 1)).thenReturn(0);

        ConflictException exception = assertThrows(ConflictException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", publishOperation(11L, 1)));

        assertTrue(exception.getMessage().contains("消费"));
        verifyNoInteractions(workflowDefinitionMapper, workflowDefinitionVersionMapper);
    }

    @Test
    void rollbackMustRejectAChangedDraftReviewTokenBeforeChangingPublishedProjection() {
        WorkflowDefinitionDraft changedDraft = draft("编辑者已替换", validDefinitionJson("changed"));
        changedDraft.setRevision(8);
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(changedDraft);

        ConflictException exception = assertThrows(ConflictException.class,
                () -> workflowDefinitionService.rollback("ASSET_TRANSFER", 1,
                        rollbackOperation(12L, 7, false, 2)));

        assertTrue(exception.getMessage().contains("重新审阅"));
        verifyNoInteractions(workflowDefinitionMapper, workflowDefinitionVersionMapper);
    }

    @Test
    void designerReadUsesNullRevisionForNoDraftAndKeepsPublishedVersionSeparate() {
        WorkflowDefinition published = definition("PUBLISHED", 3, validDefinitionJson("v3"));
        when(workflowDefinitionDraftMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(published);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(version(3, validDefinitionJson("v3")));

        var designer = workflowDefinitionService.getDesignerDraft("ASSET_TRANSFER");

        assertEquals("PUBLISHED", designer.getStatus());
        assertEquals(3, designer.getVersion());
        assertEquals(3, designer.getPublishedVersion());
        assertEquals(null, designer.getRevision());
        assertEquals("v3", designer.getName());
    }

    @Test
    void shouldDisableAndEnableOnlyTrustedPublishedProjection() {
        WorkflowDefinition definition = definition("PUBLISHED", 2, validDefinitionJson("v2"));
        WorkflowDefinitionVersion snapshot = version(2, validDefinitionJson("v2"));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot);
        when(workflowDefinitionMapper.update(isNull(), any(LambdaUpdateWrapper.class))).thenReturn(1);

        WorkflowStatusUpdateDTO disable = new WorkflowStatusUpdateDTO();
        disable.setStatus("DISABLED");
        disable.setOperatorId(12L);
        WorkflowDefinitionDTO disabled = workflowDefinitionService.updateStatus("ASSET_TRANSFER", disable);

        assertEquals("DISABLED", disabled.getStatus());
        assertEquals(2, disabled.getVersion());
        ArgumentCaptor<LambdaUpdateWrapper<WorkflowDefinition>> wrapperCaptor = ArgumentCaptor.forClass(LambdaUpdateWrapper.class);
        verify(workflowDefinitionMapper).update(isNull(), wrapperCaptor.capture());
        assertTrue(wrapperCaptor.getValue().getSqlSet().contains("status"));
        assertTrue(wrapperCaptor.getValue().getSqlSet().contains("updated_by"));
        assertTrue(!wrapperCaptor.getValue().getSqlSet().contains("definition_json"));
        verify(workflowDefinitionMapper, never()).updateById(any(WorkflowDefinition.class));
        ArgumentCaptor<LambdaQueryWrapper<WorkflowDefinition>> lockCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(workflowDefinitionMapper).selectOne(lockCaptor.capture());
        assertTrue(lockCaptor.getValue().getSqlSegment().contains("FOR UPDATE"));
    }

    @Test
    void statusUpdateMustFailWhenConcurrentPublishOrRollbackWinsTheCas() {
        WorkflowDefinition definition = definition("PUBLISHED", 2, validDefinitionJson("v2"));
        WorkflowDefinitionVersion snapshot = version(2, validDefinitionJson("v2"));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot);
        when(workflowDefinitionMapper.update(isNull(), any(LambdaUpdateWrapper.class))).thenReturn(0);
        WorkflowStatusUpdateDTO disable = new WorkflowStatusUpdateDTO();
        disable.setStatus("DISABLED");
        disable.setOperatorId(12L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.updateStatus("ASSET_TRANSFER", disable));

        assertEquals("流程状态更新失败", exception.getMessage());
        verify(workflowDefinitionMapper, never()).updateById(any(WorkflowDefinition.class));
    }

    private WorkflowDefinitionSaveDTO saveDto(String name, Map<String, Object> definition) {
        return saveDto(name, definition, null);
    }

    private WorkflowDefinitionSaveDTO saveDto(String name, Map<String, Object> definition, Integer expectedRevision) {
        WorkflowDefinitionSaveDTO dto = new WorkflowDefinitionSaveDTO();
        dto.setName(name);
        dto.setDescription("说明");
        dto.setDefinition(definition);
        dto.setExpectedRevision(expectedRevision);
        dto.setOperatorId(9L);
        return dto;
    }

    private WorkflowDefinition definition(String status, Integer version, String definitionJson) {
        WorkflowDefinition definition = new WorkflowDefinition();
        definition.setId(1L);
        definition.setTenantId("T001");
        definition.setBusinessType("ASSET_TRANSFER");
        definition.setName("projection");
        definition.setDescription("projection");
        definition.setDefinitionJson(definitionJson);
        definition.setStatus(status);
        definition.setVersion(version);
        return definition;
    }

    private WorkflowDefinitionDraft draft(String name, String definitionJson) {
        WorkflowDefinitionDraft draft = new WorkflowDefinitionDraft();
        draft.setId(41L);
        draft.setTenantId("T001");
        draft.setBusinessType("ASSET_TRANSFER");
        draft.setName(name);
        draft.setDescription("草稿说明");
        draft.setDefinitionJson(definitionJson);
        draft.setRevision(1);
        draft.setUpdatedBy(9L);
        return draft;
    }

    private WorkflowDefinitionVersion version(Integer version, String definitionJson) {
        WorkflowDefinitionVersion snapshot = new WorkflowDefinitionVersion();
        snapshot.setId(99L + version);
        snapshot.setTenantId("T001");
        snapshot.setDefinitionId(1L);
        snapshot.setBusinessType("ASSET_TRANSFER");
        snapshot.setVersion(version);
        snapshot.setActionType("PUBLISH");
        snapshot.setStatus("PUBLISHED");
        snapshot.setName(definitionName(definitionJson));
        snapshot.setDescription("说明");
        snapshot.setDefinitionJson(definitionJson);
        snapshot.setOperatorId(11L);
        return snapshot;
    }

    private Map<String, Object> validDefinition() {
        return validDefinition("v1");
    }

    private Map<String, Object> validDefinition(String name) {
        return Map.of(
                "name", name,
                "nodes", List.of(
                        Map.of("id", "start", "type", "START"),
                        Map.of("id", "approval", "type", "APPROVAL", "config", Map.of(
                                "approverType", "user", "approverId", "8", "approvalMode", "sequence")),
                        Map.of("id", "end", "type", "END")),
                "edges", List.of(
                        Map.of("source", "start", "target", "approval"),
                        Map.of("source", "approval", "target", "end")));
    }

    private String validDefinitionJson(String name) {
        try {
            return new ObjectMapper().writeValueAsString(validDefinition(name));
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    private String definitionName(String definitionJson) {
        try {
            return (String) new ObjectMapper().readValue(definitionJson, Map.class).get("name");
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    private FlowDesignerOperationDTO publishOperation(Long operatorId, Integer expectedDraftRevision) {
        FlowDesignerOperationDTO operation = new FlowDesignerOperationDTO();
        operation.setOperatorId(operatorId);
        operation.setConfirmed(true);
        operation.setPublishNote("发布稳定版本");
        operation.setImpactScope("后续新发起审批");
        operation.setRollbackPlan("恢复上一版本");
        operation.setExpectedDraftRevision(expectedDraftRevision);
        return operation;
    }

    private FlowDesignerOperationDTO rollbackOperation(Long operatorId, Integer expectedDraftRevision,
                                                        boolean expectedDraftAbsent, Integer expectedPublishedVersion) {
        FlowDesignerOperationDTO operation = publishOperation(operatorId, expectedDraftRevision);
        operation.setReason("恢复稳定版本");
        operation.setExpectedDraftAbsent(expectedDraftAbsent);
        operation.setExpectedPublishedVersion(expectedPublishedVersion);
        return operation;
    }

    private FlowDesignerGraphDTO.NodeDTO node(String id, String type, Map<String, Object> config) {
        FlowDesignerGraphDTO.NodeDTO node = new FlowDesignerGraphDTO.NodeDTO();
        node.setId(id);
        node.setType(type);
        node.setConfig(config);
        return node;
    }

    private FlowDesignerGraphDTO.EdgeDTO edge(String source, String target) {
        FlowDesignerGraphDTO.EdgeDTO edge = new FlowDesignerGraphDTO.EdgeDTO();
        edge.setSource(source);
        edge.setTarget(target);
        return edge;
    }
}
