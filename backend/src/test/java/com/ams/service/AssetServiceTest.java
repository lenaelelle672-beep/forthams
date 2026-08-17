package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Asset;
import com.ams.enums.AssetStatus;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetServiceTest {

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private ApprovalProcessMapper approvalProcessMapper;

    @Mock
    private AssetLifecycleService assetLifecycleService;

    @Mock
    private AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @InjectMocks
    private AssetService assetService;

    @BeforeAll
    static void initMybatisPlusTableInfo() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), Asset.class);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createShouldRejectTerminalStatusProvidedByGenericAssetWrite() {
        TenantContext.setTenantId("T001");
        AssetCreateDTO dto = new AssetCreateDTO();
        dto.setAssetName("测试资产");
        dto.setCategoryId(1L);
        dto.setStatus(AssetStatus.SCRAPPED.name());

        assertThrows(BusinessException.class, () -> assetService.createAsset(dto));

        verifyNoInteractions(assetMapper, assetLifecycleService);
    }

    @Test
    void updateShouldRejectRollbackOfPendingRetirementThroughGenericAssetWrite() {
        TenantContext.setTenantId("T001");
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.PENDING_RETIREMENT.name());
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        AssetUpdateDTO dto = new AssetUpdateDTO();
        dto.setAssetName("测试资产");
        dto.setStatus(AssetStatus.IDLE.name());

        assertThrows(BusinessException.class, () -> assetService.updateAsset(7L, dto));

        verify(assetDataPermissionEvaluator).assertCanAccess(asset);
        verifyNoInteractions(assetLifecycleService);
        verify(assetMapper, never()).update(any(Asset.class), any(LambdaQueryWrapper.class));
    }

    @Test
    void updateShouldRejectDirectScrapThroughGenericAssetWrite() {
        TenantContext.setTenantId("T001");
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IDLE.name());
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        AssetUpdateDTO dto = new AssetUpdateDTO();
        dto.setAssetName("测试资产");
        dto.setStatus(AssetStatus.SCRAPPED.name());

        assertThrows(BusinessException.class, () -> assetService.updateAsset(7L, dto));

        verifyNoInteractions(assetLifecycleService);
    }

    @Test
    void updateShouldUseVersionConditionAndAdvanceVersion() {
        TenantContext.setTenantId("T001");
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IDLE.name());
        asset.setVersion(3);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetMapper.update(any(Asset.class), any(LambdaQueryWrapper.class))).thenReturn(1);
        AssetUpdateDTO dto = new AssetUpdateDTO();
        dto.setAssetName("更新后的资产");

        Asset result = assetService.updateAsset(7L, dto);

        ArgumentCaptor<LambdaQueryWrapper<Asset>> wrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(assetMapper).update(any(Asset.class), wrapperCaptor.capture());
        assertTrue(wrapperCaptor.getValue().getSqlSegment().contains("version"));
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(3));
        assertEquals(4, result.getVersion());
    }

    @Test
    void updateMustNotWriteTransferFieldsThroughGenericAssetWrite() {
        TenantContext.setTenantId("T001");
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IDLE.name());
        asset.setVersion(3);
        asset.setDeptId(9L);
        asset.setUserId(4L);
        asset.setLocationId(6L);
        asset.setLocation("机房A");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetMapper.update(any(Asset.class), any(LambdaQueryWrapper.class))).thenReturn(1);
        AssetUpdateDTO dto = new AssetUpdateDTO();
        dto.setAssetName("更新后的资产");

        Asset result = assetService.updateAsset(7L, dto);

        assertEquals(9L, result.getDeptId());
        assertEquals(4L, result.getUserId());
        assertEquals(6L, result.getLocationId());
        assertEquals("机房A", result.getLocation());
    }

    @Test
    void deleteShouldUseVersionCondition() {
        TenantContext.setTenantId("T001");
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IDLE.name());
        asset.setVersion(3);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetMapper.delete(any(LambdaQueryWrapper.class))).thenReturn(1);

        assetService.deleteAsset(7L);

        ArgumentCaptor<LambdaQueryWrapper<Asset>> wrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(assetMapper).delete(wrapperCaptor.capture());
        String deleteSql = wrapperCaptor.getValue().getSqlSegment();
        assertTrue(deleteSql.contains("version"));
        assertTrue(deleteSql.contains("NOT EXISTS"));
        assertTrue(deleteSql.contains("inventory_detail"));
        assertTrue(deleteSql.contains("approval_process"));
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(3));
        ArgumentCaptor<LambdaQueryWrapper<Asset>> lockCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(assetMapper).selectOne(lockCaptor.capture());
        assertTrue(lockCaptor.getValue().getSqlSegment().contains("FOR UPDATE"));
    }

    @Test
    void deleteShouldRejectWhenRelatedAssetApprovalIsPending() {
        TenantContext.setTenantId("T001");
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IDLE.name());
        asset.setVersion(3);
        ApprovalProcess pendingCompensation = new ApprovalProcess();
        pendingCompensation.setId(91L);
        pendingCompensation.setStatus("PENDING");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(null, pendingCompensation);

        BusinessException exception = assertThrows(BusinessException.class, () -> assetService.deleteAsset(7L));

        assertEquals("资产存在进行中的审批流程，不能删除", exception.getMessage());
        ArgumentCaptor<QueryWrapper<ApprovalProcess>> processCaptor = ArgumentCaptor.forClass(QueryWrapper.class);
        verify(approvalProcessMapper, times(2)).selectOne(processCaptor.capture());
        QueryWrapper<ApprovalProcess> compensationQuery = processCaptor.getAllValues().get(1);
        compensationQuery.getSqlSegment();
        assertTrue(compensationQuery.getParamNameValuePairs().containsValue("COMPENSATION"));
        assertTrue(compensationQuery.getParamNameValuePairs().containsValue("PENDING"));
        assertTrue(compensationQuery.getParamNameValuePairs().containsValue(7L));
        verify(assetMapper, never()).delete(any(LambdaQueryWrapper.class));
    }

    @Test
    void deleteShouldRejectWhenAssetIsReferencedByActiveInventoryTask() {
        TenantContext.setTenantId("T001");
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IDLE.name());
        asset.setVersion(3);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetMapper.selectCount(any(QueryWrapper.class))).thenReturn(1L);

        BusinessException exception = assertThrows(BusinessException.class, () -> assetService.deleteAsset(7L));

        assertEquals("资产仍被活跃盘点任务引用，不能删除", exception.getMessage());
        verify(assetMapper, never()).delete(any(LambdaQueryWrapper.class));
    }

    @Test
    void deleteShouldRejectWhenAssetIsFrozenInPendingRetirement() {
        TenantContext.setTenantId("T001");
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.PENDING_RETIREMENT.name());
        asset.setVersion(3);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);

        BusinessException exception = assertThrows(BusinessException.class, () -> assetService.deleteAsset(7L));

        assertEquals("资产处于冻结退役状态，不能删除", exception.getMessage());
        verify(assetMapper, never()).delete(any(LambdaQueryWrapper.class));
        verify(assetMapper, never()).selectCount(any(QueryWrapper.class));
    }

    @Test
    void deleteShouldRejectWhenAssetHasCancelledRequiresResubmissionRecord() {
        TenantContext.setTenantId("T001");
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setStatus(AssetStatus.IDLE.name());
        asset.setVersion(3);
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L, 1L);

        BusinessException exception = assertThrows(BusinessException.class, () -> assetService.deleteAsset(7L));

        assertEquals("资产存在需重提的业务流程，不能删除", exception.getMessage());
        verify(assetMapper, never()).delete(any(LambdaQueryWrapper.class));
    }

    @Test
    void queryShouldCapPageSize() {
        TenantContext.setTenantId("T001");
        AssetQueryDTO query = new AssetQueryDTO();
        query.setPage(0);
        query.setPageSize(1000);
        when(assetMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenReturn(new Page<>());

        assetService.queryAssets(query);

        ArgumentCaptor<Page<Asset>> pageCaptor = ArgumentCaptor.forClass(Page.class);
        verify(assetMapper).selectPage(pageCaptor.capture(), any(LambdaQueryWrapper.class));
        assertEquals(1, pageCaptor.getValue().getCurrent());
        assertEquals(100, pageCaptor.getValue().getSize());
    }
}
