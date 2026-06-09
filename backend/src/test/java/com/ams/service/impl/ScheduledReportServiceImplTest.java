package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.entity.ScheduledReport;
import com.ams.mapper.ScheduledReportMapper;
import com.ams.service.EmailService;
import com.ams.service.TenantService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduledReportServiceImplTest {

    @Mock
    private ScheduledReportMapper scheduledReportMapper;

    @Mock
    private EmailService emailService;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void scanAndExecuteShouldBindTenantContextForQueryAndExecution() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(scheduledReportMapper.selectList(any())).thenAnswer(invocation -> {
            String tenantId = TenantContext.getTenantId();
            assertTrue(List.of("dept:1", "dept:2").contains(tenantId));
            return "dept:1".equals(tenantId) ? List.of(report()) : List.of();
        });
        doAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            return null;
        }).when(emailService).sendEmail(anyString(), anyString(), anyString());
        when(scheduledReportMapper.updateById(any(ScheduledReport.class))).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            ScheduledReport updated = invocation.getArgument(0);
            assertEquals("dept:1", updated.getTenantId());
            assertNotNull(updated.getLastRunAt());
            assertNotNull(updated.getNextRunAt());
            return 1;
        });

        service().scanAndExecute();

        verify(scheduledReportMapper, times(2)).selectList(any());
        verify(emailService).sendEmail(
                eq("ops@example.com"),
                eq("日报"),
                eq("请在系统中查看定时报表（报表ID: 99）"));
        verify(scheduledReportMapper).updateById(any(ScheduledReport.class));
        assertNull(TenantContext.getTenantId());
    }

    private ScheduledReportServiceImpl service() {
        return new ScheduledReportServiceImpl(
                scheduledReportMapper,
                emailService,
                tenantService);
    }

    private ScheduledReport report() {
        ScheduledReport report = new ScheduledReport();
        report.setId(7L);
        report.setTenantId("dept:1");
        report.setSavedReportId(99L);
        report.setCronExpr("* * * * *");
        report.setRecipientEmails("[\"ops@example.com\"]");
        report.setSubject("日报");
        return report;
    }
}
