package com.ams.service;

import com.ams.dto.RetirementApplyDTO;
import com.ams.context.TenantContext;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Asset;
import com.ams.entity.RetirementApplication;
import com.ams.enums.AssetStatus;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.RetirementApplicationMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
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
    private AssetLifecycleService assetLifecycleService;

    @InjectMocks
    private RetirementApplicationService retirementApplicationService;

    @BeforeAll
    static void initMybatisPlusTableInfo() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), RetirementApplication.class);
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
        assertEquals("SCRAP", dto.getRetirementType());
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
        dto.setRetirementType("SCRAP");

        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(retirementApplicationMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
        when(approvalProcessMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            invocation.getArgument(0, com.ams.entity.RetirementApplication.class).setId(99L);
            return 1;
        }).when(retirementApplicationMapper).insert(any(com.ams.entity.RetirementApplication.class));

        retirementApplicationService.submitApplication(dto, 7L);

        ArgumentCaptor<RetirementApplication> applicationCaptor = ArgumentCaptor.forClass(RetirementApplication.class);
        verify(retirementApplicationMapper).insert(applicationCaptor.capture());
        assertEquals("T001", applicationCaptor.getValue().getTenantId());

        ArgumentCaptor<LambdaQueryWrapper<RetirementApplication>> applicationNoWrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(retirementApplicationMapper).selectList(applicationNoWrapperCaptor.capture());
        LambdaQueryWrapper<RetirementApplication> applicationNoWrapper = applicationNoWrapperCaptor.getValue();
        assertTrue(applicationNoWrapper.getSqlSegment().contains("tenant_id"));
        assertTrue(applicationNoWrapper.getParamNameValuePairs().containsValue("T001"));

        ArgumentCaptor<ApprovalProcess> captor = ArgumentCaptor.forClass(ApprovalProcess.class);
        verify(approvalProcessMapper).insert(captor.capture());

        ApprovalProcess process = captor.getValue();
        assertNotNull(process.getProcessNo());
        assertTrue(process.getProcessNo().matches("APR-\\d{8}-001"));
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
    void shouldCancelPendingApplicationAndRollbackAssetStatus() {
        RetirementApplication application = new RetirementApplication();
        application.setId(99L);
        application.setTenantId("T001");
        application.setAssetId(12L);
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

        retirementApplicationService.cancelApplication(99L, 7L);

        ArgumentCaptor<RetirementApplication> applicationCaptor = ArgumentCaptor.forClass(RetirementApplication.class);
        verify(retirementApplicationMapper).updateById(applicationCaptor.capture());
        assertEquals("CANCELLED", applicationCaptor.getValue().getStatus());

        ArgumentCaptor<ApprovalProcess> processCaptor = ArgumentCaptor.forClass(ApprovalProcess.class);
        verify(approvalProcessMapper).updateById(processCaptor.capture());
        assertEquals("CANCELLED", processCaptor.getValue().getStatus());

        verify(assetLifecycleService).rollbackRetirementStatus(
                eq(12L),
                eq("RETIREMENT_CANCELLED"),
                eq("达到报废年限"),
                eq(7L));
    }

    @Test
    void shouldApprovePendingApplicationAndRetireAsset() {
        RetirementApplication application = new RetirementApplication();
        application.setId(99L);
        application.setTenantId("T001");
        application.setAssetId(12L);
        application.setStatus("PENDING");
        application.setReason("达到报废年限");
        application.setRetirementType("RETIREMENT");
        application.setTotalApprovalSteps(1);
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        TenantContext.setTenantId("T001");

        ApprovalProcess approvalProcess = new ApprovalProcess();
        approvalProcess.setId(88L);
        approvalProcess.setStatus("PENDING");

        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(approvalProcess);

        RetirementApplication result = retirementApplicationService.approveApplication(99L, 7L);

        assertEquals("APPROVED", result.getStatus());
        verify(assetLifecycleService).transitionStatus(
                eq(12L),
                eq(AssetStatus.RETIRED),
                eq("RETIREMENT_APPROVED"),
                eq("达到报废年限"),
                eq(7L));
    }

    @Test
    void shouldCompleteApprovedApplicationAndKeepScrappedAssetTerminal() {
        RetirementApplication application = new RetirementApplication();
        application.setId(99L);
        application.setTenantId("T001");
        application.setAssetId(12L);
        application.setStatus("APPROVED");
        application.setReason("损坏");
        application.setRetirementType("SCRAP");
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        TenantContext.setTenantId("T001");

        ApprovalProcess approvalProcess = new ApprovalProcess();
        approvalProcess.setId(88L);
        approvalProcess.setStatus("APPROVED");

        when(retirementApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(approvalProcess);

        RetirementApplication result = retirementApplicationService.completeApplication(99L, 7L);

        assertEquals("COMPLETED", result.getStatus());
        verify(assetLifecycleService).transitionStatus(
                eq(12L),
                eq(AssetStatus.SCRAPPED),
                eq("RETIREMENT_COMPLETED"),
                eq("损坏"),
                eq(7L));
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

        TenantContext.setTenantId("T001");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(assetMapper.selectById(12L)).thenReturn(otherTenantAsset);

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
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
}
