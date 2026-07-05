package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.SystemAlertDTO;
import com.ams.dto.SystemAlertStatusRequest;
import com.ams.entity.SystemAlert;
import com.ams.mapper.SystemAlertMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemAlertServiceTest {

    @Mock
    private SystemAlertMapper systemAlertMapper;

    private SystemAlertService systemAlertService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        systemAlertService = new SystemAlertService(systemAlertMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void closeShouldBeIdempotentWhenAlreadyClosed() {
        LocalDateTime closedAt = LocalDateTime.of(2026, 7, 4, 10, 30);
        LocalDateTime readAt = LocalDateTime.of(2026, 7, 4, 9, 15);
        SystemAlert alert = new SystemAlert();
        alert.setId(7L);
        alert.setTenantId("T001");
        alert.setStatus("CLOSED");
        alert.setRead(true);
        alert.setClosedAt(closedAt);
        alert.setClosedBy(101L);
        alert.setReadAt(readAt);
        alert.setReadBy(88L);
        when(systemAlertMapper.selectOne(any(QueryWrapper.class))).thenReturn(alert);

        SystemAlertStatusRequest request = new SystemAlertStatusRequest();
        request.setStatus("CLOSED");

        SystemAlertDTO result = systemAlertService.updateStatus(7L, request, 42L);

        assertEquals("CLOSED", result.getStatus());
        assertTrue(result.getRead());
        assertEquals(closedAt, result.getClosedAt());
        assertEquals(101L, result.getClosedBy());
        assertEquals(readAt, result.getReadAt());
        assertEquals(88L, result.getReadBy());
        verify(systemAlertMapper, never()).updateById(any(SystemAlert.class));
    }
}
