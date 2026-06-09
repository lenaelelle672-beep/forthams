package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.MailLog;
import com.ams.mapper.MailLogMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationContext;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MailLogServiceTest {

    @Mock
    private ApplicationContext applicationContext;

    @Mock
    private MailLogMapper mailLogMapper;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getPendingRetryShouldRequireTenantContext() {
        assertThrows(AccessDeniedException.class, () -> service().getPendingRetry(3));
    }

    @Test
    void getPendingRetryShouldQueryWithinTenantContext() {
        TenantContext.setTenantId("dept:1");
        when(mailLogMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(new MailLog()));

        service().getPendingRetry(3);

        verify(mailLogMapper).selectList(any(LambdaQueryWrapper.class));
    }

    private MailLogService service() {
        return new MailLogService(applicationContext, mailLogMapper);
    }
}
