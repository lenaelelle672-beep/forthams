package com.ams.scheduled;

import com.ams.context.TenantContext;
import com.ams.entity.RiskAssessment;
import com.ams.service.NotificationService;
import com.ams.service.RiskAssessmentService;
import com.ams.service.TenantService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RiskAssessmentReviewReminderTaskTest {

    @Mock
    private RiskAssessmentService riskAssessmentService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldBindTenantContextForReviewScan() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(riskAssessmentService.list(eq(null), eq(null), eq(null), eq(1), eq(1000))).thenAnswer(invocation -> {
            assertTrue(List.of("dept:1", "dept:2").contains(TenantContext.getTenantId()));
            Page<RiskAssessment> page = new Page<>();
            page.setRecords(List.of());
            return page;
        });

        new RiskAssessmentReviewReminderTask(riskAssessmentService, notificationService, tenantService)
                .scanUpcomingReviews();

        verify(riskAssessmentService, times(2)).list(null, null, null, 1, 1000);
        assertNull(TenantContext.getTenantId());
    }
}
