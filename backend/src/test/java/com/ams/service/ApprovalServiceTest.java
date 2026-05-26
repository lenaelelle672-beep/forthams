package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.dto.AssetClearanceDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.entity.AssetCompensation;
import com.ams.entity.WorkflowDefinition;
import com.ams.context.TenantContext;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
    private DisposalService disposalService;

    @Mock
    private CompensationService compensationService;

    @Mock
    private WorkflowDefinitionService workflowDefinitionService;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private RoleMapper roleMapper;

    @Mock
    private NotificationService notificationService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private ApprovalService approvalService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        approvalService = new ApprovalService(
                approvalProcessMapper,
                approvalRecordMapper,
                retirementApplicationService,
                workOrderService,
                disposalService,
                compensationService,
                workflowDefinitionService,
                userRoleMapper,
                roleMapper,
                objectMapper,
                notificationService);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldCompleteWorkOrderApprovalInOneStepAndUpdateWorkOrder() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(5L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("APPROVED", result.getStatus());
        var recordCaptor = forClass(ApprovalRecord.class);
        verify(approvalRecordMapper).insert(recordCaptor.capture());
        assertEquals("T001", recordCaptor.getValue().getTenantId());
        verify(approvalProcessMapper).updateById(process);
        verify(workOrderService).applyApprovalOutcome(9L, "APPROVED", "ok");
    }

    @Test
    void shouldBindWorkflowSnapshotWhenCreatingManagedProcess() throws Exception {
        WorkflowDefinition definition = workflowDefinition("ASSET_TRANSFER");
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER")).thenReturn(definition);
        when(approvalProcessMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);
        ApprovalCreateDTO dto = new ApprovalCreateDTO();
        dto.setProcessType("ASSET_TRANSFER");
        dto.setBusinessType("ASSET_TRANSFER");
        dto.setBusinessId(12L);
        dto.setBusinessData("{\"assetId\":12,\"amount\":6000}");

        approvalService.createProcess(dto);

        var processCaptor = forClass(ApprovalProcess.class);
        verify(approvalProcessMapper).insert(processCaptor.capture());
        Map<String, Object> businessData = objectMapper.readValue(processCaptor.getValue().getBusinessData(), new TypeReference<>() {});
        assertEquals(12L, ((Number) ((Map<?, ?>) businessData.get("_approvalPayload")).get("assetId")).longValue());
        assertEquals(7L, ((Number) businessData.get("_workflowDefinitionId")).longValue());
        assertEquals(3, ((Number) businessData.get("_workflowVersion")).intValue());
        assertEquals("ASSET_TRANSFER", ((Map<?, ?>) businessData.get("_workflowDefinition")).get("businessType"));
    }

    @Test
    void shouldRejectManagedProcessCreationWhenWorkflowIsNotPublished() {
        ApprovalCreateDTO dto = new ApprovalCreateDTO();
        dto.setProcessType("ASSET_TRANSFER");
        dto.setBusinessId(12L);
        dto.setBusinessData("{\"assetId\":12}");
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER"))
                .thenThrow(new BusinessException("请先发布对应业务流程后再提交审批"));

        BusinessException exception = assertThrows(BusinessException.class, () -> approvalService.createProcess(dto));

        assertEquals("请先发布对应业务流程后再提交审批", exception.getMessage());
        verify(approvalProcessMapper, never()).insert(any(ApprovalProcess.class));
    }

    @Test
    void shouldApproveManagedProcessUsingWorkflowSnapshot() throws Exception {
        ApprovalProcess process = workflowProcess(5L, 1, objectMapper.writeValueAsString(Map.of(
                "_approvalPayload", Map.of("assetId", 12, "amount", 6000),
                "_workflowDefinitionId", 7,
                "_workflowVersion", 3,
                "_workflowDefinition", Map.of("businessType", "ASSET_TRANSFER")
        )));
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requireRuntimePlan(anyString(), anyString())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN")).thenReturn(List.of(42L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("APPROVED", result.getStatus());
        verify(workflowDefinitionService).requireRuntimePlan(anyString(), anyString());
        verify(workflowDefinitionService, never()).requirePublishedRuntimePlan(anyString(), anyString());
    }

    @Test
    void shouldReturnResolvedWorkflowRuntimePathWhenGettingProcessDetail() throws Exception {
        ApprovalProcess process = workflowProcess(5L, 1, objectMapper.writeValueAsString(Map.of(
                "_approvalPayload", Map.of("assetId", 12, "amount", 6000),
                "_workflowDefinitionId", 7,
                "_workflowVersion", 3,
                "_workflowDefinition", Map.of("businessType", "ASSET_TRANSFER")
        )));
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence"),
                workflowUserNode(2, "approval-2", 88L, "all")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());
        when(workflowDefinitionService.requireRuntimePlan(anyString(), anyString())).thenReturn(plan);

        Map<String, Object> detail = approvalService.getProcessById(5L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> runtimePath = (List<Map<String, Object>>) detail.get("workflowRuntimePath");
        assertEquals(2, runtimePath.size());
        assertEquals(1, runtimePath.get(0).get("stepNo"));
        assertEquals("approval-1", runtimePath.get(0).get("nodeId"));
        assertEquals("SUPER_ADMIN", runtimePath.get(0).get("approverRole"));
        assertEquals("role", runtimePath.get(0).get("approverType"));
        assertEquals("approval-2", runtimePath.get(1).get("nodeId"));
        assertEquals("user", runtimePath.get(1).get("approverType"));
        assertEquals("88", runtimePath.get(1).get("approverId"));
        assertEquals("审批完成并归档", detail.get("workflowResultAction"));
        verify(workflowDefinitionService).requireRuntimePlan(anyString(), anyString());
        verify(workflowDefinitionService, never()).requirePublishedRuntimePlan(anyString(), anyString());
    }

    @Test
    void shouldRejectMismatchedBusinessTypeWhenCreatingManagedProcess() {
        ApprovalCreateDTO dto = new ApprovalCreateDTO();
        dto.setProcessType("ASSET_TRANSFER");
        dto.setBusinessType("ASSET_SCRAP");

        BusinessException exception = assertThrows(BusinessException.class, () -> approvalService.createProcess(dto));

        assertEquals("业务流程类型与审批流程类型不一致", exception.getMessage());
        verify(approvalProcessMapper, never()).insert(any(ApprovalProcess.class));
    }

    @Test
    void shouldAdvanceWorkflowApprovalByRuntimePathAndRole() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"amount\":6000,\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence"),
                workflowNode(2, "approval-2", "USER", "any")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN")).thenReturn(List.of(42L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("PENDING", result.getStatus());
        assertEquals(2, result.getCurrentStep());
        var recordCaptor = forClass(ApprovalRecord.class);
        verify(approvalRecordMapper).insert(recordCaptor.capture());
        assertEquals(1, recordCaptor.getValue().getStepNo());
        assertEquals(42L, recordCaptor.getValue().getApproverId());
        verify(approvalProcessMapper).updateById(process);
    }

    @Test
    void shouldRejectWorkflowApprovalWhenApproverIsOutsideResolvedRole() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN")).thenReturn(List.of(99L));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 42L, "APPROVED", "ok"));

        assertEquals("当前用户不属于节点审批角色", exception.getMessage());
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void shouldRejectWorkflowApprovalWhenApproverIsNotSpecifiedUser() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowUserNode(1, "approval-1", 99L, "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 42L, "APPROVED", "ok"));

        assertEquals("当前用户不是节点指定审批人", exception.getMessage());
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void shouldCompleteUserApproverAllModeWorkflowStep() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowUserNode(1, "approval-1", 42L, "all")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("APPROVED", result.getStatus());
        verify(approvalProcessMapper).updateById(process);
    }

    @Test
    void shouldRejectWorkflowApprovalWhenConfiguredRoleHasNoApprovers() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "流程审批人", "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("流程审批人")).thenReturn(List.of());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 42L, "APPROVED", "ok"));

        assertEquals("审批角色未配置审批人", exception.getMessage());
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void shouldKeepAllModeWorkflowStepPendingUntilEveryResolvedApproverApproved() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "USER", "all")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("USER")).thenReturn(List.of(42L, 99L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("PENDING", result.getStatus());
        assertEquals(1, result.getCurrentStep());
        verify(approvalProcessMapper).updateById(process);
    }

    @Test
    void shouldCompleteAllModeWorkflowStepAfterEveryResolvedApproverApproved() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        ApprovalRecord firstApproval = new ApprovalRecord();
        firstApproval.setProcessId(5L);
        firstApproval.setTenantId("T001");
        firstApproval.setStepNo(1);
        firstApproval.setApproverId(42L);
        firstApproval.setApproveResult("APPROVED");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "USER", "all")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("USER")).thenReturn(List.of(42L, 99L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(firstApproval));

        ApprovalProcess result = approvalService.approve(5L, 99L, "APPROVED", "ok");

        assertEquals("APPROVED", result.getStatus());
        assertEquals(1, result.getCurrentStep());
        verify(approvalProcessMapper).updateById(process);
    }

    @Test
    void shouldKeepWorkflowPendingVisibleWhenUserOnlyApprovedPreviousStep() {
        ApprovalProcess process = workflowProcess(5L, 2, "{\"assetId\":1}");
        ApprovalRecord previousStepApproval = new ApprovalRecord();
        previousStepApproval.setProcessId(5L);
        previousStepApproval.setTenantId("T001");
        previousStepApproval.setStepNo(1);
        previousStepApproval.setApproverId(42L);
        previousStepApproval.setApproveResult("APPROVED");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence"),
                workflowNode(2, "approval-2", "USER", "any")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(process));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(previousStepApproval));
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("USER")).thenReturn(List.of(42L));

        List<ApprovalProcess> pending = approvalService.getMyPendingApprovals(42L);

        assertEquals(1, pending.size());
        assertEquals(5L, pending.get(0).getId());
    }

    @Test
    void shouldHideSpecificUserWorkflowPendingFromOtherUsers() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowUserNode(1, "approval-1", 99L, "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(process));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);

        List<ApprovalProcess> pending = approvalService.getMyPendingApprovals(42L);

        assertEquals(0, pending.size());
    }

    @Test
    void shouldExecuteTransferBusinessOutcomeOnlyAfterFinalWorkflowApproval() {
        ApprovalProcess process = workflowProcess(5L, 1, "ASSET_TRANSFER", "{\"assetId\":12,\"targetDeptId\":3,\"reason\":\"move\"}");
        stubFinalWorkflowPlan(process);

        approvalService.approve(5L, 42L, "APPROVED", "ok");

        verify(disposalService).transferAsset(any());
    }

    @Test
    void shouldExecuteClearanceBusinessOutcomeOnlyAfterFinalWorkflowApproval() {
        ApprovalProcess process = workflowProcess(5L, 1, "ASSET_CLEARANCE",
                "{\"assetId\":12,\"assetName\":\"闲置笔记本\",\"storageLocation\":\"A库房\",\"reason\":\"clear\"}");
        stubFinalWorkflowPlan(process);

        approvalService.approve(5L, 42L, "APPROVED", "ok");

        var dtoCaptor = forClass(AssetClearanceDTO.class);
        verify(disposalService).clearAsset(dtoCaptor.capture());
        assertEquals(12L, dtoCaptor.getValue().getAssetId());
        assertEquals("clear", dtoCaptor.getValue().getReason());
    }

    @Test
    void shouldExecuteScrapBusinessOutcomeOnlyAfterFinalWorkflowApproval() {
        ApprovalProcess process = workflowProcess(5L, 1, "ASSET_SCRAP", "{\"assetId\":12,\"reason\":\"scrap\"}");
        stubFinalWorkflowPlan(process);

        approvalService.approve(5L, 42L, "APPROVED", "ok");

        verify(disposalService).scrapAsset(any());
    }

    @Test
    void shouldExecuteCompensationBusinessOutcomeOnlyAfterFinalWorkflowApproval() {
        ApprovalProcess process = workflowProcess(5L, 1, "ASSET_COMPENSATION", "{\"assetId\":12,\"responsibleUserId\":42}");
        AssetCompensation compensation = new AssetCompensation();
        compensation.setId(88L);
        when(compensationService.createCompensation(any())).thenReturn(compensation);
        stubFinalWorkflowPlan(process);

        approvalService.approve(5L, 42L, "APPROVED", "ok");

        verify(compensationService).createCompensation(any());
        verify(compensationService).updateStatus(88L, "APPROVED");
    }

    @Test
    void shouldRejectDuplicateApprovalWhenProcessAlreadyApproved() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(5L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setStatus("APPROVED");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 42L, "APPROVED", "ok"));

        assertEquals("审批流程已通过，不可重复审批", exception.getMessage());
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void shouldRejectApprovalWhenProcessAlreadyRejected() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(5L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setStatus("REJECTED");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 42L, "APPROVED", "ok"));

        assertEquals("审批流程已驳回，不可再次审批", exception.getMessage());
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void shouldRejectApprovalWhenProcessCancelled() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(5L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setStatus("CANCELLED");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 42L, "APPROVED", "ok"));

        assertEquals("审批流程已取消，不可审批", exception.getMessage());
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void shouldRejectWorkflowApprovalWhenApproverAlreadyApprovedCurrentStep() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"amount\":6000,\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN")).thenReturn(List.of(42L));
        ApprovalRecord existingRecord = new ApprovalRecord();
        existingRecord.setProcessId(5L);
        existingRecord.setApproverId(42L);
        existingRecord.setStepNo(1);
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(existingRecord));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 42L, "APPROVED", "ok"));

        assertEquals("当前步骤已审批", exception.getMessage());
    }

    @Test
    void shouldCancelPendingProcess() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(5L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        ApprovalProcess result = approvalService.cancelProcess(5L, 42L);

        assertEquals("CANCELLED", result.getStatus());
        verify(approvalProcessMapper).updateById(process);
        verify(workOrderService).applyApprovalOutcome(9L, "REJECTED", "流程已取消");
    }

    @Test
    void shouldRejectCancellationWhenProcessNotPending() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(5L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setStatus("APPROVED");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.cancelProcess(5L, 42L));

        assertEquals("仅PENDING状态的流程可取消", exception.getMessage());
        verify(approvalProcessMapper, never()).updateById(any(ApprovalProcess.class));
    }

    @Test
    void shouldRejectCancellationWhenProcessNotFound() {
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.cancelProcess(99L, 42L));

        assertEquals("审批流程不存在", exception.getMessage());
    }

    @Test
    void shouldFollowHighAmountBranchWithTwoApprovalSteps() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"amount\":6000,\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "部门负责人", "sequence"),
                workflowNode(2, "approval-2", "财务经理", "all")
        ), "归档并同步到审批列表");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("部门负责人")).thenReturn(List.of(42L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("PENDING", result.getStatus());
        assertEquals(2, result.getCurrentStep());
    }

    @Test
    void shouldCompleteImmediatelyOnLowAmountBranchWithSingleApprovalStep() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"amount\":100,\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "部门负责人", "sequence")
        ), "归档并同步到审批列表");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("部门负责人")).thenReturn(List.of(42L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("APPROVED", result.getStatus());
    }

    @Test
    void shouldCompleteAnyModeWorkflowStepWhenFirstApproverApproves() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "USER", "any")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("USER")).thenReturn(List.of(42L, 99L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("APPROVED", result.getStatus());
    }

    @Test
    void shouldAdvanceThroughRoleThenUserApprovalSteps() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence"),
                workflowUserNode(2, "approval-2", 88L, "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN")).thenReturn(List.of(42L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("PENDING", result.getStatus());
        assertEquals(2, result.getCurrentStep());
    }

    @Test
    void shouldRejectCrossStepApprovalWhenUserBelongsToDifferentStep() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowUserNode(1, "approval-1", 42L, "sequence"),
                workflowUserNode(2, "approval-2", 99L, "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 99L, "APPROVED", "ok"));

        assertEquals("当前用户不是节点指定审批人", exception.getMessage());
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void shouldRejectCrossStepRoleApprovalWhenUserNotInCurrentStepRole() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "部门负责人", "sequence"),
                workflowNode(2, "approval-2", "财务经理", "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("部门负责人")).thenReturn(List.of(42L));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 99L, "APPROVED", "越权"));

        assertEquals("当前用户不属于节点审批角色", exception.getMessage());
        verify(approvalRecordMapper, never()).insert(any(ApprovalRecord.class));
    }

    @Test
    void shouldNotExecuteTransferWhenWorkflowIsRejectedAtFirstStep() {
        ApprovalProcess process = workflowProcess(5L, 1, "ASSET_TRANSFER", "{\"assetId\":12,\"targetDeptId\":3,\"reason\":\"move\"}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN")).thenReturn(List.of(42L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "REJECTED", "金额不对");

        assertEquals("REJECTED", result.getStatus());
        verify(disposalService, never()).transferAsset(any());
    }

    @Test
    void shouldNotExecuteTransferWhenWorkflowIsRejectedAtIntermediateStep() {
        ApprovalProcess process = workflowProcess(5L, 2, "ASSET_TRANSFER", "{\"assetId\":12,\"targetDeptId\":3}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence"),
                workflowNode(2, "approval-2", "USER", "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("USER")).thenReturn(List.of(42L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "REJECTED", "不同意");

        assertEquals("REJECTED", result.getStatus());
        verify(disposalService, never()).transferAsset(any());
    }

    @Test
    void shouldUseWorkflowSnapshotEvenWhenPublishedDefinitionChanged() throws Exception {
        ApprovalProcess process = workflowProcess(5L, 1, objectMapper.writeValueAsString(Map.of(
                "_approvalPayload", Map.of("assetId", 12, "amount", 6000),
                "_workflowDefinitionId", 7,
                "_workflowVersion", 1,
                "_workflowDefinition", Map.of("businessType", "ASSET_TRANSFER", "nodes", "v1-snapshot")
        )));
        WorkflowDefinitionService.WorkflowRuntimePlan snapshotPlan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "SUPER_ADMIN", "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requireRuntimePlan(anyString(), anyString())).thenReturn(snapshotPlan);
        when(userRoleMapper.selectActiveUserIdsByRole("SUPER_ADMIN")).thenReturn(List.of(42L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("APPROVED", result.getStatus());
        verify(workflowDefinitionService).requireRuntimePlan(anyString(), anyString());
        verify(workflowDefinitionService, never()).requirePublishedRuntimePlan(anyString(), anyString());
    }

    @Test
    void shouldRejectDuplicateApprovalInAllModeWhenUserAlreadyApproved() {
        ApprovalProcess process = workflowProcess(5L, 1, "{\"assetId\":1}");
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "USER", "all")
        ), "审批完成并归档");
        ApprovalRecord existingRecord = new ApprovalRecord();
        existingRecord.setProcessId(5L);
        existingRecord.setApproverId(42L);
        existingRecord.setStepNo(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan("ASSET_TRANSFER", process.getBusinessData())).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("USER")).thenReturn(List.of(42L, 99L));
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(existingRecord));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> approvalService.approve(5L, 42L, "APPROVED", "ok"));

        assertEquals("当前步骤已审批", exception.getMessage());
    }

    private ApprovalProcess workflowProcess(Long id, Integer currentStep, String businessData) {
        return workflowProcess(id, currentStep, "ASSET_TRANSFER", businessData);
    }

    private ApprovalProcess workflowProcess(Long id, Integer currentStep, String processType, String businessData) {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(id);
        process.setTenantId("T001");
        process.setProcessType(processType);
        process.setBusinessId(12L);
        process.setBusinessData(businessData);
        process.setStatus("PENDING");
        process.setCurrentStep(currentStep);
        return process;
    }

    private void stubFinalWorkflowPlan(ApprovalProcess process) {
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(
                workflowNode(1, "approval-1", "", "sequence")
        ), "审批完成并归档");
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);
        when(workflowDefinitionService.requirePublishedRuntimePlan(process.getProcessType(), process.getBusinessData())).thenReturn(plan);
        when(approvalRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());
    }

    private WorkflowDefinition workflowDefinition(String businessType) throws Exception {
        WorkflowDefinition definition = new WorkflowDefinition();
        definition.setId(7L);
        definition.setVersion(3);
        definition.setBusinessType(businessType);
        definition.setDefinitionJson(objectMapper.writeValueAsString(Map.of(
                "id", "WF-" + businessType,
                "name", "测试流程",
                "description", "测试流程定义",
                "businessType", businessType,
                "nodes", List.of(Map.of(
                        "id", "start-1",
                        "type", "start",
                        "data", Map.of("type", "start")
                )),
                "edges", List.of()
        )));
        return definition;
    }

    private WorkflowDefinitionService.WorkflowApprovalNode workflowNode(int stepNo, String nodeId, String approverRole, String approvalMode) {
        return new WorkflowDefinitionService.WorkflowApprovalNode(stepNo, nodeId, nodeId.toUpperCase(), "审批节点", approverRole, approvalMode, "role", null);
    }

    private WorkflowDefinitionService.WorkflowApprovalNode workflowUserNode(int stepNo, String nodeId, Long approverId, String approvalMode) {
        return new WorkflowDefinitionService.WorkflowApprovalNode(stepNo, nodeId, nodeId.toUpperCase(), "审批节点", "", approvalMode, "user", String.valueOf(approverId));
    }
}
