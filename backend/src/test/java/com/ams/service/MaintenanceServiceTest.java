package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.MaintenanceCreateDTO;
import com.ams.entity.Asset;
import com.ams.entity.MaintenanceRecord;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.MaintenanceRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MaintenanceServiceTest {

    @Mock
    private MaintenanceRecordMapper maintenanceRecordMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @InjectMocks
    private MaintenanceService maintenanceService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "maintenance-test", null, List.of(
                new SimpleGrantedAuthority("maintenance:query"),
                new SimpleGrantedAuthority("maintenance:create"))));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void listAppliesTheSharedRelatedAssetScope() {
        when(maintenanceRecordMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
                .thenReturn(new Page<>(1, 10));

        maintenanceService.queryRecords(1, 10, null, null);

        verify(assetDataPermissionEvaluator).applyToRelatedAsset(any(LambdaQueryWrapper.class));
    }

    @Test
    void createRejectsAssetOwnedByAnotherTenant() {
        MaintenanceCreateDTO dto = new MaintenanceCreateDTO();
        dto.setAssetId(9L);
        dto.setMaintenanceType("ROUTINE");
        Asset otherTenantAsset = new Asset();
        otherTenantAsset.setId(9L);
        otherTenantAsset.setTenantId("T002");
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(assetMapper.selectById(9L)).thenReturn(otherTenantAsset);

        assertThrows(AccessDeniedException.class, () -> maintenanceService.createRecord(dto));

        verify(maintenanceRecordMapper, never()).insert(any(MaintenanceRecord.class));
    }
}
