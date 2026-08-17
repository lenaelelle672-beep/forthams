package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.CompensationCreateDTO;
import com.ams.dto.CompensationUpdateDTO;
import com.ams.dto.CompensationValuationDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetCompensation;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Dept;
import com.ams.entity.User;
import com.ams.entity.WorkflowDefinition;
import com.ams.enums.AssetStatus;
import com.ams.enums.CompensationStatus;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetCompensationMapper;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.DisposalApplicationMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
class CompensationServiceTest {

    @BeforeAll
    static void initMybatisPlusTableInfo() {
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, AssetCompensation.class);
        TableInfoHelper.initTableInfo(assistant, ApprovalProcess.class);
    }

    @Mock
    private AssetCompensationMapper assetCompensationMapper;

    @Mock
    private ApprovalProcessMapper approvalProcessMapper;

    @Mock
    private DisposalApplicationMapper disposalApplicationMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private WorkflowDefinitionService workflowDefinitionService;

    @Mock
    private AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @Mock
    private UserMapper userMapper;

    @Mock
    private DeptMapper deptMapper;

    @Mock
    private UserTenantMembershipMapper userTenantMembershipMapper;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private ApprovalAssignmentService approvalAssignmentService;

    @InjectMocks
    private CompensationService compensationService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        User applicant = user(7L);
        lenient().when(tenantAuthorityService.requireCurrentTenantMember()).thenReturn(applicant);
        lenient().doAnswer(invocation -> {
            AssetCompensation compensation = invocation.getArgument(0);
            if (compensation.getId() == null) {
                compensation.setId(99L);
            }
            return 1;
        }).when(assetCompensationMapper).insert(any(AssetCompensation.class));
        lenient().doAnswer(invocation -> {
            ApprovalProcess process = invocation.getArgument(0, ApprovalProcess.class);
            process.setId(100L);
            return 1;
        }).when(approvalProcessMapper).insert(org.mockito.ArgumentMatchers.<ApprovalProcess>any());
        lenient().when(assetCompensationMapper.update(any(), any())).thenReturn(1);
        lenient().when(assetCompensationMapper.selectCount(any())).thenReturn(0L);
        lenient().when(disposalApplicationMapper.selectCount(any())).thenReturn(0L);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldRejectMissingResponsibleUser() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.createCompensation(dto));

        assertEquals("赔偿责任人不能为空", exception.getMessage());
        verifyNoInteractions(assetCompensationMapper);
    }

    @Test
    void shouldRejectMissingAsset() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setResponsibleUserId(42L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.createCompensation(dto));

        assertEquals("资产不能为空", exception.getMessage());
        verifyNoInteractions(assetCompensationMapper);
    }

    @Test
    void shouldCreateCompensationWithExplicitBusinessIds() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);
        dto.setResponsibleUserId(42L);
        dto.setCompensationType("DAMAGE");
        dto.setCompensationAmount(new BigDecimal("100.00"));
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setTenantId("T001");
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(asset);
        when(userMapper.selectOne(any())).thenReturn(user(42L));
        when(userTenantMembershipMapper.countActiveMembership(42L, "T001")).thenReturn(1L);
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_COMPENSATION")).thenReturn(new WorkflowDefinition());
        when(assetCompensationMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);

        compensationService.createCompensation(dto);

        ArgumentCaptor<AssetCompensation> captor = ArgumentCaptor.forClass(AssetCompensation.class);
        verify(assetCompensationMapper).insert(captor.capture());
        AssetCompensation compensation = captor.getValue();
        assertEquals("T001", compensation.getTenantId());
        assertEquals(12L, compensation.getAssetId());
        assertEquals(42L, compensation.getResponsibleUserId());
        assertTrue(compensation.getCompensationNo().matches("CMP-\\d{8}-001\\d{4}"));
    }

    @Test
    void shouldRejectCompensationWhenWorkflowIsNotPublished() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);
        dto.setResponsibleUserId(42L);
        dto.setCompensationType("DAMAGE");
        when(userMapper.selectOne(any())).thenReturn(user(42L));
        when(userTenantMembershipMapper.countActiveMembership(42L, "T001")).thenReturn(1L);
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_COMPENSATION"))
                .thenThrow(new BusinessException("请先发布对应业务流程后再提交审批"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.createCompensation(dto));

        assertEquals("请先发布对应业务流程后再提交审批", exception.getMessage());
        verifyNoInteractions(assetCompensationMapper);
    }

    @Test
    void shouldRejectCompensationWhenAssetHasPendingDisposal() {
        CompensationCreateDTO dto = createDTO();
        Asset asset = asset(12L);
        asset.setStatus(AssetStatus.IN_USE.name());
        when(userMapper.selectOne(any())).thenReturn(user(42L));
        when(userTenantMembershipMapper.countActiveMembership(42L, "T001")).thenReturn(1L);
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_COMPENSATION")).thenReturn(new WorkflowDefinition());
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(asset);
        when(disposalApplicationMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.createCompensation(dto));

        assertEquals("该资产已有进行中的处置申请", exception.getMessage());
        verify(assetCompensationMapper, never()).insert(any(AssetCompensation.class));
    }

    @Test
    void shouldEstimateCompensationFromAssetCurrentValue() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);
        dto.setCompensationType("设备丢失");
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setCurrentValue(new BigDecimal("800.00"));
        asset.setOriginalValue(new BigDecimal("1000.00"));
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(asset);

        CompensationValuationDTO valuation = compensationService.estimateCompensation(dto);

        assertEquals(new BigDecimal("800.00"), valuation.getEstimatedAmount());
        assertEquals(new BigDecimal("800.00"), valuation.getBaseAmount());
        assertTrue(valuation.getValuationBasis().contains("资产当前价值"));
    }

    @Test
    void shouldAutoFillCompensationAmountWhenMissing() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);
        dto.setResponsibleUserId(42L);
        dto.setCompensationType("DAMAGE");
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setOriginalValue(new BigDecimal("1000.00"));
        when(workflowDefinitionService.requirePublishedDefinition("ASSET_COMPENSATION")).thenReturn(new WorkflowDefinition());
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(asset);
        when(userMapper.selectOne(any())).thenReturn(user(42L));
        when(userTenantMembershipMapper.countActiveMembership(42L, "T001")).thenReturn(1L);
        when(assetCompensationMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);

        compensationService.createCompensation(dto);

        ArgumentCaptor<AssetCompensation> captor = ArgumentCaptor.forClass(AssetCompensation.class);
        verify(assetCompensationMapper).insert(captor.capture());
        assertEquals(new BigDecimal("1000.00"), captor.getValue().getCompensationAmount());
    }

    @Test
    void shouldApplyAssetScopeToCompensationList() {
        when(assetCompensationMapper.selectPage(any(Page.class), any(QueryWrapper.class))).thenReturn(new Page<>());

        compensationService.queryCompensations(1, 10, null, null);

        verify(assetDataPermissionEvaluator).applyToRelatedAsset(any());
    }

    @Test
    void submittedCompensationMustFreezeApprovalCriticalFields() {
        AssetCompensation compensation = pendingCompensation(12L);
        Asset existingAsset = asset(12L);
        CompensationUpdateDTO dto = new CompensationUpdateDTO();
        dto.setAssetId(13L);
        dto.setCompensationAmount(new BigDecimal("999.00"));
        dto.setResponsibleUserId(42L);
        dto.setResponsibleDeptId(9L);
        dto.setDescription("篡改审批原因");
        when(assetCompensationMapper.selectOne(any(QueryWrapper.class))).thenReturn(compensation);
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(existingAsset);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.updateCompensation(99L, dto));

        assertEquals("赔偿申请一旦提交进入审批即不可修改", exception.getMessage());
        verify(assetCompensationMapper, never()).update(any(), any());
        verify(assetMapper, times(1)).selectOne(any(QueryWrapper.class));
    }

    @Test
    void deleteMustRejectWhenPendingCompensationProcessExists() {
        AssetCompensation compensation = pendingCompensation(12L);
        Asset existingAsset = asset(12L);
        ApprovalProcess process = new ApprovalProcess();
        process.setId(100L);
        process.setStatus("PENDING");
        when(assetCompensationMapper.selectOne(any(QueryWrapper.class))).thenReturn(compensation);
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(existingAsset);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(process);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.deleteCompensation(99L));

        assertEquals("存在进行中的赔偿审批流程，不能删除申请", exception.getMessage());
        ArgumentCaptor<LambdaQueryWrapper<ApprovalProcess>> processCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(approvalProcessMapper).selectOne(processCaptor.capture());
        processCaptor.getValue().getSqlSegment();
        assertTrue(processCaptor.getValue().getParamNameValuePairs().containsValue("COMPENSATION"));
        assertTrue(processCaptor.getValue().getParamNameValuePairs().containsValue("PENDING"));
        assertTrue(processCaptor.getValue().getParamNameValuePairs().containsValue(99L));
        verify(assetCompensationMapper, never()).delete(any());
    }

    @Test
    void shouldRejectCrossTenantResponsibleUserBeforeCreatingCompensation() {
        CompensationCreateDTO dto = createDTO();
        when(userMapper.selectOne(any())).thenReturn(null);

        assertThrows(AccessDeniedException.class, () -> compensationService.createCompensation(dto));

        verifyNoInteractions(assetCompensationMapper);
    }

    @Test
    void shouldRejectResponsibleUserWithoutActiveTenantMembership() {
        CompensationCreateDTO dto = createDTO();
        when(userMapper.selectOne(any())).thenReturn(user(42L));
        when(userTenantMembershipMapper.countActiveMembership(42L, "T001")).thenReturn(0L);

        assertThrows(AccessDeniedException.class, () -> compensationService.createCompensation(dto));

        verifyNoInteractions(assetCompensationMapper);
    }

    @Test
    void shouldRejectCrossTenantResponsibleDepartmentBeforeCreatingCompensation() {
        CompensationCreateDTO dto = createDTO();
        dto.setResponsibleDeptId(9L);
        when(userMapper.selectOne(any())).thenReturn(user(42L));
        when(userTenantMembershipMapper.countActiveMembership(42L, "T001")).thenReturn(1L);
        when(deptMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);

        assertThrows(AccessDeniedException.class, () -> compensationService.createCompensation(dto));

        verifyNoInteractions(assetCompensationMapper);
    }

    @Test
    void shouldRejectCompensationStatusTransitionAfterApproval() {
        assertThrows(AccessDeniedException.class,
                () -> compensationService.updateStatus(99L, CompensationStatus.REJECTED));
    }

    @Test
    void shouldRejectCompensationApprovalWhenAssetIsTerminal() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "compensation-approver", null, List.of(new SimpleGrantedAuthority("compensation:approve"))));
        AssetCompensation compensation = pendingCompensation(12L);
        Asset asset = asset(12L);
        asset.setStatus(AssetStatus.SCRAPPED.name());
        ApprovalProcess process = new ApprovalProcess();
        process.setStatus("APPROVED");
        process.setApplicantId(7L);
        when(assetCompensationMapper.selectOne(any(QueryWrapper.class))).thenReturn(compensation);
        when(assetMapper.selectOne(any(QueryWrapper.class))).thenReturn(asset);
        when(approvalProcessMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(process);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> compensationService.applyApprovalOutcome(99L, "APPROVED", 8L, "已确认"));

        assertEquals("待退役或终态资产不能关联赔偿申请", exception.getMessage());
        verify(assetCompensationMapper, never()).update(any(), any());
    }

    private CompensationCreateDTO createDTO() {
        CompensationCreateDTO dto = new CompensationCreateDTO();
        dto.setAssetId(12L);
        dto.setResponsibleUserId(42L);
        dto.setCompensationType("DAMAGE");
        dto.setCompensationAmount(new BigDecimal("100.00"));
        return dto;
    }

    private Asset asset(Long id) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setTenantId("T001");
        return asset;
    }

    private AssetCompensation pendingCompensation(Long assetId) {
        AssetCompensation compensation = new AssetCompensation();
        compensation.setId(99L);
        compensation.setTenantId("T001");
        compensation.setAssetId(assetId);
        compensation.setStatus("PENDING");
        compensation.setCreateBy(7L);
        compensation.setVersion(0);
        return compensation;
    }

    private User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setTenantId("T001");
        user.setStatus(1);
        return user;
    }
}
