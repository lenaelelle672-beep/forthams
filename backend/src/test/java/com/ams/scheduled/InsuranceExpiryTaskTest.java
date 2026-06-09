package com.ams.scheduled;

import com.ams.context.TenantContext;
import com.ams.service.InsuranceService;
import com.ams.service.NotificationService;
import com.ams.service.TenantService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InsuranceExpiryTaskTest {

    @Mock
    private InsuranceService insuranceService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldBindTenantContextForExpiringPolicyScan() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(insuranceService.getExpiringPolicies(30)).thenAnswer(invocation -> {
            assertTrue(List.of("dept:1", "dept:2").contains(TenantContext.getTenantId()));
            return List.of();
        });

        new InsuranceExpiryTask(insuranceService, notificationService, tenantService)
                .scanExpiringPolicies();

        verify(insuranceService, times(2)).getExpiringPolicies(30);
        assertNull(TenantContext.getTenantId());
    }
}
