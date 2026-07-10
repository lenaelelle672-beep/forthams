package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SupportTicketDTO;
import com.ams.entity.SupportTicket;
import com.ams.mapper.SupportTicketMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;

/** 技术支持工单只读 catalog 服务。诊断包强制脱敏，禁止导出敏感配置原值。 */
@Service
@RequiredArgsConstructor
public class TechSupportService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final SupportTicketMapper supportTicketMapper;

    public SupportTicketDTO.PageResult list(String status, String priority, String keyword, int page, int pageSize) {
        String tenantId = TenantContext.requireTenantId();
        int safePage = Math.max(page, 1);
        int safePageSize = pageSize <= 0 ? 20 : Math.min(pageSize, 100);
        int offset = (safePage - 1) * safePageSize;

        long total = supportTicketMapper.count(tenantId, trim(status), trim(priority), trim(keyword));
        List<SupportTicket> records = supportTicketMapper.selectPage(tenantId, trim(status), trim(priority), trim(keyword), safePageSize, offset);

        SupportTicketDTO.PageResult result = new SupportTicketDTO.PageResult();
        result.setTotal(total);
        result.setRecords(records.stream().map(this::toDTO).toList());
        return result;
    }

    public SupportTicketDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("工单 ID 不合法");
        }
        SupportTicket record = supportTicketMapper.selectByIdAndTenant(tenantId, id);
        if (record == null) {
            throw new BusinessException("技术支持工单不存在");
        }
        return toDTO(record);
    }

    public SupportTicketDTO.Meta meta() {
        SupportTicketDTO.Meta meta = new SupportTicketDTO.Meta();
        meta.setPriorities(List.of("LOW", "NORMAL", "HIGH", "URGENT"));
        meta.setStatuses(List.of("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"));
        meta.setReadOnlyNotice("技术支持为只读 catalog；创建、分配、处理、关闭工单与导出诊断包等写操作不在 V3 只读边界内。诊断包必须脱敏，禁止导出敏感配置原值。");
        return meta;
    }

    private SupportTicketDTO toDTO(SupportTicket record) {
        SupportTicketDTO dto = new SupportTicketDTO();
        dto.setId(record.getId());
        dto.setTitle(record.getTitle());
        dto.setCategory(record.getCategory());
        dto.setPriority(record.getPriority());
        dto.setPriorityLabel(priorityLabel(record.getPriority()));
        dto.setStatus(record.getStatus());
        dto.setStatusLabel(statusLabel(record.getStatus()));
        dto.setRequesterName(record.getRequesterName());
        dto.setAssigneeName(record.getAssigneeName());
        dto.setDiagnosticPackageAttached(record.getDiagnosticPackageAttached() != null && record.getDiagnosticPackageAttached() == 1);
        dto.setDiagnosticPackageMasked(record.getDiagnosticPackageMasked() == null || record.getDiagnosticPackageMasked() == 1);
        dto.setSummary(record.getSummary());
        dto.setCreatedAt(record.getCreatedAt() != null ? record.getCreatedAt().format(ISO) : null);
        dto.setUpdatedAt(record.getUpdatedAt() != null ? record.getUpdatedAt().format(ISO) : null);
        return dto;
    }

    private String priorityLabel(String priority) {
        if (priority == null) return "普通";
        return switch (priority.toUpperCase()) {
            case "LOW" -> "低";
            case "HIGH" -> "高";
            case "URGENT" -> "紧急";
            default -> "普通";
        };
    }

    private String statusLabel(String status) {
        if (status == null) return "未知";
        return switch (status.toUpperCase()) {
            case "OPEN" -> "待处理";
            case "IN_PROGRESS" -> "处理中";
            case "RESOLVED" -> "已解决";
            case "CLOSED" -> "已关闭";
            default -> status;
        };
    }

    private String trim(String value) {
        return value == null ? null : value.trim().isEmpty() ? null : value.trim();
    }
}
