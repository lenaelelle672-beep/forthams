package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SupportTicketDTO;
import com.ams.entity.SupportTicket;
import com.ams.mapper.SupportTicketMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 技术支持工单只读 catalog 服务测试。
 * 覆盖 priorityLabel/statusLabel 映射、诊断包脱敏布尔、详情校验、分页边界与租户隔离。
 */
@ExtendWith(MockitoExtension.class)
class TechSupportServiceTest {

    @Mock
    private SupportTicketMapper supportTicketMapper;

    private TechSupportService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        service = new TechSupportService(supportTicketMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void detailShouldMapPriorityLabelsForKnownPriorities() {
        when(supportTicketMapper.selectByIdAndTenant("T001", 1L)).thenReturn(ticket(1L, "LOW", "OPEN"));
        when(supportTicketMapper.selectByIdAndTenant("T001", 2L)).thenReturn(ticket(2L, "NORMAL", "OPEN"));
        when(supportTicketMapper.selectByIdAndTenant("T001", 3L)).thenReturn(ticket(3L, "HIGH", "OPEN"));
        when(supportTicketMapper.selectByIdAndTenant("T001", 4L)).thenReturn(ticket(4L, "URGENT", "OPEN"));
        when(supportTicketMapper.selectByIdAndTenant("T001", 5L)).thenReturn(ticket(5L, null, "OPEN"));
        when(supportTicketMapper.selectByIdAndTenant("T001", 6L)).thenReturn(ticket(6L, "BIZARRE", "OPEN"));

        assertEquals("低", service.detail(1L).getPriorityLabel());
        assertEquals("普通", service.detail(2L).getPriorityLabel());
        assertEquals("高", service.detail(3L).getPriorityLabel());
        assertEquals("紧急", service.detail(4L).getPriorityLabel());
        // null / 未知 priority → 默认"普通"（NORMAL 语义）
        assertEquals("普通", service.detail(5L).getPriorityLabel());
        assertEquals("普通", service.detail(6L).getPriorityLabel());
    }

    @Test
    void detailShouldMapStatusLabelsForKnownStatuses() {
        when(supportTicketMapper.selectByIdAndTenant("T001", 1L)).thenReturn(ticket(1L, "NORMAL", "OPEN"));
        when(supportTicketMapper.selectByIdAndTenant("T001", 2L)).thenReturn(ticket(2L, "NORMAL", "IN_PROGRESS"));
        when(supportTicketMapper.selectByIdAndTenant("T001", 3L)).thenReturn(ticket(3L, "NORMAL", "RESOLVED"));
        when(supportTicketMapper.selectByIdAndTenant("T001", 4L)).thenReturn(ticket(4L, "NORMAL", "CLOSED"));
        when(supportTicketMapper.selectByIdAndTenant("T001", 5L)).thenReturn(ticket(5L, "NORMAL", null));
        when(supportTicketMapper.selectByIdAndTenant("T001", 6L)).thenReturn(ticket(6L, "NORMAL", "WEIRD"));

        assertEquals("待处理", service.detail(1L).getStatusLabel());
        assertEquals("处理中", service.detail(2L).getStatusLabel());
        assertEquals("已解决", service.detail(3L).getStatusLabel());
        assertEquals("已关闭", service.detail(4L).getStatusLabel());
        assertEquals("未知", service.detail(5L).getStatusLabel());
        // 未知 status 原样透传
        assertEquals("WEIRD", service.detail(6L).getStatusLabel());
    }

    @Test
    void detailShouldEnforceDiagnosticPackageMaskingDefaults() {
        // diagnosticPackageMasked: null 或 1 → true（默认脱敏，安全偏向）；0 → false
        SupportTicket attachedMasked = ticket(1L, "NORMAL", "OPEN");
        attachedMasked.setDiagnosticPackageAttached(1);
        attachedMasked.setDiagnosticPackageMasked(1);
        when(supportTicketMapper.selectByIdAndTenant("T001", 1L)).thenReturn(attachedMasked);

        SupportTicket maskedNull = ticket(2L, "NORMAL", "OPEN");
        maskedNull.setDiagnosticPackageMasked(null); // null → 默认脱敏
        when(supportTicketMapper.selectByIdAndTenant("T001", 2L)).thenReturn(maskedNull);

        SupportTicket unmasked = ticket(3L, "NORMAL", "OPEN");
        unmasked.setDiagnosticPackageAttached(0);
        unmasked.setDiagnosticPackageMasked(0);
        when(supportTicketMapper.selectByIdAndTenant("T001", 3L)).thenReturn(unmasked);

        SupportTicketDTO dto1 = service.detail(1L);
        assertTrue(dto1.getDiagnosticPackageAttached());
        assertTrue(dto1.getDiagnosticPackageMasked());

        assertTrue(service.detail(2L).getDiagnosticPackageMasked()); // null → 默认脱敏 true
        SupportTicketDTO dto3 = service.detail(3L);
        assertFalse(dto3.getDiagnosticPackageAttached());
        assertFalse(dto3.getDiagnosticPackageMasked());
    }

    @Test
    void detailShouldRejectInvalidIdWithoutTouchingMapper() {
        assertThrows(BusinessException.class, () -> service.detail(null));
        assertThrows(BusinessException.class, () -> service.detail(0L));
        assertThrows(BusinessException.class, () -> service.detail(-1L));
        verifyNoInteractions(supportTicketMapper);
    }

    @Test
    void detailShouldThrowBusinessExceptionWhenNotFound() {
        when(supportTicketMapper.selectByIdAndTenant("T001", 7L)).thenReturn(null);
        BusinessException ex = assertThrows(BusinessException.class, () -> service.detail(7L));
        assertEquals("技术支持工单不存在", ex.getMessage());
    }

    @Test
    void detailShouldFormatIsoTimestamps() {
        SupportTicket record = ticket(1L, "HIGH", "OPEN");
        record.setCreatedAt(LocalDateTime.of(2026, 7, 23, 9, 0));
        record.setUpdatedAt(LocalDateTime.of(2026, 7, 23, 11, 0));
        when(supportTicketMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        SupportTicketDTO dto = service.detail(1L);
        assertEquals("2026-07-23T09:00:00", dto.getCreatedAt());
        assertEquals("2026-07-23T11:00:00", dto.getUpdatedAt());
    }

    @Test
    void detailShouldNullSafeFormatWhenTimestampsAbsent() {
        SupportTicket record = ticket(1L, "NORMAL", "OPEN");
        when(supportTicketMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        SupportTicketDTO dto = service.detail(1L);
        assertNull(dto.getCreatedAt());
        assertNull(dto.getUpdatedAt());
    }

    @Test
    void listShouldClampPaginationBounds() {
        when(supportTicketMapper.count(eq("T001"), eq(null), eq(null), eq(null))).thenReturn(0L);
        when(supportTicketMapper.selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        SupportTicketDTO.PageResult result = service.list(null, null, null, 0, 0);
        assertEquals(0, result.getTotal());
        assertEquals(0, result.getRecords().size());
    }

    @Test
    void listShouldClampPageSizeTo100() {
        when(supportTicketMapper.count(eq("T001"), eq(null), eq(null), eq(null))).thenReturn(0L);
        when(supportTicketMapper.selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(100), eq(0)))
                .thenReturn(List.of());

        service.list(null, null, null, 1, 12345);
    }

    @Test
    void listShouldComputeOffsetFromSanitizedPage() {
        when(supportTicketMapper.count(eq("T001"), eq("OPEN"), eq("URGENT"), eq("超时"))).thenReturn(3L);
        when(supportTicketMapper.selectPage(eq("T001"), eq("OPEN"), eq("URGENT"), eq("超时"), eq(50), eq(50)))
                .thenReturn(List.of(ticket(1L, "URGENT", "OPEN")));

        SupportTicketDTO.PageResult result = service.list("OPEN", "URGENT", "超时", 2, 50);
        assertEquals(3, result.getTotal());
        assertEquals(1, result.getRecords().size());
        assertEquals("紧急", result.getRecords().get(0).getPriorityLabel());
    }

    @Test
    void listShouldPassTenantIdFromTenantContext() {
        when(supportTicketMapper.count(eq("T001"), eq(null), eq(null), eq(null))).thenReturn(0L);
        when(supportTicketMapper.selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        service.list(null, null, null, 1, 20);
        verify(supportTicketMapper).count(eq("T001"), eq(null), eq(null), eq(null));
        verify(supportTicketMapper).selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(20), eq(0));
    }

    @Test
    void listAndDetailShouldFailClosedWithoutTenant() {
        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(null, null, null, 1, 20));
        assertThrows(AccessDeniedException.class, () -> service.detail(1L));
        verifyNoInteractions(supportTicketMapper);
    }

    @Test
    void metaShouldAdvertisePrioritiesStatusesAndMaskingNotice() {
        SupportTicketDTO.Meta meta = service.meta();
        assertEquals(List.of("LOW", "NORMAL", "HIGH", "URGENT"), meta.getPriorities());
        assertEquals(List.of("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"), meta.getStatuses());
        assertTrue(meta.getReadOnlyNotice().contains("脱敏"));
    }

    private SupportTicket ticket(Long id, String priority, String status) {
        SupportTicket record = new SupportTicket();
        record.setId(id);
        record.setTenantId("T001");
        record.setTitle("工单#" + id);
        record.setPriority(priority);
        record.setStatus(status);
        return record;
    }
}
