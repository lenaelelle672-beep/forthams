package com.ams.service;

import com.ams.dto.RetirementApplyDTO;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Asset;
import com.ams.entity.RetirementApplication;
import com.ams.entity.User;
import com.ams.enums.AssetStatus;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetCompensationMapper;
import com.ams.mapper.DisposalApplicationMapper;
import com.ams.mapper.RetirementApplicationMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RetirementApplicationServiceTest {

    @Mock
    private RetirementApplicationMapper retirementApplicationMapper;

    @Mock
    private ApprovalProcessMapper approvalProcessMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private AssetCompensationMapper assetCompensationMapper;

    @Mock
    private DisposalApplicationMapper disposalApplicationMapper;

    @Mock
    private AssetLifecycleService assetLifecycleService;

    @Mock
    private AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private ApprovalAssignmentService approvalAssignmentService;

    @InjectMocks
    private RetirementApplicationService retirementApplicationService;

    @BeforeAll
    static void initMybatisPlusTableInfo() {
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, RetirementApplication.class);
        TableInfoHelper.initTableInfo(assistant, Asset.class);
        TableInfoHelper.initTableInfo(assistant, ApprovalProcess.class);
    }

    @BeforeEach
    void setUp() {
        User currentUser = new User();
        currentUser.setId(7L);
        currentUser.setTenantId("T001");
        lenient().when(tenantAuthorityService.requireCurrentTenantMember()).thenReturn(currentUser);
        lenient().when(retirementApplicationMapper.update(any(RetirementApplication.class), any())).thenReturn(1);
        lenient().when(approvalProcessMapper.update(any(ApprovalProcess.class), any())).thenReturn(1);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldDeserializeSnakeCaseRetirementPayload() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();

        RetirementApplyDTO dto = objectMapper.readValue("""
                {
                  "asset_id": 12,
                  "reason": "达到报废年限",
                  "estimated_residual_value": 88.50,
                  "retirement_type": "SCRAP"
                }
                """, RetirementApplyDTO.class);

        assertEquals(12L, dto.getAssetId());
        assertEquals("达到报废年限", dto.getReason());
        assertEquals(new BigDecimal("88.50"), dto.getEstimatedResidualValue());
        assertEquals(RetirementApplication.RetirementType.SCRAP, dto.getRetirementType());
    }

    @Test
    void shouldSetProcessNoWhenSubmittingApplication() {
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        asset.setAssetNo("A-001");
        asset.setAssetName("测试资产");
        asset.setStatus("IN_USE");
        TenantContext.setTenantId("T001");

        RetirementApplyDTO dto = new RetirementApplyDTO();
        dto.setAssetId(12L);
        dto.setReason("达到报废年限");
        dto.setRetirementType(RetirementApplication.RetirementType.SCRAP);

        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        doAnswer(invocation -> {
            invocation.getArgument(0, com.ams.entity.RetirementApplication.class).setId(99L);
            return 1;
        }).when(retirementApplicationMapper).insert(any(com.ams.entity.RetirementApplication.class));
        doAnswer(invocation -> {
            invocation.getArgument(0, ApprovalProcess.class).setId(100L);
            return 1;
        }).when(approvalProcessMapper).insert(any(ApprovalProcess.class));

        retirementApplicationService.submitApplication(dto, 7L);

        ArgumentCaptor<RetirementApplication> applicationCaptor = ArgumentCaptor.forClass(RetirementApplication.class);
        verify(retirementApplicationMapper).insert(applicationCaptor.capture());
        assertEquals("T001", applicationCaptor.getValue().getTenantId());

        ArgumentCaptor<LambdaQueryWrapper<RetirementApplication>> applicationNoWrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(retirementApplicationMapper).selectCount(applicationNoWrapperCaptor.capture());
        LambdaQueryWrapper<RetirementApplication> applicationNoWrapper = applicationNoWrapperCaptor.getValue();
        assertTrue(applicationNoWrapper.getSqlSegment().contains("tenant_id"));
        assertTrue(applicationNoWrapper.getParamNameValuePairs().containsValue("T001"));

        ArgumentCaptor<ApprovalProcess> captor = ArgumentCaptor.forClass(ApprovalProcess.class);
        verify(approvalProcessMapper).insert(captor.capture());

        ApprovalProcess process = captor.getValue();
        assertNotNull(process.getProcessNo());
        assertTrue(process.getProcessNo().startsWith("APR-"));
        assertEquals("RETIREMENT", process.getProcessType());
        assertEquals(99L, process.getBusinessId());
        verify(assetLifecycleService).transitionLoadedAsset(
                eq(asset),
                eq(AssetStatus.PENDING_RETIREMENT),
                eq("RETIREMENT_SUBMIT"),
                eq("达到报废年限"),
                eq(7L),
                isNull());
    }

    @Test
    void submittedRetirementMustUseFrozenNodeCountForTotalApprovalSteps() {
        Asset asset = asset(12L);
        TenantContext.setTenantId("T001");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        doAnswer(invocation -> {
            invocation.getArgument(0, RetirementApplication.class).setId(99L);
            return 1;
        }).when(retirementApplicationMapper).insert(any(RetirementApplication.class));
        doAnswer(invocation -> {
            invocation.getArgument(0, ApprovalProcess.class).setId(100L);
            return 1;
        }).when(approvalProcessMapper).insert(any(ApprovalProcess.class));
        when(approvalAssignmentService.getFinalStep(any(ApprovalProcess.class))).thenReturn(3);

        RetirementApplication result = retirementApplicationService.submitApplication(applyDto(12L, "多级审批"), 7L);

        assertEquals(3, result.getTotalApprovalSteps());
        assertEquals(1, result.getCurrentApprovalStep());
        ArgumentCaptor<RetirementApplication> updateCaptor = ArgumentCaptor.forClass(RetirementApplication.class);
        verify(retirementApplicationMapper).update(updateCaptor.capture(), any(LambdaUpdateWrapper.class));
        assertEquals(3, updateCaptor.getValue().getTotalApprovalSteps());
    }

    @Test
    void shouldRejectRetirementWhenTheAssetHasAPendingDisposal() {
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        asset.setAssetNo("A-001");
        asset.setAssetName("测试资产");
        TenantContext.setTenantId("T001");
        RetirementApplyDTO dto = new RetirementApplyDTO();
        dto.setAssetId(12L);
        dto.setReason("达到报废年限");
        dto.setRetirementType(RetirementApplication.RetirementType.SCRAP);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(retirementApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(disposalApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> retirementApplicationService.submitApplication(dto, 7L));

        assertEquals("该资产已有进行中的处置申请", exception.getMessage());
        verify(retirementApplicationMapper, org.mockito.Mockito.never()).insert(any(RetirementApplication.class));
    }

    @Test
    void shouldRejectRetirementWhenTheAssetHasAPendingCompensation() {
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        asset.setAssetNo("A-001");
        asset.setAssetName("测试资产");
        TenantContext.setTenantId("T001");
        RetirementApplyDTO dto = new RetirementApplyDTO();
        dto.setAssetId(12L);
        dto.setReason("存在待审批赔偿");
        dto.setRetirementType(RetirementApplication.RetirementType.SCRAP);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(retirementApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(disposalApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(assetCompensationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> retirementApplicationService.submitApplication(dto, 7L));

        assertEquals("该资产已有进行中的赔偿申请", exception.getMessage());
        verify(retirementApplicationMapper, never()).insert(any(RetirementApplication.class));
    }

    @Test
    void shouldUseOriginalAssetIdInRetirementUpdateCondition() {
        TenantContext.setTenantId("T001");
        RetirementApplication application = new RetirementApplication();
        application.setId(99L);
        application.setTenantId("T001");
        application.setAssetId(12L);
        application.setApplicantId(7L);
        application.setStatus("DRAFT");
        application.setVersion(0);
        Asset originalAsset = new Asset();
        originalAsset.setId(12L);
        originalAsset.setTenantId("T001");
        Asset replacementAsset = new Asset();
        replacementAsset.setId(13L);
        replacementAsset.setTenantId("T001");
        RetirementApplyDTO dto = new RetirementApplyDTO();
        dto.setAssetId(13L);
        dto.setReason("更新资产");
        dto.setRetirementType(RetirementApplication.RetirementType.SCRAP);
        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(originalAsset, replacementAsset);

        retirementApplicationService.updateApplication(99L, dto);

        ArgumentCaptor<LambdaUpdateWrapper<RetirementApplication>> wrapperCaptor = ArgumentCaptor.forClass(LambdaUpdateWrapper.class);
        verify(retirementApplicationMapper).update(org.mockito.ArgumentMatchers.eq(application), wrapperCaptor.capture());
        wrapperCaptor.getValue().getSqlSegment();
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(12L));
        assertFalse(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(13L));
        ArgumentCaptor<LambdaQueryWrapper<Asset>> assetWrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(assetMapper, times(2)).selectOne(assetWrapperCaptor.capture());
        LambdaQueryWrapper<Asset> lockedReplacement = assetWrapperCaptor.getAllValues().get(1);
        assertTrue(lockedReplacement.getSqlSegment().contains("FOR UPDATE"));
        assertTrue(lockedReplacement.getParamNameValuePairs().containsValue(13L));
        assertTrue(lockedReplacement.getParamNameValuePairs().containsValue("T001"));
    }

    @Test
    void shouldRejectReplacementWhenLockedTargetAssetIsNoLongerEligible() {
        TenantContext.setTenantId("T001");
        RetirementApplication application = draftApplication(12L);
        Asset originalAsset = asset(12L);
        Asset replacementAsset = asset(13L);
        replacementAsset.setStatus("SCRAPPED");
        RetirementApplyDTO dto = applyDto(13L, "更新资产");
        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(originalAsset, replacementAsset);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> retirementApplicationService.updateApplication(99L, dto));

        assertEquals("待退役或终态资产不能创建或修改退役申请", exception.getMessage());
        verify(assetDataPermissionEvaluator).assertCanAccess(replacementAsset);
        verify(retirementApplicationMapper, never()).update(any(RetirementApplication.class), any());
    }

    @Test
    void shouldRejectReplacementWhenFinalTargetScopeRevalidationFails() {
        TenantContext.setTenantId("T001");
        RetirementApplication application = draftApplication(12L);
        Asset originalAsset = asset(12L);
        Asset replacementAsset = asset(13L);
        RetirementApplyDTO dto = applyDto(13L, "更新资产");
        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(originalAsset, replacementAsset);
        doAnswer(invocation -> {
            if (invocation.getArgument(0) == replacementAsset) {
                throw new org.springframework.security.access.AccessDeniedException("资产数据权限拒绝：资产不在当前角色的数据范围内");
            }
            return null;
        }).when(assetDataPermissionEvaluator).assertCanAccess(any(Asset.class));

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> retirementApplicationService.updateApplication(99L, dto));

        verify(retirementApplicationMapper, never()).update(any(RetirementApplication.class), any());
    }

    @Test
    void shouldFailFinalRetirementWriteWhenConcurrentChangeWinsAfterTargetLock() {
        TenantContext.setTenantId("T001");
        RetirementApplication application = draftApplication(12L);
        Asset originalAsset = asset(12L);
        Asset replacementAsset = asset(13L);
        RetirementApplyDTO dto = applyDto(13L, "更新资产");
        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(originalAsset, replacementAsset);
        when(retirementApplicationMapper.update(any(RetirementApplication.class), any())).thenReturn(0);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> retirementApplicationService.updateApplication(99L, dto));

        assertEquals("退役申请已变更，请刷新后重试", exception.getMessage());
        InOrder inOrder = inOrder(assetMapper, assetDataPermissionEvaluator, retirementApplicationMapper);
        inOrder.verify(assetMapper).selectOne(any(LambdaQueryWrapper.class));
        inOrder.verify(assetDataPermissionEvaluator).assertCanAccess(originalAsset);
        inOrder.verify(assetMapper).selectOne(any(LambdaQueryWrapper.class));
        inOrder.verify(assetDataPermissionEvaluator).assertCanAccess(replacementAsset);
        inOrder.verify(retirementApplicationMapper).update(any(RetirementApplication.class), any());
    }

    @Test
    void shouldCancelPendingApplicationAndRollbackAssetStatus() {
        RetirementApplication application = new RetirementApplication();
        application.setId(99L);
        application.setTenantId("T001");
        application.setAssetId(12L);
        application.setApplicantId(7L);
        application.setStatus("PENDING");
        application.setReason("达到报废年限");
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        TenantContext.setTenantId("T001");

        ApprovalProcess approvalProcess = new ApprovalProcess();
        approvalProcess.setId(88L);
        approvalProcess.setStatus("PENDING");

        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(approvalProcess);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);

        retirementApplicationService.cancelApplication(99L, 7L);

        ArgumentCaptor<RetirementApplication> applicationCaptor = ArgumentCaptor.forClass(RetirementApplication.class);
        verify(retirementApplicationMapper).update(applicationCaptor.capture(), any());
        assertEquals("CANCELLED", applicationCaptor.getValue().getStatus());
        verify(assetDataPermissionEvaluator).assertCanAccess(asset);

        ArgumentCaptor<ApprovalProcess> processCaptor = ArgumentCaptor.forClass(ApprovalProcess.class);
        verify(approvalProcessMapper).update(processCaptor.capture(), any());
        assertEquals("CANCELLED", processCaptor.getValue().getStatus());
        verify(approvalAssignmentService).freezePendingAssignments(88L);

        verify(assetLifecycleService).rollbackRetirementStatus(
                eq(12L),
                eq("RETIREMENT_CANCELLED"),
                eq("达到报废年限"),
                eq(7L));
    }

    @Test
    void rejectedResubmissionThenCancelMustTargetNewPendingProcessAndFreezeNodes() {
        TenantContext.setTenantId("T001");
        RetirementApplication application = draftApplication(12L);
        application.setStatus("REJECTED");
        application.setReason("重新提交后撤销");
        Asset asset = asset(12L);
        ApprovalProcess pendingProcess = new ApprovalProcess();
        pendingProcess.setId(101L);
        pendingProcess.setTenantId("T001");
        pendingProcess.setStatus("PENDING");
        pendingProcess.setVersion(0);
        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(retirementApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(disposalApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null, pendingProcess);
        doAnswer(invocation -> {
            invocation.getArgument(0, ApprovalProcess.class).setId(101L);
            return 1;
        }).when(approvalProcessMapper).insert(any(ApprovalProcess.class));
        when(approvalAssignmentService.getFinalStep(any(ApprovalProcess.class))).thenReturn(2);

        retirementApplicationService.submitExistingApplication(99L, 7L);
        retirementApplicationService.cancelApplication(99L, 7L);

        assertEquals("CANCELLED", application.getStatus());
        ArgumentCaptor<LambdaQueryWrapper<ApprovalProcess>> queryCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(approvalProcessMapper, times(2)).selectOne(queryCaptor.capture());
        queryCaptor.getAllValues().forEach(query -> {
            query.getSqlSegment();
            assertTrue(query.getParamNameValuePairs().containsValue("RETIREMENT"));
            assertTrue(query.getParamNameValuePairs().containsValue("PENDING"));
        });
        assertTrue(queryCaptor.getAllValues().get(1).getSqlSegment().contains("FOR UPDATE"));
        verify(approvalAssignmentService).freezePendingAssignments(101L);
    }

    @Test
    void recoveryRequiredRetirementResubmissionMustRollbackAssetBeforeCreatingNewSnapshot() {
        TenantContext.setTenantId("T001");
        RetirementApplication application = draftApplication(12L);
        application.setStatus("CANCELLED_REQUIRES_RESUBMISSION");
        application.setReason("历史流程缺少可信处理人");
        Asset asset = asset(12L);
        asset.setStatus(AssetStatus.PENDING_RETIREMENT.name());
        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(retirementApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(disposalApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        doAnswer(invocation -> {
            invocation.getArgument(0, ApprovalProcess.class).setId(101L);
            return 1;
        }).when(approvalProcessMapper).insert(any(ApprovalProcess.class));
        doAnswer(invocation -> {
            asset.setStatus(AssetStatus.IN_USE.name());
            return asset;
        }).when(assetLifecycleService).rollbackRetirementStatus(
                eq(12L), eq("RETIREMENT_REQUIRES_RESUBMISSION"), eq("历史流程缺少可信处理人"), eq(7L));

        RetirementApplication result = retirementApplicationService.submitExistingApplication(99L, 7L);

        assertEquals("PENDING", result.getStatus());
        verify(assetLifecycleService).rollbackRetirementStatus(
                12L, "RETIREMENT_REQUIRES_RESUBMISSION", "历史流程缺少可信处理人", 7L);
        verify(approvalAssignmentService).initializeForProcess(any(ApprovalProcess.class), eq("RETIREMENT"));
    }

    @Test
    void cancelMustFailAtomicallyWhenPendingProcessCasLosesRace() {
        TenantContext.setTenantId("T001");
        RetirementApplication application = draftApplication(12L);
        application.setStatus("PENDING");
        application.setReason("并发撤销");
        Asset asset = asset(12L);
        ApprovalProcess pendingProcess = new ApprovalProcess();
        pendingProcess.setId(88L);
        pendingProcess.setStatus("PENDING");
        pendingProcess.setVersion(0);
        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(pendingProcess);
        when(approvalProcessMapper.update(any(ApprovalProcess.class), any(LambdaUpdateWrapper.class))).thenReturn(0);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> retirementApplicationService.cancelApplication(99L, 7L));

        assertEquals("审批流程已变更，请刷新后重试", exception.getMessage());
        verify(retirementApplicationMapper, never()).update(any(RetirementApplication.class), any());
        verify(approvalAssignmentService, never()).freezePendingAssignments(any());
        verify(assetLifecycleService, never()).rollbackRetirementStatus(any(), any(), any(), any());
    }

    @Test
    void intermediateReviewUpdatesMustAdvanceAfterTheFirstApprovalStep() {
        TenantContext.setTenantId("T001");
        RetirementApplication application = draftApplication(12L);
        application.setStatus("PENDING");
        application.setTotalApprovalSteps(3);
        Asset asset = asset(12L);
        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);

        retirementApplicationService.updateReviewStatus(99L, 2);
        retirementApplicationService.updateReviewStatus(99L, 3);

        assertEquals("APPROVING", application.getStatus());
        assertEquals(3, application.getCurrentApprovalStep());
        verify(retirementApplicationMapper, times(2)).update(any(RetirementApplication.class), any());
    }

    @Test
    void shouldRejectDirectApprovePath() {
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> retirementApplicationService.approveApplication(99L, 7L));
    }

    @Test
    void shouldRejectDirectCompletePath() {
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> retirementApplicationService.completeApplication(99L, 7L));
    }

    @Test
    void shouldRejectCrossTenantRetirementAsset() {
        Asset otherTenantAsset = new Asset();
        otherTenantAsset.setId(12L);
        otherTenantAsset.setTenantId("T002");
        otherTenantAsset.setAssetNo("A-002");
        otherTenantAsset.setAssetName("其他租户资产");

        RetirementApplyDTO dto = new RetirementApplyDTO();
        dto.setAssetId(12L);
        dto.setReason("达到报废年限");
        dto.setRetirementType(RetirementApplication.RetirementType.SCRAP);

        TenantContext.setTenantId("T001");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(assetMapper.selectById(12L)).thenReturn(otherTenantAsset);

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> retirementApplicationService.submitApplication(dto, 7L));
    }

    @Test
    void shouldRejectMissingRetirementTypeBeforeLoadingAsset() {
        RetirementApplyDTO dto = new RetirementApplyDTO();
        dto.setAssetId(12L);
        dto.setReason("达到报废年限");
        TenantContext.setTenantId("T001");

        assertThrows(com.ams.common.exception.BusinessException.class,
                () -> retirementApplicationService.submitApplication(dto, 7L));
    }

    @Test
    void shouldRejectRetirementAccessWithoutTenantContext() {
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> retirementApplicationService.getApplicationById(99L));
    }

    @Test
    void shouldFilterMyApplicationsByTenant() {
        TenantContext.setTenantId("T001");
        when(retirementApplicationMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
                .thenReturn(new Page<>());

        retirementApplicationService.getMyApplications(7L, 1, 10);

        ArgumentCaptor<LambdaQueryWrapper<RetirementApplication>> captor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(retirementApplicationMapper).selectPage(any(Page.class), captor.capture());
        String sqlSegment = captor.getValue().getSqlSegment();
        assertTrue(sqlSegment.contains("tenant_id"));
        assertTrue(sqlSegment.contains("applicant_id"));
        verify(assetDataPermissionEvaluator).applyToRelatedAsset(any());
    }

    @Test
    void shouldFilterQueryApplicationsByTenant() {
        TenantContext.setTenantId("T001");
        when(retirementApplicationMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
                .thenReturn(new Page<>());

        retirementApplicationService.queryApplications(1, 10, "pending", null);

        ArgumentCaptor<LambdaQueryWrapper<RetirementApplication>> captor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(retirementApplicationMapper).selectPage(any(Page.class), captor.capture());
        String sqlSegment = captor.getValue().getSqlSegment();
        assertTrue(sqlSegment.contains("tenant_id"));
        assertTrue(sqlSegment.contains("status"));
        verify(assetDataPermissionEvaluator).applyToRelatedAsset(any());
    }

    @Test
    void shouldFilterStatisticsByTenant() {
        TenantContext.setTenantId("T001");
        when(retirementApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

        Map<String, Object> stats = retirementApplicationService.getStatistics();

        assertEquals(1L, stats.get("thisMonthCount"));
        ArgumentCaptor<LambdaQueryWrapper<RetirementApplication>> captor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(retirementApplicationMapper, org.mockito.Mockito.times(4)).selectCount(captor.capture());
        assertTrue(captor.getAllValues().stream()
                .allMatch(wrapper -> wrapper.getSqlSegment().contains("tenant_id")));
        verify(assetDataPermissionEvaluator, org.mockito.Mockito.times(4)).applyToRelatedAsset(any());
    }

    @Test
    void shouldRejectCrossTenantApplicationId() {
        RetirementApplication otherTenantApplication = new RetirementApplication();
        otherTenantApplication.setId(99L);
        otherTenantApplication.setTenantId("T002");
        TenantContext.setTenantId("T001");
        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(retirementApplicationMapper.selectById(99L)).thenReturn(otherTenantApplication);

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> retirementApplicationService.getApplicationById(99L));
    }

    @Test
    void shouldRejectIllegalRetirementStateTransition() {
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> retirementApplicationService.approveApplication(99L, 7L));
    }

    private RetirementApplication draftApplication(Long assetId) {
        RetirementApplication application = new RetirementApplication();
        application.setId(99L);
        application.setTenantId("T001");
        application.setAssetId(assetId);
        application.setApplicantId(7L);
        application.setStatus("DRAFT");
        application.setVersion(0);
        return application;
    }

    private Asset asset(Long id) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setTenantId("T001");
        asset.setAssetNo("A-" + id);
        asset.setAssetName("测试资产" + id);
        asset.setStatus("IN_USE");
        return asset;
    }

    private RetirementApplyDTO applyDto(Long assetId, String reason) {
        RetirementApplyDTO dto = new RetirementApplyDTO();
        dto.setAssetId(assetId);
        dto.setReason(reason);
        dto.setRetirementType(RetirementApplication.RetirementType.SCRAP);
        return dto;
    }
}
