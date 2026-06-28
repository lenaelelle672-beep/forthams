package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkflowAssigneePreviewRequest;
import com.ams.dto.WorkflowAssigneePreviewResponse;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowDefinitionVersionDTO;
import com.ams.dto.WorkflowRollbackRequest;
import com.ams.dto.WorkflowRuntimeAssigneePreviewRequest;
import com.ams.dto.WorkflowStartAvailabilityDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.User;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.WorkflowDefinitionVersion;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.ams.mapper.WorkflowDefinitionVersionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
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
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowDefinitionServiceTest {

    @Mock
    private WorkflowDefinitionMapper workflowDefinitionMapper;

    @Mock
    private WorkflowDefinitionVersionMapper workflowDefinitionVersionMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private UserMapper userMapper;

    private WorkflowDefinitionService workflowDefinitionService;
    private ObjectMapper objectMapper;
    private WorkflowGraphValidator graphValidator;
    private WorkflowRuntimePlanner runtimePlanner;
    private WorkflowTemplateRegistry templateRegistry;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        objectMapper = new ObjectMapper();
        // 初始化 MyBatis-Plus 实体元数据，LambdaUpdateWrapper 需要
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), WorkflowDefinition.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), WorkflowDefinitionVersion.class);
        lenient().when(userRoleMapper.selectActiveUserIdsByRole(anyString())).thenReturn(List.of(1L));
        lenient().when(userRoleMapper.countActiveByRoleCode(anyString())).thenReturn(1);
        graphValidator = new WorkflowGraphValidator(userRoleMapper, userMapper, objectMapper);
        runtimePlanner = new WorkflowRuntimePlanner(userRoleMapper, objectMapper);
        templateRegistry = new WorkflowTemplateRegistry();
        workflowDefinitionService = new WorkflowDefinitionService(workflowDefinitionMapper, objectMapper, graphValidator, runtimePlanner, templateRegistry, userRoleMapper, workflowDefinitionVersionMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldListDefaultWorkflowTemplatesWhenTenantHasNoDefinitions() {
        lenient().when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(workflowDefinitionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

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

        WorkflowDefinitionDTO saved = workflowDefinitionService.saveDraft("ASSET_TRANSFER", dto, 9L);

        ArgumentCaptor<WorkflowDefinition> captor = ArgumentCaptor.forClass(WorkflowDefinition.class);
        verify(workflowDefinitionMapper).insert(captor.capture());
        WorkflowDefinition definition = captor.getValue();
        assertEquals("dept:1", definition.getTenantId());
        assertEquals("ASSET_TRANSFER", definition.getBusinessType());
        assertEquals("DRAFT", definition.getStatus());
        assertEquals(0, definition.getVersion());
        assertEquals(9L, definition.getUpdatedBy());
        assertTrue(definition.getDefinitionJson().contains("approval-1"));
        assertEquals("DRAFT", saved.getStatus());
    }

    @Test
    void shouldRestoreDeletedWorkflowWhenSavingDraft() throws Exception {
        WorkflowDefinition deleted = definition("DISABLED", 4);
        deleted.setDeleted(1);
        WorkflowDefinition restored = definition("DRAFT", 4);
        restored.setName("恢复草稿");
        restored.setDescription("恢复说明");
        restored.setDefinitionJson(objectMapper.writeValueAsString(Map.of(
                "nodes", List.of(Map.of("id", "approval-restore")),
                "edges", List.of())));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(null)
                .thenReturn(restored);
        when(workflowDefinitionMapper.selectIncludingDeleted("dept:1", "ASSET_TRANSFER")).thenReturn(deleted);
        when(workflowDefinitionMapper.restoreDeletedDefinition(
                eq(1L),
                eq("dept:1"),
                eq("ASSET_TRANSFER"),
                eq("恢复草稿"),
                eq("恢复说明"),
                anyString(),
                eq(9L))).thenReturn(1);
        WorkflowDefinitionSaveDTO dto = new WorkflowDefinitionSaveDTO();
        dto.setName("恢复草稿");
        dto.setDescription("恢复说明");
        dto.setDefinition(Map.of(
                "nodes", List.of(Map.of("id", "approval-restore")),
                "edges", List.of()));

        WorkflowDefinitionDTO saved = workflowDefinitionService.saveDraft("ASSET_TRANSFER", dto, 9L);

        assertEquals("DRAFT", saved.getStatus());
        assertEquals(4, saved.getVersion());
        verify(workflowDefinitionMapper).restoreDeletedDefinition(
                eq(1L),
                eq("dept:1"),
                eq("ASSET_TRANSFER"),
                eq("恢复草稿"),
                eq("恢复说明"),
                anyString(),
                eq(9L));
        verify(workflowDefinitionMapper, never()).insert(any(WorkflowDefinition.class));
    }

    @Test
    void shouldRestoreDeletedWorkflowWhenCreatingCustomDefinition() throws Exception {
        String businessType = "CUSTOM_SOFT_DELETE";
        WorkflowDefinition deleted = definition("DISABLED", 4);
        deleted.setBusinessType(businessType);
        deleted.setDeleted(1);
        WorkflowDefinition restored = definition("DRAFT", 4);
        restored.setBusinessType(businessType);
        restored.setName("恢复自定义流程");
        restored.setDescription("恢复自定义说明");
        restored.setDefinitionJson(objectMapper.writeValueAsString(templateRegistry.defaultCustomDefinition()));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(null)
                .thenReturn(restored);
        when(workflowDefinitionMapper.selectIncludingDeleted("dept:1", businessType)).thenReturn(deleted);
        when(workflowDefinitionMapper.restoreDeletedDefinition(
                eq(1L),
                eq("dept:1"),
                eq(businessType),
                eq("恢复自定义流程"),
                eq("恢复自定义说明"),
                anyString(),
                eq(19L))).thenReturn(1);

        WorkflowDefinitionDTO created = workflowDefinitionService.createCustomDefinition(
                businessType, "恢复自定义流程", "恢复自定义说明", 19L);

        assertEquals("DRAFT", created.getStatus());
        assertEquals(4, created.getVersion());
        verify(workflowDefinitionMapper).restoreDeletedDefinition(
                eq(1L),
                eq("dept:1"),
                eq(businessType),
                eq("恢复自定义流程"),
                eq("恢复自定义说明"),
                anyString(),
                eq(19L));
        verify(workflowDefinitionMapper, never()).insert(any(WorkflowDefinition.class));
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

        WorkflowDefinitionDTO saved = workflowDefinitionService.saveDraft("ASSET_TRANSFER", dto, 88L);

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
        lenient().when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(workflowDefinitionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        List<WorkflowDefinitionDTO> definitions = workflowDefinitionService.listDefinitions();

        assertDefaultTemplate(definitions.get(0), "ASSET_TRANSFER", "资产转移流程", 4);
        assertDefaultTemplate(definitions.get(1), "ASSET_CLEARANCE", "资产清退流程", 4);
        assertDefaultTemplate(definitions.get(2), "ASSET_SCRAP", "资产报废转让流程", 4);
        assertDefaultTemplate(definitions.get(3), "ASSET_COMPENSATION", "资产赔偿流程", 4);
    }

    @Test
    void shouldExposePublishedStartAvailabilityForApplicantFlow() {
        WorkflowDefinition definition = definition("PUBLISHED", 3);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        WorkflowStartAvailabilityDTO availability = workflowDefinitionService.getStartAvailability("ASSET_TRANSFER");

        assertTrue(availability.isCanStart());
        assertEquals("ASSET_TRANSFER", availability.getBusinessType());
        assertEquals("PUBLISHED", availability.getStatus());
        assertEquals(3, availability.getVersion());
        assertEquals(1L, availability.getDefinitionId());
        assertEquals("/disposals/transfer/new", availability.getEntryUrl());
        assertEquals("", availability.getBlockReason());
    }

    @Test
    void shouldBlockStartAvailabilityWhenWorkflowIsNotPublished() {
        WorkflowDefinition definition = definition("DISABLED", 3);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        WorkflowStartAvailabilityDTO availability = workflowDefinitionService.getStartAvailability("ASSET_TRANSFER");

        assertEquals(false, availability.isCanStart());
        assertEquals("DISABLED", availability.getStatus());
        assertEquals(3, availability.getVersion());
        assertEquals("业务流程已停用，暂不能提交审批", availability.getBlockReason());
    }

    @Test
    void shouldBlockStartAvailabilityWhenWorkflowHasNoPublishedVersion() {
        WorkflowDefinition definition = definition("PUBLISHED", 0);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        WorkflowStartAvailabilityDTO availability = workflowDefinitionService.getStartAvailability("ASSET_TRANSFER");

        assertEquals(false, availability.isCanStart());
        assertEquals("PUBLISHED", availability.getStatus());
        assertEquals(0, availability.getVersion());
        assertEquals("流程尚未发布有效版本，暂不能提交审批", availability.getBlockReason());
    }

    @Test
    void shouldBlockStartAvailabilityWhenWorkflowIsUnconfigured() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        WorkflowStartAvailabilityDTO availability = workflowDefinitionService.getStartAvailability("ASSET_TRANSFER");

        assertEquals(false, availability.isCanStart());
        assertEquals("UNCONFIGURED", availability.getStatus());
        assertEquals(0, availability.getVersion());
        assertEquals(null, availability.getDefinitionId());
        assertEquals("/disposals/transfer/new", availability.getEntryUrl());
        assertEquals("请先发布对应业务流程后再提交审批", availability.getBlockReason());
    }

    @Test
    void shouldPublishExistingDraftAndIncrementVersion() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        definition.setDefinitionJson(objectMapper.writeValueAsString(fullWorkflowDefinition()));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(workflowDefinitionMapper.update(isNull(), any(LambdaUpdateWrapper.class))).thenReturn(1);

        WorkflowDefinitionDTO published = workflowDefinitionService.publish("ASSET_TRANSFER", 11L);

        assertEquals("PUBLISHED", published.getStatus());
        assertEquals(1, published.getVersion());
        assertEquals(11L, published.getPublishedBy());
        assertNotNull(published.getPublishedAt());
        verify(workflowDefinitionMapper).update(isNull(), any(LambdaUpdateWrapper.class));

        ArgumentCaptor<WorkflowDefinitionVersion> versionCaptor = ArgumentCaptor.forClass(WorkflowDefinitionVersion.class);
        verify(workflowDefinitionVersionMapper).insert(versionCaptor.capture());
        WorkflowDefinitionVersion snapshot = versionCaptor.getValue();
        assertEquals("dept:1", snapshot.getTenantId());
        assertEquals("ASSET_TRANSFER", snapshot.getBusinessType());
        assertEquals(1, snapshot.getVersion());
        assertEquals("PUBLISH", snapshot.getActionType());
        assertEquals("PUBLISHED", snapshot.getStatus());
        assertEquals(11L, snapshot.getOperatorId());
        assertEquals("流程发布", snapshot.getPublishNote());
        assertTrue(snapshot.getDefinitionJson().contains("\"businessType\":\"ASSET_TRANSFER\""));
    }

    @Test
    void shouldPublishAfterLatestSnapshotVersionWhenHeadVersionIsBehind() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 1);
        definition.setDefinitionJson(objectMapper.writeValueAsString(fullWorkflowDefinition()));
        WorkflowDefinitionVersion latest = versionSnapshot(1L, 3, "PUBLISH",
                objectMapper.writeValueAsString(fullWorkflowDefinition()), null);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(latest);
        when(workflowDefinitionMapper.update(isNull(), any(LambdaUpdateWrapper.class))).thenReturn(1);

        WorkflowDefinitionDTO published = workflowDefinitionService.publish("ASSET_TRANSFER", 11L);

        assertEquals("PUBLISHED", published.getStatus());
        assertEquals(4, published.getVersion());
        ArgumentCaptor<WorkflowDefinitionVersion> versionCaptor = ArgumentCaptor.forClass(WorkflowDefinitionVersion.class);
        verify(workflowDefinitionVersionMapper).insert(versionCaptor.capture());
        assertEquals(4, versionCaptor.getValue().getVersion());
    }

    @Test
    void shouldNotInsertVersionSnapshotWhenPublishOptimisticLockFails() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 2);
        definition.setDefinitionJson(objectMapper.writeValueAsString(fullWorkflowDefinition()));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(workflowDefinitionMapper.update(isNull(), any(LambdaUpdateWrapper.class))).thenReturn(0);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("流程定义已被其他操作修改，请刷新后重试", exception.getMessage());
        verify(workflowDefinitionVersionMapper, never()).insert(any(WorkflowDefinitionVersion.class));
    }

    @Test
    void shouldUsePublishedSnapshotForRuntimeAfterDraftSave() throws Exception {
        WorkflowDefinition draftHead = definition("DRAFT", 2);
        draftHead.setDefinitionJson(objectMapper.writeValueAsString(singleApprovalDefinition("GHOST_ROLE")));
        WorkflowDefinitionVersion snapshot = versionSnapshot(7L, 2, "PUBLISH",
                objectMapper.writeValueAsString(singleApprovalDefinition("SUPER_ADMIN")), null);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draftHead);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot);

        WorkflowDefinition published = workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER");
        WorkflowDefinitionService.WorkflowRuntimePlan plan =
                workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", "{}");
        WorkflowStartAvailabilityDTO availability = workflowDefinitionService.getStartAvailability("ASSET_TRANSFER");

        assertEquals(2, published.getVersion());
        assertTrue(published.getDefinitionJson().contains("SUPER_ADMIN"));
        assertEquals(1, plan.approvalNodes().size());
        assertEquals("SUPER_ADMIN", plan.approvalNodes().get(0).approverRole());
        assertTrue(availability.isCanStart());
        assertEquals(2, availability.getVersion());
        assertEquals(7L, availability.getDefinitionId());
    }

    @Test
    void shouldRejectRuntimeWhenOnlyDraftExistsWithoutPublishedSnapshot() {
        WorkflowDefinition draft = definition("DRAFT", 0);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draft);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER"));

        assertEquals("请先发布对应业务流程后再提交审批", exception.getMessage());
    }

    @Test
    void shouldRollbackToHistoricalSnapshotAsNewPublishedVersion() throws Exception {
        WorkflowDefinition head = definition("PUBLISHED", 3);
        head.setDefinitionJson(objectMapper.writeValueAsString(singleApprovalDefinition("SUPER_ADMIN")));
        WorkflowDefinitionVersion latest = versionSnapshot(1L, 3, "PUBLISH",
                objectMapper.writeValueAsString(singleApprovalDefinition("SUPER_ADMIN")), null);
        WorkflowDefinitionVersion target = versionSnapshot(1L, 1, "PUBLISH",
                objectMapper.writeValueAsString(singleApprovalDefinition("部门负责人")), null);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(head);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(target)
                .thenReturn(latest);
        when(workflowDefinitionMapper.update(isNull(), any(LambdaUpdateWrapper.class))).thenReturn(1);
        WorkflowRollbackRequest request = new WorkflowRollbackRequest();
        request.setReason("恢复稳定版本");

        WorkflowDefinitionDTO rolledBack = workflowDefinitionService.rollbackToVersion("ASSET_TRANSFER", 1, request, 19L);

        assertEquals("PUBLISHED", rolledBack.getStatus());
        assertEquals(4, rolledBack.getVersion());
        assertTrue(rolledBack.getDefinition().toString().contains("部门负责人"));
        verify(workflowDefinitionMapper).update(isNull(), any(LambdaUpdateWrapper.class));
        ArgumentCaptor<WorkflowDefinitionVersion> versionCaptor = ArgumentCaptor.forClass(WorkflowDefinitionVersion.class);
        verify(workflowDefinitionVersionMapper).insert(versionCaptor.capture());
        WorkflowDefinitionVersion snapshot = versionCaptor.getValue();
        assertEquals(4, snapshot.getVersion());
        assertEquals("ROLLBACK", snapshot.getActionType());
        assertEquals(1L, snapshot.getRollbackSourceVersion());
        assertEquals("恢复稳定版本", snapshot.getPublishNote());
        assertEquals(19L, snapshot.getOperatorId());
    }

    @Test
    void shouldRejectRollbackWhenTargetVersionDoesNotExist() {
        WorkflowDefinition head = definition("PUBLISHED", 3);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(head);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.rollbackToVersion("ASSET_TRANSFER", 99, null, 19L));

        assertEquals("流程发布版本不存在", exception.getMessage());
        verify(workflowDefinitionMapper, never()).update(isNull(), any(LambdaUpdateWrapper.class));
        verify(workflowDefinitionVersionMapper, never()).insert(any(WorkflowDefinitionVersion.class));
    }

    @Test
    void shouldListVersionHistoryWithoutDefinitionPayloadByDefault() {
        WorkflowDefinitionVersion v2 = versionSnapshot(1L, 2, "ROLLBACK", "{\"nodes\":[]}", 1L);
        WorkflowDefinitionVersion v1 = versionSnapshot(1L, 1, "PUBLISH", "{\"nodes\":[]}", null);
        when(workflowDefinitionVersionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(v2, v1));

        List<WorkflowDefinitionVersionDTO> versions = workflowDefinitionService.listVersionHistory("ASSET_TRANSFER");

        assertEquals(2, versions.size());
        assertEquals(2, versions.get(0).getVersion());
        assertEquals("ROLLBACK", versions.get(0).getActionType());
        assertEquals(1L, versions.get(0).getRollbackSourceVersion());
        assertEquals(null, versions.get(0).getDefinition());
    }

    @Test
    void shouldSavePublishAndReadDefinitionRoundtrip() throws Exception {
        AtomicReference<WorkflowDefinition> stored = new AtomicReference<>();
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> stored.get());
        doAnswer(invocation -> {
            WorkflowDefinition definition = invocation.getArgument(0);
            definition.setId(500L);
            stored.set(definition);
            return 1;
        }).when(workflowDefinitionMapper).insert(any(WorkflowDefinition.class));
        when(workflowDefinitionMapper.update(isNull(), any(LambdaUpdateWrapper.class))).thenReturn(1);

        Map<String, Object> definition = fullWorkflowDefinition();
        WorkflowDefinitionSaveDTO dto = new WorkflowDefinitionSaveDTO();
        dto.setName("桌面端保存发布闭环");
        dto.setDescription("覆盖 saveDraft -> publish -> getDefinition");
        dto.setDefinition(definition);
        dto.setOperatorId(21L);

        WorkflowDefinitionDTO draft = workflowDefinitionService.saveDraft("ASSET_TRANSFER", dto, 21L);
        WorkflowDefinitionDTO published = workflowDefinitionService.publish("ASSET_TRANSFER", 22L);
        WorkflowDefinitionDTO fetched = workflowDefinitionService.getDefinition("ASSET_TRANSFER");

        assertEquals("DRAFT", draft.getStatus());
        assertEquals("PUBLISHED", published.getStatus());
        assertEquals(1, published.getVersion());
        assertEquals(22L, published.getPublishedBy());
        assertNotNull(published.getPublishedAt());
        assertEquals("PUBLISHED", fetched.getStatus());
        assertEquals(1, fetched.getVersion());
        assertEquals("桌面端保存发布闭环", fetched.getName());
        assertWorkflowDefinitionFields(definition, fetched.getDefinition());
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
    void shouldRejectPublishWhenStartNodeFormSourceIsMissing() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(0).get("data");
        data.put("formSource", "");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("节点start-1必须配置环节子表单", exception.getMessage());
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

        assertEquals("条件节点condition-1必须同时配置满足和不满足两条分支", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenConditionTrueBranchIsDuplicated() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> existingEdges = (List<Map<String, Object>>) invalid.get("edges");
        List<Map<String, Object>> edges = new java.util.ArrayList<>(existingEdges);
        edges.add(edge("edge-condition-true-duplicate", "condition-1", "end-1", "condition-true", "target-copy", false, "重复满足"));
        invalid.put("edges", edges);
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("条件节点condition-1只能配置一条满足分支", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenConditionFalseBranchIsDuplicated() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> existingEdges = (List<Map<String, Object>>) invalid.get("edges");
        List<Map<String, Object>> edges = new java.util.ArrayList<>(existingEdges);
        edges.add(edge("edge-condition-false-duplicate", "condition-1", "end-1", "condition-false", "target-copy", false, "重复不满足"));
        invalid.put("edges", edges);
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("条件节点condition-1只能配置一条不满足分支", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenConditionExpressionValueIsMissing() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(2).get("data");
        data.put("conditionExpression", "amount >=");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("条件节点condition-1表达式仅支持简单表达式：字段名 操作符 值", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenConditionExpressionUsesAndOr() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(2).get("data");
        data.put("conditionExpression", "amount >= 100 AND status == APPROVED");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("条件节点condition-1表达式仅支持简单表达式：字段名 操作符 值", exception.getMessage());
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
    void shouldBuildOneStepRuntimePlanForTaskOnlyWorkflow() throws Exception {
        WorkflowDefinitionService.WorkflowRuntimePlan plan =
                workflowDefinitionService.requireRuntimePlan(objectMapper.writeValueAsString(singleTaskDefinition()), "{}");

        assertEquals(1, plan.approvalNodes().size());
        assertEquals(1, plan.finalStep(3));
        assertEquals("task-1", plan.approvalNodes().get(0).nodeId());
        assertEquals("TASK-HANDLE", plan.approvalNodes().get(0).nodeCode());
        assertEquals("sequence", plan.approvalNodes().get(0).approvalMode());
    }

    @Test
    void shouldMergeTrailingCcIntoLastExecutableNodeWithoutIncreasingFinalStep() throws Exception {
        WorkflowDefinitionService.WorkflowRuntimePlan plan =
                workflowDefinitionService.requireRuntimePlan(objectMapper.writeValueAsString(taskWithTrailingCcDefinition()), "{}");

        assertEquals(1, plan.approvalNodes().size());
        assertEquals(1, plan.finalStep(9));
        assertEquals("SUPER_ADMIN,FINANCE", plan.approvalNodes().get(0).ccRoleCodes());
        assertEquals("7,9", plan.approvalNodes().get(0).ccUserIds());
    }

    @Test
    void shouldMergeIntermediateCcIntoNextExecutableNodeWithoutIncreasingFinalStep() throws Exception {
        WorkflowDefinitionService.WorkflowRuntimePlan plan =
                workflowDefinitionService.requireRuntimePlan(objectMapper.writeValueAsString(taskCcApprovalDefinition()), "{}");

        assertEquals(2, plan.approvalNodes().size());
        assertEquals(2, plan.finalStep(9));
        assertEquals("task-1", plan.approvalNodes().get(0).nodeId());
        assertEquals("", plan.approvalNodes().get(0).ccRoleCodes());
        assertEquals("", plan.approvalNodes().get(0).ccUserIds());
        assertEquals("approval-1", plan.approvalNodes().get(1).nodeId());
        assertEquals("FINANCE", plan.approvalNodes().get(1).ccRoleCodes());
        assertEquals("7,9", plan.approvalNodes().get(1).ccUserIds());
    }

    @Test
    void shouldRejectPublishWhenTaskAssigneeIsMissing() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = singleTaskDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approverRole", "");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("办理节点办理角色不能为空", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenCcRecipientsAreMissing() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = taskWithTrailingCcDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(2).get("data");
        data.put("ccRoleCodes", "");
        data.put("ccUserIds", "");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("抄送节点cc-1必须配置抄送角色或抄送用户", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenCcRoleDoesNotExist() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = taskWithTrailingCcDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(2).get("data");
        data.put("ccRoleCodes", "GHOST_CC");
        data.put("ccUserIds", "");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(userRoleMapper.countActiveByRoleCode("GHOST_CC")).thenReturn(0);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("抄送节点cc-1抄送角色不存在或已禁用: GHOST_CC", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenCcUserDoesNotExist() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = taskWithTrailingCcDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(2).get("data");
        data.put("ccRoleCodes", "");
        data.put("ccUserIds", "999");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("抄送节点cc-1抄送用户不存在或已禁用: userId=999", exception.getMessage());
    }

    @Test
    void shouldRejectPublishWhenExecutableNodeCcRoleDoesNotExist() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = singleTaskDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("ccRoleCodes", "GHOST_CC");
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        when(userRoleMapper.countActiveByRoleCode("GHOST_CC")).thenReturn(0);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("抄送节点task-1抄送角色不存在或已禁用: GHOST_CC", exception.getMessage());
    }

    @Test
    void shouldPreviewRoleAssigneesFromCurrentDefinition() {
        when(userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN")).thenReturn(List.of(7L, 9L));
        WorkflowAssigneePreviewRequest request = new WorkflowAssigneePreviewRequest();
        request.setDefinition(singleApprovalDefinition("SUPER_ADMIN"));
        request.setBusinessData(Map.of());

        WorkflowAssigneePreviewResponse response = workflowDefinitionService.previewAssignees("ASSET_TRANSFER", request);

        assertTrue(response.isCalculable());
        assertEquals(1, response.getNodes().size());
        assertTrue(response.getNodes().get(0).isResolved());
        assertEquals(2, response.getNodes().get(0).getAssigneeCount());
        assertEquals(List.of("7", "9"), response.getNodes().get(0).getAssignees().stream()
                .map(WorkflowAssigneePreviewResponse.Assignee::getUserId)
                .toList());
    }

    @Test
    void shouldPreviewUnresolvedWhenRoleHasNoActiveUsers() {
        when(userRoleMapper.selectActiveUserIdsByRole("EMPTY_ROLE")).thenReturn(List.of());
        WorkflowAssigneePreviewRequest request = new WorkflowAssigneePreviewRequest();
        request.setDefinition(singleApprovalDefinition("EMPTY_ROLE"));
        request.setBusinessData(Map.of());

        WorkflowAssigneePreviewResponse response = workflowDefinitionService.previewAssignees("ASSET_TRANSFER", request);

        assertEquals(false, response.isCalculable());
        assertEquals(1, response.getNodes().size());
        assertEquals(false, response.getNodes().get(0).isResolved());
        assertEquals(List.of(), response.getNodes().get(0).getAssignees());
        assertEquals("角色不存在或无启用用户", response.getNodes().get(0).getReason());
    }

    @Test
    void shouldPreviewUnresolvedWhenApprovalConfigMissing() {
        WorkflowAssigneePreviewRequest request = new WorkflowAssigneePreviewRequest();
        request.setDefinition(singleApprovalDefinition(""));
        request.setBusinessData(Map.of());

        WorkflowAssigneePreviewResponse response = workflowDefinitionService.previewAssignees("ASSET_TRANSFER", request);

        assertEquals(false, response.isCalculable());
        assertEquals(1, response.getNodes().size());
        assertEquals(false, response.getNodes().get(0).isResolved());
        assertEquals(List.of(), response.getNodes().get(0).getAssignees());
        assertEquals("节点缺少处理角色配置", response.getNodes().get(0).getReason());
    }

    @Test
    void shouldNotPreviewAssigneesWhenConditionInputMissing() {
        WorkflowAssigneePreviewRequest request = new WorkflowAssigneePreviewRequest();
        request.setDefinition(branchingWorkflowDefinition());
        request.setBusinessData(Map.of("reason", "缺少金额"));

        WorkflowAssigneePreviewResponse response = workflowDefinitionService.previewAssignees("ASSET_TRANSFER", request);

        assertEquals(false, response.isCalculable());
        assertEquals(List.of("申请金额"), response.getMissingFields());
        assertEquals(List.of(), response.getNodes());
    }

    @Test
    void shouldPreviewRuntimeAssigneesFromLatestPublishedVersion() throws Exception {
        WorkflowDefinition draftHead = definition("DRAFT", 2);
        draftHead.setDefinitionJson(objectMapper.writeValueAsString(singleApprovalDefinition("GHOST_ROLE")));
        WorkflowDefinitionVersion snapshot = versionSnapshot(7L, 2, "PUBLISH",
                objectMapper.writeValueAsString(singleApprovalDefinition("SUPER_ADMIN")), null);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(draftHead);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot);
        when(userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN")).thenReturn(List.of(7L, 9L));
        WorkflowRuntimeAssigneePreviewRequest request = new WorkflowRuntimeAssigneePreviewRequest();
        request.setBusinessData(Map.of("targetDeptId", "2"));

        WorkflowAssigneePreviewResponse response =
                workflowDefinitionService.previewPublishedAssignees("ASSET_TRANSFER", request);

        assertTrue(response.isCalculable());
        assertEquals(1, response.getNodes().size());
        assertEquals("SUPER_ADMIN", response.getNodes().get(0).getApproverRole());
        assertEquals(2, response.getNodes().get(0).getAssigneeCount());
        assertEquals(List.of(), response.getNodes().get(0).getAssignees());
    }

    @Test
    void shouldHideRuntimeApproverIdForPublishedUserAssigneePreview() throws Exception {
        WorkflowDefinition head = definition("PUBLISHED", 1);
        Map<String, Object> publishedDefinition = singleApprovalDefinition("");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) publishedDefinition.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approverType", "user");
        data.put("approverId", "7");
        WorkflowDefinitionVersion snapshot = versionSnapshot(7L, 1, "PUBLISH",
                objectMapper.writeValueAsString(publishedDefinition), null);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(head);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot);
        WorkflowRuntimeAssigneePreviewRequest request = new WorkflowRuntimeAssigneePreviewRequest();
        request.setBusinessData(Map.of());

        WorkflowAssigneePreviewResponse response =
                workflowDefinitionService.previewPublishedAssignees("ASSET_TRANSFER", request);

        assertTrue(response.isCalculable());
        assertEquals(1, response.getNodes().size());
        assertEquals("user", response.getNodes().get(0).getApproverType());
        assertEquals("", response.getNodes().get(0).getApproverId());
        assertEquals(1, response.getNodes().get(0).getAssigneeCount());
        assertEquals(List.of(), response.getNodes().get(0).getAssignees());
    }

    @Test
    void shouldHideRuntimeAssigneesWhenPublishedConditionInputMissing() throws Exception {
        WorkflowDefinition head = definition("PUBLISHED", 1);
        WorkflowDefinitionVersion snapshot = versionSnapshot(1L, 1, "PUBLISH",
                objectMapper.writeValueAsString(branchingWorkflowDefinition()), null);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(head);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot);
        WorkflowRuntimeAssigneePreviewRequest request = new WorkflowRuntimeAssigneePreviewRequest();
        request.setBusinessData(Map.of("reason", "缺少金额"));

        WorkflowAssigneePreviewResponse response =
                workflowDefinitionService.previewPublishedAssignees("ASSET_TRANSFER", request);

        assertEquals(false, response.isCalculable());
        assertEquals(List.of("申请金额"), response.getMissingFields());
        assertEquals(List.of(), response.getNodes());
    }

    @Test
    void shouldDisableAndEnablePublishedDefinition() {
        WorkflowDefinition definition = definition("PUBLISHED", 2);
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);
        WorkflowStatusUpdateDTO disable = new WorkflowStatusUpdateDTO();
        disable.setStatus("DISABLED");
        disable.setOperatorId(12L);

        WorkflowDefinitionDTO disabled = workflowDefinitionService.updateStatus("ASSET_TRANSFER", disable, 12L);

        assertEquals("DISABLED", disabled.getStatus());
        assertEquals(12L, definition.getUpdatedBy());

        WorkflowStatusUpdateDTO enable = new WorkflowStatusUpdateDTO();
        enable.setStatus("ENABLED");
        enable.setOperatorId(13L);

        WorkflowDefinitionDTO enabled = workflowDefinitionService.updateStatus("ASSET_TRANSFER", enable, 13L);

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

    @Test
    void shouldRejectPublishWhenApprovalModeCountIsUsed() throws Exception {
        WorkflowDefinition definition = definition("DRAFT", 0);
        Map<String, Object> invalid = fullWorkflowDefinition();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) invalid.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) nodes.get(1).get("data");
        data.put("approvalMode", "count");
        data.put("countThreshold", 1);
        definition.setDefinitionJson(objectMapper.writeValueAsString(invalid));
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> workflowDefinitionService.publish("ASSET_TRANSFER", 11L));

        assertEquals("审批节点审批模式仅支持 sequence/all/any", exception.getMessage());
    }

    private WorkflowDefinition definition(String status, Integer version) {
        WorkflowDefinition definition = new WorkflowDefinition();
        definition.setId(1L);
        definition.setTenantId("dept:1");
        definition.setBusinessType("ASSET_TRANSFER");
        definition.setName("资产转移流程");
        definition.setDescription("用于资产转移审批");
        definition.setDefinitionJson("{\"nodes\":[{\"id\":\"approval-1\"}],\"edges\":[]}");
        definition.setStatus(status);
        definition.setVersion(version);
        return definition;
    }

    private WorkflowDefinitionVersion versionSnapshot(Long definitionId, Integer version, String actionType,
                                                       String definitionJson, Long rollbackSourceVersion) {
        WorkflowDefinitionVersion snapshot = new WorkflowDefinitionVersion();
        snapshot.setId(Long.valueOf(version));
        snapshot.setTenantId("dept:1");
        snapshot.setDefinitionId(definitionId);
        snapshot.setBusinessType("ASSET_TRANSFER");
        snapshot.setVersion(version);
        snapshot.setActionType(actionType);
        snapshot.setStatus("PUBLISHED");
        snapshot.setName("资产转移流程");
        snapshot.setDescription("用于资产转移审批");
        snapshot.setDefinitionJson(definitionJson);
        snapshot.setPublishNote("PUBLISH".equals(actionType) ? "流程发布" : "流程回滚");
        snapshot.setImpactScope("影响后续新发起审批，已发起实例保持原版本快照");
        snapshot.setRollbackPlan("可在版本历史中回滚至任一已发布快照");
        snapshot.setRollbackSourceVersion(rollbackSourceVersion);
        snapshot.setOperatorId(11L);
        snapshot.setPublishedAt(java.time.LocalDateTime.now());
        snapshot.setCreateTime(java.time.LocalDateTime.now());
        return snapshot;
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
        assertEquals(expectedData.get("approverType"), actualData.get("approverType"));
        assertEquals(expectedData.get("approverRole"), actualData.get("approverRole"));
        assertEquals(expectedData.get("approverId"), actualData.get("approverId"));
        assertEquals(expectedData.get("approverRoleName"), actualData.get("approverRoleName"));
        assertEquals(expectedData.get("approvalMode"), actualData.get("approvalMode"));
        assertEquals(expectedData.get("conditionExpression"), actualData.get("conditionExpression"));
        assertEquals(expectedData.get("trueLabel"), actualData.get("trueLabel"));
        assertEquals(expectedData.get("falseLabel"), actualData.get("falseLabel"));
        assertEquals(expectedData.get("resultAction"), actualData.get("resultAction"));
        assertEquals(expectedData.get("ccRoleCodes"), actualData.get("ccRoleCodes"));
        assertEquals(expectedData.get("ccUserIds"), actualData.get("ccUserIds"));
        assertEquals(expectedData.get("formSource"), actualData.get("formSource"));
        assertEquals(expectedData.get("formSectionName"), actualData.get("formSectionName"));
        assertEquals(expectedData.get("formSummaryFields"), actualData.get("formSummaryFields"));
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
        assertNotNull(data.get("formSource"));
        assertNotNull(data.get("formSectionName"));
        assertNotNull(data.get("formSummaryFields"));
        if ("start".equals(type) || "approval".equals(type)) {
            assertTrue(String.valueOf(data.get("formSource")).contains("<form>"));
        }
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

    private Map<String, Object> singleApprovalDefinition(String approverRole) {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-ASSET_TRANSFER");
        definition.put("name", "单节点审批流程");
        definition.put("description", "用于处理人预览");
        definition.put("businessType", "ASSET_TRANSFER");
        definition.put("nodes", List.of(
                node("start-1", "start", 120, 40, data("start", "提交申请", "提交后进入流程", "START-APPLY", "表单提交", "", "sequence", "", "", "", "")),
                node("approval-1", "approval", 120, 200, data("approval", "部门审批", "部门负责人确认", "APP-DEPT", "", approverRole, "sequence", "", "", "", "")),
                node("end-1", "end", 120, 360, data("end", "流程结束", "归档并同步业务状态", "END-ARCHIVE", "", "", "sequence", "", "", "", "归档并同步到审批列表"))
        ));
        definition.put("edges", List.of(
                edge("edge-start-approval", "start-1", "approval-1", null, null, true, null),
                edge("edge-approval-end", "approval-1", "end-1", null, null, true, null)
        ));
        return definition;
    }

    private Map<String, Object> singleTaskDefinition() {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-ASSET_TRANSFER");
        definition.put("name", "单节点办理流程");
        definition.put("description", "用于办理节点运行计划");
        definition.put("businessType", "ASSET_TRANSFER");
        definition.put("nodes", List.of(
                node("start-1", "start", 120, 40, data("start", "提交申请", "提交后进入流程", "START-APPLY", "表单提交", "", "sequence", "", "", "", "")),
                node("task-1", "task", 120, 200, data("task", "资产办理", "办理人处理资产事项", "TASK-HANDLE", "", "SUPER_ADMIN", "sequence", "", "", "", "")),
                node("end-1", "end", 120, 360, data("end", "流程结束", "归档并同步业务状态", "END-ARCHIVE", "", "", "sequence", "", "", "", "归档并同步到审批列表"))
        ));
        definition.put("edges", List.of(
                edge("edge-start-task", "start-1", "task-1", null, null, true, null),
                edge("edge-task-end", "task-1", "end-1", null, null, true, null)
        ));
        return definition;
    }

    private Map<String, Object> taskWithTrailingCcDefinition() {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-ASSET_TRANSFER");
        definition.put("name", "办理后抄送流程");
        definition.put("description", "用于抄送元数据回填");
        definition.put("businessType", "ASSET_TRANSFER");
        definition.put("nodes", List.of(
                node("start-1", "start", 120, 40, data("start", "提交申请", "提交后进入流程", "START-APPLY", "表单提交", "", "sequence", "", "", "", "")),
                node("task-1", "task", 120, 200, data("task", "资产办理", "办理人处理资产事项", "TASK-HANDLE", "", "SUPER_ADMIN", "sequence", "", "", "", "")),
                node("cc-1", "cc", 120, 360, data("cc", "抄送财务", "通知财务和经办人", "CC-FINANCE", "", "", "sequence", "", "", "", "")),
                node("end-1", "end", 120, 520, data("end", "流程结束", "归档并同步业务状态", "END-ARCHIVE", "", "", "sequence", "", "", "", "归档并同步到审批列表"))
        ));
        @SuppressWarnings("unchecked")
        Map<String, Object> taskData = (Map<String, Object>) ((Map<String, Object>) ((List<?>) definition.get("nodes")).get(1)).get("data");
        taskData.put("ccRoleCodes", "SUPER_ADMIN");
        @SuppressWarnings("unchecked")
        Map<String, Object> ccData = (Map<String, Object>) ((Map<String, Object>) ((List<?>) definition.get("nodes")).get(2)).get("data");
        ccData.put("ccRoleCodes", "FINANCE");
        ccData.put("ccUserIds", "7,9");
        definition.put("edges", List.of(
                edge("edge-start-task", "start-1", "task-1", null, null, true, null),
                edge("edge-task-cc", "task-1", "cc-1", null, null, true, null),
                edge("edge-cc-end", "cc-1", "end-1", null, null, true, null)
        ));
        return definition;
    }

    private Map<String, Object> taskCcApprovalDefinition() {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-ASSET_TRANSFER");
        definition.put("name", "办理抄送审批流程");
        definition.put("description", "用于验证中间抄送挂载到后续执行节点");
        definition.put("businessType", "ASSET_TRANSFER");
        definition.put("nodes", List.of(
                node("start-1", "start", 120, 40, data("start", "提交申请", "提交后进入流程", "START-APPLY", "表单提交", "", "sequence", "", "", "", "")),
                node("task-1", "task", 120, 200, data("task", "资产办理", "办理人处理资产事项", "TASK-HANDLE", "", "SUPER_ADMIN", "sequence", "", "", "", "")),
                node("cc-1", "cc", 120, 360, data("cc", "抄送财务", "通知财务和经办人", "CC-FINANCE", "", "", "sequence", "", "", "", "")),
                node("approval-1", "approval", 120, 520, data("approval", "财务审批", "财务负责人确认", "APP-FINANCE", "", "FINANCE", "sequence", "", "", "", "")),
                node("end-1", "end", 120, 680, data("end", "流程结束", "归档并同步业务状态", "END-ARCHIVE", "", "", "sequence", "", "", "", "归档并同步到审批列表"))
        ));
        @SuppressWarnings("unchecked")
        Map<String, Object> ccData = (Map<String, Object>) ((Map<String, Object>) ((List<?>) definition.get("nodes")).get(2)).get("data");
        ccData.put("ccRoleCodes", "FINANCE");
        ccData.put("ccUserIds", "7,9");
        definition.put("edges", List.of(
                edge("edge-start-task", "start-1", "task-1", null, null, true, null),
                edge("edge-task-cc", "task-1", "cc-1", null, null, true, null),
                edge("edge-cc-approval", "cc-1", "approval-1", null, null, true, null),
                edge("edge-approval-end", "approval-1", "end-1", null, null, true, null)
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
        data.put("approverType", "role");
        data.put("approverRole", approverRole);
        data.put("approverId", "");
        data.put("approverRoleName", "");
        data.put("approvalMode", approvalMode);
        data.put("conditionExpression", conditionExpression);
        data.put("trueLabel", trueLabel);
        data.put("falseLabel", falseLabel);
        data.put("resultAction", resultAction);
        data.put("ccRoleCodes", "");
        data.put("ccUserIds", "");
        if ("start".equals(type)) {
            data.put("formSource", "<form><label>申请事由</label><input name=\"reason\" /><label>申请金额</label><input name=\"amount\" type=\"number\" /></form>");
            data.put("formSectionName", "申请信息");
            data.put("formSummaryFields", "reason,amount");
        } else if ("approval".equals(type)) {
            data.put("formSource", "<form><label>审批意见</label><textarea name=\"approvalComment\"></textarea></form>");
            data.put("formSectionName", "审批意见");
            data.put("formSummaryFields", "approvalComment,approvalResult");
        } else {
            data.put("formSource", "");
            data.put("formSectionName", "");
            data.put("formSummaryFields", "");
        }
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
