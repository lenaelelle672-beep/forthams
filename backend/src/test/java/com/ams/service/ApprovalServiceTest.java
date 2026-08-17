package com.ams.service;

import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.entity.User;
import com.ams.context.TenantContext;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.dto.ApprovalRecoveryDTO;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
class ApprovalServiceTest {

    @Mock
    private ApprovalProcessMapper approvalProcessMapper;

    @Mock
    private ApprovalRecordMapper approvalRecordMapper;

    @Mock
    private RetirementApplicationService retirementApplicationService;

    @Mock
    private WorkOrderService workOrderService;

    @Mock
    private AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private ApprovalAssignmentService approvalAssignmentService;

    @InjectMocks
    private ApprovalService approvalService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        grant("approval:approve", "approval:query", "approval:create", "workorder:query", "workorder:approve");
        User currentUser = new User();
        currentUser.setId(42L);
        lenient().when(tenantAuthorityService.requireCurrentTenantMember()).thenReturn(currentUser);
        lenient().when(approvalProcessMapper.update(any(ApprovalProcess.class), any())).thenReturn(1);
        lenient().when(approvalRecordMapper.insert(any(ApprovalRecord.class))).thenReturn(1);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldCompleteWorkOrderApprovalInOneStepAndUpdateWorkOrder() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(5L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setApplicantId(7L);
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(approvalAssignmentService.getFinalStep(process)).thenReturn(1);

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("APPROVED", result.getStatus());
        var recordCaptor = forClass(ApprovalRecord.class);
        verify(approvalRecordMapper).insert(recordCaptor.capture());
        assertEquals("T001", recordCaptor.getValue().getTenantId());
        verify(approvalAssignmentService).reserveCurrentAssignment(process, 42L);
        verify(approvalProcessMapper).update(org.mockito.ArgumentMatchers.eq(process), any());
        verify(workOrderService).applyApprovalOutcome(9L, "APPROVED", "ok");
    }

    @Test
    void approvalStopsBeforeAnyProcessWriteWhenCurrentUserHasNoNodeAssignment() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(15L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setApplicantId(7L);
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(approvalAssignmentService.getFinalStep(process)).thenReturn(1);
        doThrow(new AccessDeniedException("当前用户不是该审批节点的已分配处理人"))
                .when(approvalAssignmentService).reserveCurrentAssignment(process, 42L);

        assertThrows(AccessDeniedException.class,
                () -> approvalService.approve(15L, 42L, "APPROVED", "ok"));

        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
        verify(approvalProcessMapper, never()).update(any(ApprovalProcess.class), any());
    }

    @Test
    void rejectedProcessMustFreezeUnprocessedAssignments() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(16L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setApplicantId(7L);
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(approvalAssignmentService.getFinalStep(process)).thenReturn(2);

        ApprovalProcess result = approvalService.approve(16L, 42L, "REJECTED", "不符合条件");

        assertEquals("REJECTED", result.getStatus());
        verify(approvalAssignmentService).freezePendingAssignments(16L);
        verify(workOrderService).applyApprovalOutcome(9L, "REJECTED", "不符合条件");
    }

    @Test
    void retirementApprovalRequiresTheMatchingActionPermission() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(6L);
        process.setTenantId("T001");
        process.setProcessType("RETIREMENT");
        process.setBusinessId(10L);
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        assertThrows(AccessDeniedException.class,
                () -> approvalService.approve(6L, 42L, "APPROVED", "ok"));

        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void directAndUnknownProcessCreationAreRejectedBeforeInsert() {
        ApprovalCreateDTO workOrder = new ApprovalCreateDTO();
        workOrder.setProcessType("WORK_ORDER");
        ApprovalCreateDTO unknown = new ApprovalCreateDTO();
        unknown.setProcessType("CUSTOM_FLOW");

        assertThrows(AccessDeniedException.class, () -> approvalService.createProcess(workOrder));
        assertThrows(AccessDeniedException.class, () -> approvalService.createProcess(unknown));
        verify(approvalProcessMapper, never()).insert(any(ApprovalProcess.class));
    }

    @Test
    void approvalRejectsMissingApplicantOrMismatchedCurrentMember() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(8L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setStatus("PENDING");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        assertThrows(AccessDeniedException.class, () -> approvalService.approve(8L, 42L, "APPROVED", "ok"));

        process.setApplicantId(7L);
        assertThrows(AccessDeniedException.class, () -> approvalService.approve(8L, 43L, "APPROVED", "ok"));
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void cancelledProcessWithoutTrustedAssignmentCannotBeApproved() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(17L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setApplicantId(7L);
        process.setStatus("CANCELLED_REQUIRES_RESUBMISSION");
        process.setCancellationReason("MISSING_TRUSTED_CURRENT_ASSIGNMENT");
        process.setCancelledAt(LocalDateTime.now());
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        assertThrows(com.ams.common.exception.BusinessException.class,
                () -> approvalService.approve(17L, 42L, "APPROVED", "ok"));

        verify(approvalAssignmentService, never()).reserveCurrentAssignment(any(), any());
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
        verify(approvalProcessMapper, never()).update(any(ApprovalProcess.class), any());
    }

    @Test
    void recoveryGuidancePreservesCancellationAuditAndRequiresAControlledResubmission() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(18L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setStatus("CANCELLED_REQUIRES_RESUBMISSION");
        process.setCancellationReason("MISSING_TRUSTED_CURRENT_ASSIGNMENT");
        LocalDateTime cancelledAt = LocalDateTime.now();
        process.setCancelledAt(cancelledAt);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        ApprovalRecoveryDTO recovery = approvalService.getRecoveryGuidance(18L);

        assertEquals(18L, recovery.getProcessId());
        assertEquals("WORK_ORDER", recovery.getProcessType());
        assertEquals("MISSING_TRUSTED_CURRENT_ASSIGNMENT", recovery.getCancellationReason());
        assertEquals(cancelledAt, recovery.getCancelledAt());
        assertEquals("RESUBMIT_EXISTING", recovery.getResubmissionAction());
    }

    @Test
    void listTodoAndCountUseTheSamePermittedProcessTypeScope() {
        approvalService.queryProcesses(1, 10, null, null);
        approvalService.getMyPendingApprovals(42L);
        approvalService.getPendingCount(42L);

        verify(assetDataPermissionEvaluator, times(3)).applyToApprovalProcesses(
                any(QueryWrapper.class), eq(Set.of("WORK_ORDER")));
    }

    private void grant(String... permissions) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "approval-test-user", null, List.of(permissions).stream()
                .map(SimpleGrantedAuthority::new)
                .toList()));
    }
}
