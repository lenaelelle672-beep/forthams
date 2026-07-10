package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 流程节点邮件配置只读 catalog DTO。
 * 只读：不提供新增/编辑/删除/测试发送（V3 只读边界）。真实邮件发送未接入。
 */
@Data
public class WorkflowMailConfigDTO {
    private Long id;
    private String businessType;
    private String nodeKey;
    private String nodeName;
    private String triggerEvent;
    private String triggerEventLabel;
    private String templateCode;
    private Boolean enabled;
    private String recipientScope;
    private String recipientScopeLabel;
    private String riskNote;
    private String createdAt;

    @Data
    public static class PageResult {
        private List<WorkflowMailConfigDTO> records = new ArrayList<>();
        private long total;
    }

    @Data
    public static class Meta {
        private List<String> triggerEvents = new ArrayList<>();
        private List<String> recipientScopes = new ArrayList<>();
        private String readOnlyNotice;
    }
}
