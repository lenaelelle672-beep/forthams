package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetScrapDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Asset;
import com.ams.entity.DisposalApplication;
import com.ams.entity.WorkflowDefinition;
import com.ams.enums.AssetStatus;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetChangeLogMapper;
import com.ams.mapper.AssetCompensationMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.DisposalApplicationMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DisposalServiceTest {

    @Mock
    private AssetLifecycleService assetLifecycleService;

    @Mock
    private AssetChangeLogMapper assetChangeLogMapper;

    @Mock
    private WorkflowDefinitionService workflowDefinitionService;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @Mock
    private AssetCompensationMapper assetCompensationMapper;

    @Mock
    private DisposalApplicationMapper disposalApplicationMapper;

    @Mock
    private ApprovalProcessMapper approvalProcessMapper;

    @Mock
    private DeptMapper deptMapper;

    @Mock
    private UserMapper userMapper;

    @Mock
    private UserTenantMembershipMapper userTenantMembershipMapper;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private ApprovalAssignmentService approvalAssignmentService;

    @InjectMocks
    private DisposalService disposalService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "disposal-test", null, List.of(
                new SimpleGrantedAuthority("disposal:create"),
                new SimpleGrantedAuthority("disposal:query"))));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectsDisposalForAnAssetPendingRetirement() {
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.PENDING_RETIREMENT.name());
        AssetScrapDTO dto = new AssetScrapDTO();
        dto.setAssetId(12L);
        dto.setReason("等待退役审批");
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_SCRAP")).thenReturn(new WorkflowDefinition());
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> disposalService.createScrapApplication(dto));

        assertEquals("待退役资产不能同时发起处置申请", exception.getMessage());
        verify(disposalApplicationMapper, never()).insert(any(DisposalApplication.class));
    }

    @Test
    void rejectsSecondPendingDisposalForTheSameAsset() {
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IN_USE.name());
        AssetScrapDTO dto = new AssetScrapDTO();
        dto.setAssetId(12L);
        dto.setReason("重复报废申请");
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_SCRAP")).thenReturn(new WorkflowDefinition());
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(disposalApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> disposalService.createScrapApplication(dto));

        assertEquals("该资产已有进行中的处置申请", exception.getMessage());
        verify(disposalApplicationMapper, never()).insert(any(DisposalApplication.class));
    }

    @Test
    void rejectsDisposalWhenAssetHasPendingCompensation() {
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IN_USE.name());
        AssetScrapDTO dto = new AssetScrapDTO();
        dto.setAssetId(12L);
        dto.setReason("存在待审批赔偿");
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_SCRAP")).thenReturn(new WorkflowDefinition());
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetCompensationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> disposalService.createScrapApplication(dto));

        assertEquals("该资产已有进行中的赔偿申请", exception.getMessage());
        verify(disposalApplicationMapper, never()).insert(any(DisposalApplication.class));
    }

    @Test
    void rejectsDisposalApprovalWhenAssetHasPendingCompensation() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "disposal-approver", null, List.of(new SimpleGrantedAuthority("disposal:approve"))));
        DisposalApplication application = new DisposalApplication();
        application.setId(99L);
        application.setTenantId("T001");
        application.setAssetId(12L);
        application.setApplicantId(7L);
        application.setStatus("PENDING");
        application.setVersion(0);
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IN_USE.name());
        ApprovalProcess process = new ApprovalProcess();
        process.setStatus("APPROVED");
        process.setApplicantId(7L);
        when(disposalApplicationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(application);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(process);
        when(assetCompensationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> disposalService.applyApprovalOutcome(99L, "APPROVED", 8L, "已确认"));

        assertEquals("该资产已有进行中的赔偿申请", exception.getMessage());
        verify(disposalApplicationMapper, never()).update(any(), any());
    }

    @Test
    void listAppliesTheSharedRelatedAssetScope() {
        when(disposalApplicationMapper.selectPage(any(Page.class), any(QueryWrapper.class))).thenReturn(new Page<>());

        disposalService.queryApplications(1, 10, null, null, null);

        verify(assetDataPermissionEvaluator).applyToRelatedAsset(any(QueryWrapper.class));
    }
}
