package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import com.ams.security.DataScope;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetServiceDataScopeTest {

    @Mock
    private AssetMapper assetMapper;
    @Mock
    private AssetLifecycleService assetLifecycleService;
    @Mock
    private DataScopeService dataScopeService;

    private AssetService assetService;

    @BeforeEach
    void setUp() {
        assetService = new AssetService(assetMapper, assetLifecycleService, dataScopeService);
        TenantContext.setTenantId("T001");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getAssetByIdShouldRejectOutsideScope() {
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setTenantId("T001");
        asset.setDeptId(4L);
        asset.setUserId(8L);
        when(assetMapper.selectOne(any())).thenReturn(asset);
        when(dataScopeService.resolveCurrent()).thenReturn(DataScope.filtered(9L, Set.of(3L), false));

        assertThrows(AccessDeniedException.class, () -> assetService.getAssetById(7L));
    }

    @Test
    void queryAssetsShouldApplyDepartmentFilter() {
        when(dataScopeService.resolveCurrent()).thenReturn(DataScope.filtered(9L, Set.of(3L), true));
        when(assetMapper.selectPage(any(), any())).thenReturn(new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>());

        assetService.queryAssets(new com.ams.dto.AssetQueryDTO());

        verify(dataScopeService).resolveCurrent();
        verify(assetMapper).selectPage(any(), any());
    }
}
