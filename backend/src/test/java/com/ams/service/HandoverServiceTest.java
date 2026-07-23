package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.HandoverDTO;
import com.ams.entity.Handover;
import com.ams.mapper.HandoverMapper;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** 交接任务记录只读 catalog 服务测试。覆盖状态映射、详情校验、分页边界与租户隔离。 */
@ExtendWith(MockitoExtension.class)
class HandoverServiceTest {

    @Mock
    private HandoverMapper handoverMapper;

    private HandoverService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        service = new HandoverService(handoverMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void detailShouldMapStatusLabelForKnownStatuses() {
        when(handoverMapper.selectByIdAndTenant("T001", 1L)).thenReturn(handover(1L, "PENDING"));
        when(handoverMapper.selectByIdAndTenant("T001", 2L)).thenReturn(handover(2L, "IN_PROGRESS"));
        when(handoverMapper.selectByIdAndTenant("T001", 3L)).thenReturn(handover(3L, "COMPLETED"));
        when(handoverMapper.selectByIdAndTenant("T001", 4L)).thenReturn(handover(4L, "CANCELLED"));
        when(handoverMapper.selectByIdAndTenant("T001", 5L)).thenReturn(handover(5L, null));
        when(handoverMapper.selectByIdAndTenant("T001", 6L)).thenReturn(handover(6L, "WEIRD"));

        assertEquals("待交接", service.detail(1L).getStatusLabel());
        assertEquals("交接中", service.detail(2L).getStatusLabel());
        assertEquals("已完成", service.detail(3L).getStatusLabel());
        assertEquals("已取消", service.detail(4L).getStatusLabel());
        assertEquals("未知", service.detail(5L).getStatusLabel());
        // 未知状态值原样透传（statusLabel 的 default 分支返回原值）
        assertEquals("WEIRD", service.detail(6L).getStatusLabel());
    }

    @Test
    void detailShouldRejectInvalidIdWithoutTouchingMapper() {
        // id 非法时不查 mapper（fail-closed），并抛业务异常
        assertThrows(BusinessException.class, () -> service.detail(null));
        assertThrows(BusinessException.class, () -> service.detail(0L));
        assertThrows(BusinessException.class, () -> service.detail(-1L));
        verifyNoInteractions(handoverMapper);
    }

    @Test
    void detailShouldThrowBusinessExceptionWhenNotFound() {
        when(handoverMapper.selectByIdAndTenant("T001", 7L)).thenReturn(null);
        BusinessException ex = assertThrows(BusinessException.class, () -> service.detail(7L));
        assertEquals("交接任务不存在", ex.getMessage());
    }

    @Test
    void detailShouldFormatIsoTimestampsAndPreserveCounts() {
        Handover record = handover(1L, "PENDING");
        record.setAssetCount(3);
        record.setWorkorderCount(2);
        record.setApprovalCount(1);
        record.setCreatedAt(LocalDateTime.of(2026, 7, 23, 9, 0));
        record.setUpdatedAt(LocalDateTime.of(2026, 7, 23, 10, 30));
        when(handoverMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        HandoverDTO dto = service.detail(1L);
        assertEquals(3, dto.getAssetCount());
        assertEquals(2, dto.getWorkorderCount());
        assertEquals(1, dto.getApprovalCount());
        assertEquals("2026-07-23T09:00:00", dto.getCreatedAt());
        assertEquals("2026-07-23T10:30:00", dto.getUpdatedAt());
    }

    @Test
    void detailShouldNullSafeFormatWhenTimestampsAbsent() {
        Handover record = handover(1L, "PENDING");
        record.setCreatedAt(null);
        record.setUpdatedAt(null);
        when(handoverMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        HandoverDTO dto = service.detail(1L);
        assertNull(dto.getCreatedAt());
        assertNull(dto.getUpdatedAt());
    }

    @Test
    void listShouldClampPaginationBounds() {
        when(handoverMapper.count(eq("T001"), eq(null), eq(null))).thenReturn(0L);
        when(handoverMapper.selectPage(eq("T001"), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        // page<=0 → 视作第 1 页（offset 0）；pageSize<=0 → 默认 20
        HandoverDTO.PageResult result = service.list(null, null, 0, 0);
        assertEquals(0, result.getTotal());
        assertEquals(0, result.getRecords().size());
    }

    @Test
    void listShouldClampPageSizeTo100() {
        when(handoverMapper.count(eq("T001"), eq(null), eq(null))).thenReturn(0L);
        when(handoverMapper.selectPage(eq("T001"), eq(null), eq(null), eq(100), eq(0)))
                .thenReturn(List.of());

        // pageSize>100 → 截断为 100；page<=0 → offset 0
        HandoverDTO.PageResult result = service.list(null, null, -3, 5000);
        assertEquals(0, result.getRecords().size());
    }

    @Test
    void listShouldComputeOffsetFromSanitizedPage() {
        when(handoverMapper.count(eq("T001"), eq("PENDING"), eq("钥匙"))).thenReturn(42L);
        when(handoverMapper.selectPage(eq("T001"), eq("PENDING"), eq("钥匙"), eq(20), eq(20)))
                .thenReturn(List.of(handover(1L, "PENDING")));

        // page=2, pageSize=20 → offset=(2-1)*20=20
        HandoverDTO.PageResult result = service.list("PENDING", "钥匙", 2, 20);
        assertEquals(42, result.getTotal());
        assertEquals(1, result.getRecords().size());
        assertEquals("待交接", result.getRecords().get(0).getStatusLabel());
    }

    @Test
    void listShouldPassTenantIdFromTenantContext() {
        when(handoverMapper.count(eq("T001"), eq(null), eq(null))).thenReturn(0L);
        when(handoverMapper.selectPage(eq("T001"), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        service.list(null, null, 1, 20);
        // TenantContext 注入的 T001 必须穿透到 mapper（租户隔离）
        org.mockito.Mockito.verify(handoverMapper).count(eq("T001"), eq(null), eq(null));
        org.mockito.Mockito.verify(handoverMapper).selectPage(eq("T001"), eq(null), eq(null), eq(20), eq(0));
    }

    @Test
    void listAndDetailShouldFailClosedWithoutTenant() {
        TenantContext.clear();
        // 无租户上下文 → AccessDeniedException，且不触碰 mapper
        assertThrows(AccessDeniedException.class, () -> service.list(null, null, 1, 20));
        assertThrows(AccessDeniedException.class, () -> service.detail(1L));
        verifyNoInteractions(handoverMapper);
    }

    @Test
    void metaShouldAdvertiseStatusesAndReadOnlyBoundary() {
        HandoverDTO.Meta meta = service.meta();
        assertEquals(List.of("PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"), meta.getStatuses());
        assertTrue(meta.getReadOnlyNotice().contains("只读 catalog"));
    }

    private Handover handover(Long id, String status) {
        Handover record = new Handover();
        record.setId(id);
        record.setTenantId("T001");
        record.setTitle("交接任务#" + id);
        record.setStatus(status);
        return record;
    }
}
