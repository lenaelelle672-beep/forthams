package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetServiceTest {

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private AssetLifecycleService assetLifecycleService;

    @InjectMocks
    private AssetService assetService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldRejectTerminalStatusFromGenericAssetUpdate() {
        Asset asset = asset();
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        AssetUpdateDTO dto = new AssetUpdateDTO();
        dto.setStatus("SCRAPPED");

        BusinessException exception = assertThrows(BusinessException.class,
                () -> assetService.updateAsset(1L, dto));

        assertEquals("资产终态需通过审批流程变更", exception.getMessage());
        verify(assetMapper, never()).update(any(Asset.class), any(LambdaQueryWrapper.class));
        verify(assetLifecycleService, never()).transitionLoadedAsset(any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldAllowNonTerminalStatusThroughLifecycleService() {
        Asset asset = asset();
        Asset transitioned = asset();
        transitioned.setStatus(AssetStatus.MAINTENANCE.name());
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetLifecycleService.transitionLoadedAsset(
                eq(asset),
                eq(AssetStatus.MAINTENANCE),
                eq(AssetLifecycleService.CHANGE_TYPE_STATUS),
                eq("资产状态更新"),
                isNull(),
                isNull()))
                .thenReturn(transitioned);
        AssetUpdateDTO dto = new AssetUpdateDTO();
        dto.setStatus("MAINTENANCE");

        Asset result = assetService.updateAsset(1L, dto);

        assertEquals(AssetStatus.MAINTENANCE.name(), result.getStatus());
        verify(assetMapper).update(eq(asset), any(LambdaQueryWrapper.class));
    }

    private Asset asset() {
        Asset asset = new Asset();
        asset.setId(1L);
        asset.setTenantId("T001");
        asset.setAssetNo("A-001");
        asset.setAssetName("测试资产");
        asset.setStatus(AssetStatus.IN_USE.name());
        return asset;
    }
}
