package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.MaintenanceRecord;
import com.ams.mapper.MaintenanceRecordMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MaintenanceServiceDataScopeTest {

    @Mock
    private MaintenanceRecordMapper maintenanceRecordMapper;
    @Mock
    private DataScopeService dataScopeService;

    private MaintenanceService maintenanceService;

    @BeforeEach
    void setUp() {
        maintenanceService = new MaintenanceService(maintenanceRecordMapper, dataScopeService);
        TenantContext.setTenantId("T001");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getRecordByIdShouldRejectOutsideAssetScope() {
        MaintenanceRecord record = new MaintenanceRecord();
        record.setId(6L);
        record.setTenantId("T001");
        record.setAssetId(88L);
        record.setCreateBy(2L);
        when(maintenanceRecordMapper.selectOne(any())).thenReturn(record);
        when(dataScopeService.resolveCurrent()).thenReturn(com.ams.security.DataScope.filtered(9L, java.util.Set.of(3L), false));
        doThrow(new AccessDeniedException("数据范围不足")).when(dataScopeService).assertAllowsAsset(88L);

        assertThrows(AccessDeniedException.class, () -> maintenanceService.getRecordById(6L));
    }
}
