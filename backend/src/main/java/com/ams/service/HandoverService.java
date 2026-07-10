package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.HandoverDTO;
import com.ams.entity.Handover;
import com.ams.mapper.HandoverMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 交接任务记录只读 catalog 服务。
 *
 * 提供交接任务列表、详情与元数据查询。全部只读，不发起/推进/取消交接。
 * 真实资产/工单/审批对象转移未闭环（P2 专项），本服务仅展示任务摘要与状态记录。
 */
@Service
@RequiredArgsConstructor
public class HandoverService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final HandoverMapper handoverMapper;

    public HandoverDTO.PageResult list(String status, String keyword, int page, int pageSize) {
        String tenantId = TenantContext.requireTenantId();
        int safePage = Math.max(page, 1);
        int safePageSize = pageSize <= 0 ? 20 : Math.min(pageSize, 100);
        int offset = (safePage - 1) * safePageSize;

        long total = handoverMapper.count(tenantId, trim(status), trim(keyword));
        List<Handover> records = handoverMapper.selectPage(tenantId, trim(status), trim(keyword), safePageSize, offset);

        HandoverDTO.PageResult result = new HandoverDTO.PageResult();
        result.setTotal(total);
        result.setRecords(records.stream().map(this::toDTO).toList());
        return result;
    }

    public HandoverDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("交接任务 ID 不合法");
        }
        Handover record = handoverMapper.selectByIdAndTenant(tenantId, id);
        if (record == null) {
            throw new BusinessException("交接任务不存在");
        }
        return toDTO(record);
    }

    public HandoverDTO.Meta meta() {
        HandoverDTO.Meta meta = new HandoverDTO.Meta();
        meta.setStatuses(List.of("PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"));
        meta.setReadOnlyNotice("交接管理为只读 catalog；发起、推进、取消交接等写操作不在 V3 只读边界内。真实资产/工单/审批对象转移未闭环，需后续专项处理。");
        return meta;
    }

    private HandoverDTO toDTO(Handover record) {
        HandoverDTO dto = new HandoverDTO();
        dto.setId(record.getId());
        dto.setTitle(record.getTitle());
        dto.setOutgoingUserId(record.getOutgoingUserId());
        dto.setOutgoingUserName(record.getOutgoingUserName());
        dto.setIncomingUserId(record.getIncomingUserId());
        dto.setIncomingUserName(record.getIncomingUserName());
        dto.setStatus(record.getStatus());
        dto.setStatusLabel(statusLabel(record.getStatus()));
        dto.setAssetCount(record.getAssetCount());
        dto.setWorkorderCount(record.getWorkorderCount());
        dto.setApprovalCount(record.getApprovalCount());
        dto.setSummary(record.getSummary());
        dto.setRiskNote(record.getRiskNote());
        dto.setCreatedAt(record.getCreatedAt() != null ? record.getCreatedAt().format(ISO) : null);
        dto.setUpdatedAt(record.getUpdatedAt() != null ? record.getUpdatedAt().format(ISO) : null);
        return dto;
    }

    private String statusLabel(String status) {
        if (status == null) return "未知";
        return switch (status.toUpperCase()) {
            case "PENDING" -> "待交接";
            case "IN_PROGRESS" -> "交接中";
            case "COMPLETED" -> "已完成";
            case "CANCELLED" -> "已取消";
            default -> status;
        };
    }

    private String trim(String value) {
        return value == null ? null : value.trim().isEmpty() ? null : value.trim();
    }
}
