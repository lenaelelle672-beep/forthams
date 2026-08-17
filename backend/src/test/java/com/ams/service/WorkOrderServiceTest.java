package com.ams.service;

import com.ams.entity.ApprovalProcess;
import com.ams.entity.Asset;
import com.ams.entity.WorkOrder;
import com.ams.context.TenantContext;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.WorkOrderMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.doAnswer;

@ExtendWith(MockitoExtension.class)
class WorkOrderServiceTest {

    @BeforeAll
    static void initMybatisPlusTableInfo() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), ApprovalProcess.class);
    }

    @Mock
    private WorkOrderMapper workOrderMapper;

    @Mock
    private ApprovalProcessMapper approvalProcessMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private ApprovalAssignmentService approvalAssignmentService;

    @InjectMocks
    private WorkOrderService workOrderService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        grant("workorder:submit", "workorder:update");
        lenient().when(workOrderMapper.update(any(WorkOrder.class), any())).thenReturn(1);
        lenient().doAnswer(invocation -> {
            ApprovalProcess process = invocation.getArgument(0, ApprovalProcess.class);
            process.setId(44L);
            return 1;
        }).when(approvalProcessMapper).insert(any(ApprovalProcess.class));
        Asset asset = new Asset();
        asset.setId(100L);
        asset.setTenantId("T001");
        lenient().when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldCreatePendingApprovalProcessWhenSubmittingWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(3L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("DRAFT");
        workOrder.setReporterId(7L);
        workOrder.setAssetId(100L);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        WorkOrder result = workOrderService.submitWorkOrder(3L);

        assertEquals("PENDING", result.getStatus());
        verify(workOrderMapper).update(eq(workOrder), any());

        ArgumentCaptor<ApprovalProcess> captor = ArgumentCaptor.forClass(ApprovalProcess.class);
        verify(approvalProcessMapper).insert(captor.capture());
        ApprovalProcess process = captor.getValue();
        assertEquals("WORK_ORDER", process.getProcessType());
        assertEquals(3L, process.getBusinessId());
        assertEquals("PENDING", process.getStatus());
        assertEquals("T001", process.getTenantId());
        assertEquals(7L, process.getApplicantId());
    }

    @Test
    void shouldAllowRejectedWorkOrderToBeSubmittedAgain() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(6L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("REJECTED");
        workOrder.setReporterId(7L);
        workOrder.setAssetId(100L);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        WorkOrder result = workOrderService.submitWorkOrder(6L);

        assertEquals("PENDING", result.getStatus());
        verify(workOrderMapper).update(eq(workOrder), any());
    }

    @Test
    void shouldAllowRecoveryRequiredWorkOrderToBeSubmittedAgain() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(7L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("CANCELLED_REQUIRES_RESUBMISSION");
        workOrder.setReporterId(7L);
        workOrder.setAssetId(100L);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        WorkOrder result = workOrderService.submitWorkOrder(7L);

        assertEquals("PENDING", result.getStatus());
        verify(workOrderMapper).update(eq(workOrder), any());
        verify(approvalAssignmentService).initializeForProcess(any(ApprovalProcess.class), eq("WORK_ORDER"));
    }

    @Test
    void shouldRejectDirectApproveOperationEvenWithApprovePermission() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(1L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("PENDING");
        workOrder.setAssetId(100L);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);
        grant("workorder:approve");

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> workOrderService.operateWorkOrder(1L, "APPROVE", "同意"));
    }

    @Test
    void shouldRejectDirectRejectOperationEvenWithApprovePermission() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(2L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("PENDING");
        workOrder.setAssetId(100L);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);
        grant("workorder:approve");

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> workOrderService.operateWorkOrder(2L, "ReJeCt", "驳回"));
    }

    @Test
    void shouldRejectUpdatingPendingWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(4L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("PENDING");
        workOrder.setAssetId(100L);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        assertThrows(com.ams.common.exception.BusinessException.class,
                () -> workOrderService.updateWorkOrder(4L, new com.ams.dto.WorkOrderDTO()));
    }

    @Test
    void shouldCancelApprovedWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(5L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("APPROVED");
        workOrder.setAssetId(100L);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);
        grant("workorder:cancel");

        WorkOrder result = workOrderService.operateWorkOrder(5L, "cancel", "不再执行");

        assertEquals("CANCELLED", result.getStatus());
        verify(workOrderMapper).update(eq(workOrder), any());
    }

    @Test
    void cancellingPendingWorkOrderMustCancelOnlyPendingProcessAndFreezeNodes() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(8L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("PENDING");
        workOrder.setAssetId(100L);
        ApprovalProcess process = new ApprovalProcess();
        process.setId(44L);
        process.setStatus("PENDING");
        process.setVersion(0);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(process);
        when(approvalProcessMapper.update(any(ApprovalProcess.class), any(LambdaUpdateWrapper.class))).thenReturn(1);
        grant("workorder:cancel");

        WorkOrder result = workOrderService.operateWorkOrder(8L, "cancel", "申请人撤销");

        assertEquals("CANCELLED", result.getStatus());
        verify(approvalAssignmentService).freezePendingAssignments(44L);
        ArgumentCaptor<LambdaQueryWrapper<ApprovalProcess>> queryCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(approvalProcessMapper).selectOne(queryCaptor.capture());
        queryCaptor.getValue().getSqlSegment();
        org.junit.jupiter.api.Assertions.assertTrue(queryCaptor.getValue().getParamNameValuePairs().containsValue("PENDING"));
        org.junit.jupiter.api.Assertions.assertTrue(queryCaptor.getValue().getParamNameValuePairs().containsValue("WORK_ORDER"));
    }

    private void grant(String... permissions) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "work-order-test-user", null, List.of(permissions).stream()
                .map(SimpleGrantedAuthority::new)
                .toList()));
    }
}
