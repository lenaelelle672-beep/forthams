package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.AssetChangeLog;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetChangeLogMapper;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetLifecycleServiceTest {

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private AssetChangeLogMapper assetChangeLogMapper;

    @InjectMocks
    private AssetLifecycleService assetLifecycleService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldTransitionStatusAndRecordChangeLog() {
        Asset asset = new Asset();
        asset.setId(1L);
        asset.setTenantId("T001");
        asset.setStatus("IN_USE");
        TenantContext.setTenantId("T001");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetMapper.update(any(Asset.class), any(LambdaQueryWrapper.class))).thenReturn(1);

        Asset result = assetLifecycleService.transitionStatus(1L, AssetStatus.SCRAPPED, "SCRAP", "broken", 7L);

        assertEquals("SCRAPPED", result.getStatus());
        verify(assetMapper).update(eqAsset(asset), any(LambdaQueryWrapper.class));

        ArgumentCaptor<AssetChangeLog> captor = ArgumentCaptor.forClass(AssetChangeLog.class);
        verify(assetChangeLogMapper).insert(captor.capture());
        AssetChangeLog log = captor.getValue();
        assertEquals(1L, log.getAssetId());
        assertEquals("SCRAP", log.getChangeType());
        assertEquals("broken", log.getReason());
        assertEquals(7L, log.getOperatorId());
        assertTrue(log.getOldValue().contains("status=IN_USE"));
        assertTrue(log.getNewValue().contains("status=SCRAPPED"));
    }

    @Test
    void shouldRejectTransitionFromTerminalStatus() {
        Asset asset = new Asset();
        asset.setId(2L);
        asset.setTenantId("T001");
        asset.setStatus("RETIRED");
        TenantContext.setTenantId("T001");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);

        assertThrows(BusinessException.class,
                () -> assetLifecycleService.transitionStatus(2L, AssetStatus.IN_USE, "TRANSFER", "restore", 8L));

        verify(assetMapper, never()).update(any(Asset.class), any(LambdaQueryWrapper.class));
        verify(assetChangeLogMapper, never()).insert(any(AssetChangeLog.class));
    }

    @Test
    void shouldPersistAssetMutationsWithStatusTransition() {
        Asset asset = new Asset();
        asset.setId(3L);
        asset.setTenantId("T001");
        asset.setStatus("IDLE");
        TenantContext.setTenantId("T001");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetMapper.update(any(Asset.class), any(LambdaQueryWrapper.class))).thenReturn(1);

        Asset result = assetLifecycleService.transitionAsset(
                3L,
                AssetStatus.IN_USE,
                "TRANSFER",
                "assigned",
                9L,
                item -> {
                    item.setDeptId(20L);
                    item.setUserId(30L);
                    item.setLocation("A-01");
                });

        assertEquals("IN_USE", result.getStatus());
        assertEquals(20L, result.getDeptId());
        assertEquals(30L, result.getUserId());
        assertEquals("A-01", result.getLocation());

        ArgumentCaptor<AssetChangeLog> captor = ArgumentCaptor.forClass(AssetChangeLog.class);
        verify(assetChangeLogMapper).insert(captor.capture());
        assertTrue(captor.getValue().getOldValue().contains("deptId=null"));
        assertTrue(captor.getValue().getNewValue().contains("deptId=20"));
        assertTrue(captor.getValue().getNewValue().contains("status=IN_USE"));
    }

    @Test
    void shouldRollbackRetirementToOriginalStatusFromChangeLog() {
        Asset asset = new Asset();
        asset.setId(4L);
        asset.setTenantId("T001");
        asset.setStatus("PENDING_RETIREMENT");
        TenantContext.setTenantId("T001");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(asset);
        when(assetMapper.update(any(Asset.class), any(LambdaQueryWrapper.class))).thenReturn(1);

        AssetChangeLog submitLog = new AssetChangeLog();
        submitLog.setOldValue("deptId=null,userId=null,location=null,status=IDLE");
        when(assetChangeLogMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(submitLog);

        Asset result = assetLifecycleService.rollbackRetirementStatus(4L, "RETIREMENT_REJECTED", "reject", 7L);

        assertEquals("IDLE", result.getStatus());
        verify(assetMapper).update(eqAsset(asset), any(LambdaQueryWrapper.class));
    }

    @Test
    void shouldRejectCrossTenantLifecycleTransition() {
        Asset otherTenantAsset = new Asset();
        otherTenantAsset.setId(5L);
        otherTenantAsset.setTenantId("T002");
        otherTenantAsset.setStatus("IN_USE");
        TenantContext.setTenantId("T001");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(assetMapper.selectById(5L)).thenReturn(otherTenantAsset);

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> assetLifecycleService.transitionStatus(5L, AssetStatus.SCRAPPED, "SCRAP", "blocked", 7L));

        verify(assetMapper, never()).update(any(Asset.class), any(LambdaQueryWrapper.class));
    }

    @Test
    void shouldRejectLifecycleTransitionWithoutTenantContext() {
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> assetLifecycleService.transitionStatus(6L, AssetStatus.SCRAPPED, "SCRAP", "blocked", 7L));
    }

    private Asset eqAsset(Asset asset) {
        return org.mockito.ArgumentMatchers.eq(asset);
    }
}
