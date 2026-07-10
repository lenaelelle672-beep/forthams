package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkflowMailConfigDTO;
import com.ams.entity.WorkflowMailConfig;
import com.ams.mapper.WorkflowMailConfigMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 流程节点邮件配置只读 catalog 服务。
 * 全部只读，不实现真实邮件发送（P2 专项）。标注零业务调用风险。
 */
@Service
@RequiredArgsConstructor
public class WorkflowMailConfigService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final WorkflowMailConfigMapper workflowMailConfigMapper;

    public WorkflowMailConfigDTO.PageResult list(String businessType, Integer enabled, int page, int pageSize) {
        String tenantId = TenantContext.requireTenantId();
        int safePage = Math.max(page, 1);
        int safePageSize = pageSize <= 0 ? 20 : Math.min(pageSize, 100);
        int offset = (safePage - 1) * safePageSize;

        long total = workflowMailConfigMapper.count(tenantId, trim(businessType), enabled);
        List<WorkflowMailConfig> records = workflowMailConfigMapper.selectPage(tenantId, trim(businessType), enabled, safePageSize, offset);

        WorkflowMailConfigDTO.PageResult result = new WorkflowMailConfigDTO.PageResult();
        result.setTotal(total);
        result.setRecords(records.stream().map(this::toDTO).toList());
        return result;
    }

    public WorkflowMailConfigDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("配置 ID 不合法");
        }
        WorkflowMailConfig record = workflowMailConfigMapper.selectByIdAndTenant(tenantId, id);
        if (record == null) {
            throw new BusinessException("流程邮件配置不存在");
        }
        return toDTO(record);
    }

    public WorkflowMailConfigDTO.Meta meta() {
        WorkflowMailConfigDTO.Meta meta = new WorkflowMailConfigDTO.Meta();
        meta.setTriggerEvents(List.of("ON_APPROVAL", "ON_COMPLETE", "ON_REJECT", "ON_TIMEOUT"));
        meta.setRecipientScopes(List.of("APPLICANT", "APPROVER", "CC_ROLE"));
        meta.setReadOnlyNotice("流程邮件配置为只读 catalog；新增、编辑、删除、测试发送等写操作不在 V3 只读边界内。真实邮件发送未接入流程平台，存在零业务调用风险。");
        return meta;
    }

    private WorkflowMailConfigDTO toDTO(WorkflowMailConfig record) {
        WorkflowMailConfigDTO dto = new WorkflowMailConfigDTO();
        dto.setId(record.getId());
        dto.setBusinessType(record.getBusinessType());
        dto.setNodeKey(record.getNodeKey());
        dto.setNodeName(record.getNodeName());
        dto.setTriggerEvent(record.getTriggerEvent());
        dto.setTriggerEventLabel(triggerLabel(record.getTriggerEvent()));
        dto.setTemplateCode(record.getTemplateCode());
        dto.setEnabled(record.getEnabled() != null && record.getEnabled() == 1);
        dto.setRecipientScope(record.getRecipientScope());
        dto.setRecipientScopeLabel(recipientLabel(record.getRecipientScope()));
        dto.setRiskNote(record.getRiskNote());
        dto.setCreatedAt(record.getCreatedAt() != null ? record.getCreatedAt().format(ISO) : null);
        return dto;
    }

    private String triggerLabel(String event) {
        if (event == null) return "未知";
        return switch (event.toUpperCase()) {
            case "ON_APPROVAL" -> "审批时";
            case "ON_COMPLETE" -> "完成时";
            case "ON_REJECT" -> "驳回时";
            case "ON_TIMEOUT" -> "超时时";
            default -> event;
        };
    }

    private String recipientLabel(String scope) {
        if (scope == null) return "未知";
        return switch (scope.toUpperCase()) {
            case "APPLICANT" -> "申请人";
            case "APPROVER" -> "审批人";
            case "CC_ROLE" -> "抄送角色";
            default -> scope;
        };
    }

    private String trim(String value) {
        return value == null ? null : value.trim().isEmpty() ? null : value.trim();
    }
}
