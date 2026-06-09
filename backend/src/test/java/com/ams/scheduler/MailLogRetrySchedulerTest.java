package com.ams.scheduler;

import com.ams.context.TenantContext;
import com.ams.entity.MailLog;
import com.ams.service.EmailChannel;
import com.ams.service.MailLogService;
import com.ams.service.TenantService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MailLogRetrySchedulerTest {

    @Mock
    private MailLogService mailLogService;

    @Mock
    private EmailChannel emailChannel;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void retryFailedMailsShouldBindAndClearTenantContext() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(mailLogService.getPendingRetry(3)).thenAnswer(invocation -> {
            String tenantId = TenantContext.getTenantId();
            assertTrue(List.of("dept:1", "dept:2").contains(tenantId));
            return "dept:1".equals(tenantId) ? List.of(mailLog()) : List.of();
        });
        doAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            MailLog mailLog = invocation.getArgument(0);
            assertEquals("dept:1", mailLog.getTenantId());
            return null;
        }).when(emailChannel).retrySend(org.mockito.ArgumentMatchers.any(MailLog.class));

        scheduler().retryFailedMails();

        verify(mailLogService, times(2)).getPendingRetry(3);
        verify(emailChannel).retrySend(org.mockito.ArgumentMatchers.any(MailLog.class));
        assertNull(TenantContext.getTenantId());
    }

    private MailLogRetryScheduler scheduler() {
        return new MailLogRetryScheduler(
                mailLogService,
                emailChannel,
                tenantService);
    }

    private MailLog mailLog() {
        MailLog mailLog = new MailLog();
        mailLog.setId(7L);
        mailLog.setTenantId("dept:1");
        mailLog.setSendStatus("FAILED");
        mailLog.setRetryCount(0);
        return mailLog;
    }
}
