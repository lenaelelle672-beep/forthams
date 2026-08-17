package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.ApprovalNodeAssignment;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.User;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.WorkflowDefinitionVersion;
import com.ams.mapper.ApprovalNodeAssignmentMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.ams.mapper.WorkflowDefinitionVersionMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
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
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApprovalAssignmentServiceTest {

    @BeforeAll
    static void initMybatisPlusTableInfo() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), ApprovalNodeAssignment.class);
    }

    @Mock
    private ApprovalNodeAssignmentMapper approvalNodeAssignmentMapper;

    @Mock
    private WorkflowDefinitionMapper workflowDefinitionMapper;

    @Mock
    private WorkflowDefinitionVersionMapper workflowDefinitionVersionMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private UserMapper userMapper;

    @Mock
    private UserTenantMembershipMapper userTenantMembershipMapper;

    private ApprovalAssignmentService approvalAssignmentService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        approvalAssignmentService = new ApprovalAssignmentService(
                approvalNodeAssignmentMapper,
                workflowDefinitionMapper,
                workflowDefinitionVersionMapper,
                userRoleMapper,
                userMapper,
                userTenantMembershipMapper,
                new ObjectMapper());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void initializeMustResolveAssigneesFromImmutableSnapshotNotMutableProjection() {
        WorkflowDefinition projection = definition("""
                {"nodes":[{"id":"projection-only","type":"APPROVAL","config":{"approverType":"user","approverId":"999","approvalMode":"sequence"}}]}
                """);
        WorkflowDefinitionVersion snapshot = snapshot(validSnapshotJson());
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(projection);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot);
        when(userRoleMapper.selectUserIdsByRoleCode("AUDITOR", "T001")).thenReturn(List.of("8"));
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user(8L), user(10L));
        when(userTenantMembershipMapper.countActiveMembership(anyLong(), eq("T001"))).thenReturn(1L);
        when(approvalNodeAssignmentMapper.insert(any(ApprovalNodeAssignment.class))).thenReturn(1);

        approvalAssignmentService.initializeForProcess(process(7L), "ASSET_TRANSFER");

        ArgumentCaptor<ApprovalNodeAssignment> assignmentCaptor = ArgumentCaptor.forClass(ApprovalNodeAssignment.class);
        verify(approvalNodeAssignmentMapper, times(2)).insert(assignmentCaptor.capture());
        List<ApprovalNodeAssignment> assignments = assignmentCaptor.getAllValues();
        assertEquals(List.of(8L, 10L), assignments.stream().map(ApprovalNodeAssignment::getAssigneeId).toList());
        assertEquals(List.of(1, 2), assignments.stream().map(ApprovalNodeAssignment::getStepNo).toList());
        assertTrue(assignments.stream().allMatch(assignment -> assignment.getWorkflowDefinitionId().equals(31L)));
        assertTrue(assignments.stream().allMatch(assignment -> assignment.getWorkflowVersion().equals(4)));
    }

    @Test
    void initializeMustFailClosedWhenImmutableSnapshotIsMissing() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition(validSnapshotJson()));
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        AccessDeniedException exception = assertThrows(AccessDeniedException.class,
                () -> approvalAssignmentService.initializeForProcess(process(7L), "RETIREMENT"));

        assertTrue(exception.getMessage().contains("快照"));
        verify(approvalNodeAssignmentMapper, never()).insert(any(ApprovalNodeAssignment.class));
    }

    @Test
    void retirementAndWorkOrderWithoutPublishedDefinitionMustFailClosed() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        assertThrows(AccessDeniedException.class,
                () -> approvalAssignmentService.initializeForProcess(process(7L), "RETIREMENT"));
        assertThrows(AccessDeniedException.class,
                () -> approvalAssignmentService.initializeForProcess(process(7L), "WORK_ORDER"));
    }

    @Test
    void initializeMustRejectRoleThatResolvesMoreThanOnePersonForSequenceMode() {
        when(workflowDefinitionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(definition(validSnapshotJson()));
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot(singleRoleSnapshotJson()));
        when(userRoleMapper.selectUserIdsByRoleCode("AUDITOR", "T001")).thenReturn(List.of("8", "9"));
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user(8L), user(9L));
        when(userTenantMembershipMapper.countActiveMembership(anyLong(), eq("T001"))).thenReturn(1L);

        AccessDeniedException exception = assertThrows(AccessDeniedException.class,
                () -> approvalAssignmentService.initializeForProcess(process(7L), "ASSET_TRANSFER"));

        assertTrue(exception.getMessage().contains("只能解析一名处理人"));
        verify(approvalNodeAssignmentMapper, never()).insert(any(ApprovalNodeAssignment.class));
    }

    @Test
    void publishMustAcceptRoleThatResolvesAtLeastOneCurrentTenantUser() {
        when(userRoleMapper.selectUserIdsByRoleCode("AUDITOR", "T001")).thenReturn(List.of("8", "9"));
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user(8L));
        when(userTenantMembershipMapper.countActiveMembership(8L, "T001")).thenReturn(1L);

        approvalAssignmentService.requirePublishableAssignees(singleRoleSnapshotJson(), "T001");
    }

    @Test
    void publishMustRejectHardcodedSuperAdminRole() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalAssignmentService.requirePublishableAssignees(superAdminSnapshotJson(), "T001"));

        assertTrue(exception.getMessage().contains("SUPER_ADMIN"));
        verify(userRoleMapper, never()).selectUserIdsByRoleCode(any(), any());
    }

    @Test
    void publishMustRejectEmptyRoleAndUnresolvedUser() {
        BusinessException emptyRole = assertThrows(BusinessException.class,
                () -> approvalAssignmentService.requirePublishableAssignees(emptyRoleSnapshotJson(), "T001"));
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        BusinessException missingUser = assertThrows(BusinessException.class,
                () -> approvalAssignmentService.requirePublishableAssignees(validDefinitionUserJson(), "T001"));

        assertTrue(emptyRole.getMessage().contains("流程图校验失败") || emptyRole.getMessage().contains("未配置"));
        assertTrue(missingUser.getMessage().contains("处理人"));
    }

    @Test
    void reserveMustRejectCurrentAssignmentWhoseVersionSnapshotIsMissing() {
        ApprovalNodeAssignment assignment = assignment(1, 8L);
        when(approvalNodeAssignmentMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(assignment);
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        AccessDeniedException exception = assertThrows(AccessDeniedException.class,
                () -> approvalAssignmentService.reserveCurrentAssignment(process(7L), 8L));

        assertTrue(exception.getMessage().contains("快照"));
        verify(approvalNodeAssignmentMapper, never()).update(any(ApprovalNodeAssignment.class), any(LambdaUpdateWrapper.class));
    }

    @Test
    void reserveMustUseFrozenAssignmentAfterSnapshotVerification() {
        when(approvalNodeAssignmentMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(assignment(1, 8L));
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(snapshot(validSnapshotJson()));
        when(approvalNodeAssignmentMapper.update(any(ApprovalNodeAssignment.class), any(LambdaUpdateWrapper.class)))
                .thenReturn(0);

        assertThrows(AccessDeniedException.class,
                () -> approvalAssignmentService.reserveCurrentAssignment(process(7L), 8L));

        ArgumentCaptor<ApprovalNodeAssignment> assignmentCaptor = ArgumentCaptor.forClass(ApprovalNodeAssignment.class);
        ArgumentCaptor<LambdaUpdateWrapper<ApprovalNodeAssignment>> wrapperCaptor = ArgumentCaptor.forClass(LambdaUpdateWrapper.class);
        verify(approvalNodeAssignmentMapper).update(assignmentCaptor.capture(), wrapperCaptor.capture());
        assertEquals("DECIDED", assignmentCaptor.getValue().getStatus());
        wrapperCaptor.getValue().getSqlSegment();
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue("T001"));
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(11L));
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(1));
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(8L));
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue("PENDING"));
    }

    @Test
    void freezeMustCancelEveryRemainingPendingAssignmentForTheProcess() {
        when(approvalNodeAssignmentMapper.update(any(ApprovalNodeAssignment.class), any(LambdaUpdateWrapper.class)))
                .thenReturn(2);

        approvalAssignmentService.freezePendingAssignments(11L);

        ArgumentCaptor<ApprovalNodeAssignment> assignmentCaptor = ArgumentCaptor.forClass(ApprovalNodeAssignment.class);
        ArgumentCaptor<LambdaUpdateWrapper<ApprovalNodeAssignment>> wrapperCaptor = ArgumentCaptor.forClass(LambdaUpdateWrapper.class);
        verify(approvalNodeAssignmentMapper).update(assignmentCaptor.capture(), wrapperCaptor.capture());
        assertEquals("CANCELLED", assignmentCaptor.getValue().getStatus());
        wrapperCaptor.getValue().getSqlSegment();
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue("T001"));
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(11L));
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue("PENDING"));
    }

    @Test
    void pendingScopeAndFinalStepMustFailClosedWithoutFrozenDataOrSnapshot() {
        QueryWrapper<ApprovalProcess> wrapper = new QueryWrapper<>();
        approvalAssignmentService.applyCurrentPendingAssignmentScope(wrapper, 8L);

        assertTrue(wrapper.getSqlSegment().contains("approval_node_assignment"));
        assertTrue(wrapper.getSqlSegment().contains("workflow_definition_version"));
        assertTrue(wrapper.getSqlSegment().contains("current_assignment.workflow_definition_id"));
        assertTrue(wrapper.getParamNameValuePairs().containsValue("T001"));
        assertTrue(wrapper.getParamNameValuePairs().containsValue(8L));

        when(approvalNodeAssignmentMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(assignment(2, 8L));
        when(workflowDefinitionVersionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        assertThrows(AccessDeniedException.class, () -> approvalAssignmentService.getFinalStep(process(7L)));
    }

    private WorkflowDefinition definition(String definitionJson) {
        WorkflowDefinition definition = new WorkflowDefinition();
        definition.setId(31L);
        definition.setTenantId("T001");
        definition.setBusinessType("ASSET_TRANSFER");
        definition.setStatus("PUBLISHED");
        definition.setVersion(4);
        definition.setDefinitionJson(definitionJson);
        return definition;
    }

    private WorkflowDefinitionVersion snapshot(String definitionJson) {
        WorkflowDefinitionVersion snapshot = new WorkflowDefinitionVersion();
        snapshot.setId(91L);
        snapshot.setTenantId("T001");
        snapshot.setDefinitionId(31L);
        snapshot.setBusinessType("ASSET_TRANSFER");
        snapshot.setVersion(4);
        snapshot.setStatus("PUBLISHED");
        snapshot.setDefinitionJson(definitionJson);
        return snapshot;
    }

    private ApprovalProcess process(Long applicantId) {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(11L);
        process.setTenantId("T001");
        process.setApplicantId(applicantId);
        process.setCurrentStep(1);
        return process;
    }

    private ApprovalNodeAssignment assignment(int stepNo, Long assigneeId) {
        ApprovalNodeAssignment assignment = new ApprovalNodeAssignment();
        assignment.setTenantId("T001");
        assignment.setProcessId(11L);
        assignment.setStepNo(stepNo);
        assignment.setAssigneeId(assigneeId);
        assignment.setStatus("PENDING");
        assignment.setWorkflowDefinitionId(31L);
        assignment.setWorkflowVersion(4);
        return assignment;
    }

    private User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setTenantId("T001");
        user.setStatus(1);
        user.setDeleted(0);
        return user;
    }

    private String validSnapshotJson() {
        return """
                {"name":"snapshot","nodes":[
                  {"id":"end","type":"END"},
                  {"id":"approval-2","type":"APPROVAL","config":{"approverType":"user","approverId":"10","approvalMode":"sequence"}},
                  {"id":"start","type":"START"},
                  {"id":"approval-1","type":"APPROVAL","config":{"approverType":"role","approverRole":"AUDITOR","approvalMode":"sequence"}}
                ],"edges":[
                  {"source":"start","target":"approval-1"},
                  {"source":"approval-1","target":"approval-2"},
                  {"source":"approval-2","target":"end"}
                ]}
                """;
    }

    private String superAdminSnapshotJson() {
        return """
                {"nodes":[
                  {"id":"start","type":"START"},
                  {"id":"approval","type":"APPROVAL","config":{"approverType":"role","approverRole":"SUPER_ADMIN","approvalMode":"sequence"}},
                  {"id":"end","type":"END"}
                ],"edges":[
                  {"source":"start","target":"approval"},
                  {"source":"approval","target":"end"}
                ]}
                """;
    }

    private String emptyRoleSnapshotJson() {
        return """
                {"nodes":[
                  {"id":"start","type":"START"},
                  {"id":"approval","type":"APPROVAL","config":{"approverType":"role","approverRole":"","approvalMode":"sequence"}},
                  {"id":"end","type":"END"}
                ],"edges":[
                  {"source":"start","target":"approval"},
                  {"source":"approval","target":"end"}
                ]}
                """;
    }

    private String validDefinitionUserJson() {
        return """
                {"nodes":[
                  {"id":"start","type":"START"},
                  {"id":"approval","type":"APPROVAL","config":{"approverType":"user","approverId":"8","approvalMode":"sequence"}},
                  {"id":"end","type":"END"}
                ],"edges":[
                  {"source":"start","target":"approval"},
                  {"source":"approval","target":"end"}
                ]}
                """;
    }

    private String singleRoleSnapshotJson() {
        return """
                {"nodes":[
                  {"id":"start","type":"START"},
                  {"id":"approval","type":"APPROVAL","config":{"approverType":"role","approverRole":"AUDITOR","approvalMode":"sequence"}},
                  {"id":"end","type":"END"}
                ],"edges":[
                  {"source":"start","target":"approval"},
                  {"source":"approval","target":"end"}
                ]}
                """;
    }
}
