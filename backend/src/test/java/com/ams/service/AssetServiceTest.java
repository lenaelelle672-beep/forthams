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
import org.mockito.MockedStatic;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetServiceTest {

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private AssetLifecycleService assetLifecycleService;

    @Mock
    private AssetParentChildService assetParentChildService;

    @Mock
    private ABCClassificationService abcClassificationService;

    @InjectMocks
    private AssetService assetService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
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

    @Test
    void shouldClassifyImmediatelyWhenNoTransactionSynchronization() {
        Asset asset = asset();
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);

        assetService.updateAsset(1L, new AssetUpdateDTO());

        verify(abcClassificationService).classifyAsset(1L);
        assertEquals("dept:1", TenantContext.getTenantId());
    }

    @Test
    void shouldScheduleAbcClassificationAfterAssetUpdateCommit() {
        Asset asset = asset();
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        TransactionSynchronization[] synchronization = new TransactionSynchronization[1];

        try (MockedStatic<TransactionSynchronizationManager> tx =
                     mockStatic(TransactionSynchronizationManager.class)) {
            tx.when(TransactionSynchronizationManager::isSynchronizationActive).thenReturn(true);
            tx.when(() -> TransactionSynchronizationManager.registerSynchronization(any(TransactionSynchronization.class)))
                    .thenAnswer(invocation -> {
                        synchronization[0] = invocation.getArgument(0);
                        return null;
                    });

            assetService.updateAsset(1L, new AssetUpdateDTO());

            verify(abcClassificationService, never()).classifyAsset(1L);
            assertNotNull(synchronization[0]);

            synchronization[0].afterCommit();

            verify(abcClassificationService).classifyAsset(1L);
            assertEquals("dept:1", TenantContext.getTenantId());
        }
    }

    private Asset asset() {
        Asset asset = new Asset();
        asset.setId(1L);
        asset.setTenantId("dept:1");
        asset.setAssetNo("A-001");
        asset.setAssetName("测试资产");
        asset.setStatus(AssetStatus.IN_USE.name());
        return asset;
    }
}
