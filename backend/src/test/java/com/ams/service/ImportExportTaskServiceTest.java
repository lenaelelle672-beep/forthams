package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ImportExportTaskDTO;
import com.ams.entity.ImportExportTask;
import com.ams.mapper.ImportExportTaskMapper;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 导入导出任务记录只读 catalog 服务测试。
 * 覆盖详情校验、分页边界、状态透传、时间格式化与租户隔离。
 */
@ExtendWith(MockitoExtension.class)
class ImportExportTaskServiceTest {

    @Mock
    private ImportExportTaskMapper importExportTaskMapper;

    private ImportExportTaskService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        service = new ImportExportTaskService(importExportTaskMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void detailShouldPassThroughStatusAndCountsForKnownStates() {
        when(importExportTaskMapper.selectByIdAndTenant("T001", 1L)).thenReturn(task(1L, "IMPORT", "asset", "SUCCESS"));
        when(importExportTaskMapper.selectByIdAndTenant("T001", 2L)).thenReturn(task(2L, "EXPORT", "user", "FAILED"));
        when(importExportTaskMapper.selectByIdAndTenant("T001", 3L)).thenReturn(task(3L, "IMPORT", "dept", "CANCELLED"));

        // ImportExportTaskDTO 无 statusLabel 字段，status 原样透传（meta().statuses 给前端映射）
        assertEquals("SUCCESS", service.detail(1L).getStatus());
        assertEquals("FAILED", service.detail(2L).getStatus());
        assertEquals("CANCELLED", service.detail(3L).getStatus());
    }

    @Test
    void detailShouldRejectInvalidIdWithoutTouchingMapper() {
        assertThrows(BusinessException.class, () -> service.detail(null));
        assertThrows(BusinessException.class, () -> service.detail(0L));
        assertThrows(BusinessException.class, () -> service.detail(-9L));
        verifyNoInteractions(importExportTaskMapper);
    }

    @Test
    void detailShouldThrowBusinessExceptionWhenNotFound() {
        when(importExportTaskMapper.selectByIdAndTenant("T001", 7L)).thenReturn(null);
        BusinessException ex = assertThrows(BusinessException.class, () -> service.detail(7L));
        assertEquals("导入导出任务不存在", ex.getMessage());
    }

    @Test
    void detailShouldFormatIsoTimestampsAndPreserveRowCounts() {
        ImportExportTask record = task(1L, "EXPORT", "asset", "SUCCESS");
        record.setTotalRows(1000);
        record.setSuccessRows(980);
        record.setFailedRows(20);
        record.setOperatorId(42L);
        record.setOperatorName("张三");
        record.setErrorSummary("[已脱敏]");
        record.setStartedAt(LocalDateTime.of(2026, 7, 23, 8, 0));
        record.setFinishedAt(LocalDateTime.of(2026, 7, 23, 8, 5));
        record.setCreatedAt(LocalDateTime.of(2026, 7, 23, 8, 0));
        when(importExportTaskMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        ImportExportTaskDTO dto = service.detail(1L);
        assertEquals(1000, dto.getTotalRows());
        assertEquals(980, dto.getSuccessRows());
        assertEquals(20, dto.getFailedRows());
        assertEquals(42L, dto.getOperatorId());
        assertEquals("张三", dto.getOperatorName());
        assertEquals("2026-07-23T08:00:00", dto.getStartedAt());
        assertEquals("2026-07-23T08:05:00", dto.getFinishedAt());
        assertEquals("2026-07-23T08:00:00", dto.getCreatedAt());
    }

    @Test
    void detailShouldNullSafeFormatWhenTimestampsAbsent() {
        ImportExportTask record = task(1L, "IMPORT", "asset", "PENDING");
        when(importExportTaskMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        ImportExportTaskDTO dto = service.detail(1L);
        assertNull(dto.getStartedAt());
        assertNull(dto.getFinishedAt());
        assertNull(dto.getCreatedAt());
    }

    @Test
    void listShouldClampPaginationBounds() {
        when(importExportTaskMapper.count(eq("T001"), eq(null), eq(null), eq(null))).thenReturn(0L);
        when(importExportTaskMapper.selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        // page<=0 → offset 0；pageSize<=0 → 20
        ImportExportTaskDTO.PageResult result = service.list(null, null, null, 0, 0);
        assertEquals(0, result.getTotal());
        assertEquals(0, result.getRecords().size());
    }

    @Test
    void listShouldClampPageSizeTo100() {
        when(importExportTaskMapper.count(eq("T001"), eq(null), eq(null), eq(null))).thenReturn(0L);
        when(importExportTaskMapper.selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(100), eq(0)))
                .thenReturn(List.of());

        // pageSize>100 → 100
        service.list(null, null, null, 1, 999);
    }

    @Test
    void listShouldComputeOffsetFromSanitizedPage() {
        when(importExportTaskMapper.count(eq("T001"), eq("IMPORT"), eq("asset"), eq("RUNNING"))).thenReturn(5L);
        when(importExportTaskMapper.selectPage(eq("T001"), eq("IMPORT"), eq("asset"), eq("RUNNING"), eq(20), eq(40)))
                .thenReturn(List.of(task(1L, "IMPORT", "asset", "RUNNING")));

        // page=3, pageSize=20 → offset=(3-1)*20=40
        ImportExportTaskDTO.PageResult result = service.list("IMPORT", "asset", "RUNNING", 3, 20);
        assertEquals(5, result.getTotal());
        assertEquals(1, result.getRecords().size());
        assertEquals("RUNNING", result.getRecords().get(0).getStatus());
    }

    @Test
    void listShouldPassTenantIdFromTenantContext() {
        when(importExportTaskMapper.count(eq("T001"), eq(null), eq(null), eq(null))).thenReturn(0L);
        when(importExportTaskMapper.selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        service.list(null, null, null, 1, 20);
        verify(importExportTaskMapper).count(eq("T001"), eq(null), eq(null), eq(null));
        verify(importExportTaskMapper).selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(20), eq(0));
    }

    @Test
    void listAndDetailShouldFailClosedWithoutTenant() {
        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(null, null, null, 1, 20));
        assertThrows(AccessDeniedException.class, () -> service.detail(1L));
        verifyNoInteractions(importExportTaskMapper);
    }

    @Test
    void metaShouldAdvertiseSupportedObjectsFormatsStatusesAndRowLimits() {
        ImportExportTaskDTO.Meta meta = service.meta();
        assertEquals(List.of("asset", "dept", "user", "vendor"), meta.getSupportedObjects());
        assertEquals(List.of("XLSX", "CSV"), meta.getSupportedFormats());
        assertEquals(List.of("PENDING", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"), meta.getStatuses());
        assertEquals(5000, meta.getImportRowLimit());
        assertEquals(50000, meta.getExportRowLimit());
        assertTrue(meta.getReadOnlyNotice().contains("只读 catalog"));
    }

    private ImportExportTask task(Long id, String taskType, String businessObject, String status) {
        ImportExportTask task = new ImportExportTask();
        task.setId(id);
        task.setTenantId("T001");
        task.setTaskType(taskType);
        task.setBusinessObject(businessObject);
        task.setFileFormat("XLSX");
        task.setStatus(status);
        return task;
    }
}
