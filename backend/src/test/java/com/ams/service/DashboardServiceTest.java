package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.MaintenanceRecordMapper;
import com.ams.mapper.RetirementApplicationMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private MaintenanceRecordMapper maintenanceRecordMapper;

    @Mock
    private RetirementApplicationMapper retirementApplicationMapper;

    @Mock
    private DeptMapper deptMapper;

    @Mock
    private AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @InjectMocks
    private DashboardService dashboardService;

    @Test
    void valueTrendsShouldRejectDaysAboveServiceBoundaryBeforeLoadingAssets() {
        assertThrows(BusinessException.class,
                () -> dashboardService.getValueTrends(DashboardService.MAX_TREND_DAYS + 1));

        verifyNoInteractions(assetMapper, assetDataPermissionEvaluator);
    }
}
