package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ImportExportTaskDTO;
import com.ams.entity.ImportExportTask;
import com.ams.mapper.ImportExportTaskMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 导入导出任务记录只读 catalog 服务。
 *
 * 提供任务历史列表、详情与元数据查询。全部只读，不执行导入/导出。
 * 查询带租户隔离（TenantContext.requireTenantId）。
 */
@Service
@RequiredArgsConstructor
public class ImportExportTaskService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final ImportExportTaskMapper importExportTaskMapper;

    public ImportExportTaskDTO.PageResult list(String taskType, String businessObject, String status, int page, int pageSize) {
        String tenantId = TenantContext.requireTenantId();
        int safePage = Math.max(page, 1);
        int safePageSize = pageSize <= 0 ? 20 : Math.min(pageSize, 100);
        int offset = (safePage - 1) * safePageSize;

        long total = importExportTaskMapper.count(tenantId, trim(taskType), trim(businessObject), trim(status));
        List<ImportExportTask> tasks = importExportTaskMapper.selectPage(
                tenantId, trim(taskType), trim(businessObject), trim(status), safePageSize, offset);

        ImportExportTaskDTO.PageResult result = new ImportExportTaskDTO.PageResult();
        result.setTotal(total);
        result.setRecords(tasks.stream().map(this::toDTO).toList());
        return result;
    }

    public ImportExportTaskDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("任务 ID 不合法");
        }
        ImportExportTask task = importExportTaskMapper.selectByIdAndTenant(tenantId, id);
        if (task == null) {
            throw new BusinessException("导入导出任务不存在");
        }
        return toDTO(task);
    }

    public ImportExportTaskDTO.Meta meta() {
        ImportExportTaskDTO.Meta meta = new ImportExportTaskDTO.Meta();
        meta.setSupportedObjects(List.of("asset", "dept", "user", "vendor"));
        meta.setSupportedFormats(List.of("XLSX", "CSV"));
        meta.setStatuses(List.of("PENDING", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"));
        meta.setImportRowLimit(5000);
        meta.setExportRowLimit(50000);
        meta.setReadOnlyNotice("导入导出为只读 catalog；执行导入、导出、重试、取消等写操作不在 V3 只读边界内，导出文件已脱敏。");
        return meta;
    }

    private ImportExportTaskDTO toDTO(ImportExportTask task) {
        ImportExportTaskDTO dto = new ImportExportTaskDTO();
        dto.setId(task.getId());
        dto.setTaskType(task.getTaskType());
        dto.setBusinessObject(task.getBusinessObject());
        dto.setFileFormat(task.getFileFormat());
        dto.setStatus(task.getStatus());
        dto.setTotalRows(task.getTotalRows());
        dto.setSuccessRows(task.getSuccessRows());
        dto.setFailedRows(task.getFailedRows());
        dto.setOperatorId(task.getOperatorId());
        dto.setOperatorName(task.getOperatorName());
        dto.setErrorSummary(task.getErrorSummary());
        dto.setStartedAt(task.getStartedAt() != null ? task.getStartedAt().format(ISO) : null);
        dto.setFinishedAt(task.getFinishedAt() != null ? task.getFinishedAt().format(ISO) : null);
        dto.setCreatedAt(task.getCreatedAt() != null ? task.getCreatedAt().format(ISO) : null);
        return dto;
    }

    private String trim(String value) {
        return value == null ? null : value.trim().isEmpty() ? null : value.trim();
    }
}
