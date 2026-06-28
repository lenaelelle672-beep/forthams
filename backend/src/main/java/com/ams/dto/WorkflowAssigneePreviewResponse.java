package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
public class WorkflowAssigneePreviewResponse {

    private String businessType;
    private boolean calculable;
    private String reason;
    private List<String> missingFields = List.of();
    private List<NodeAssigneePreview> nodes = List.of();

    public static WorkflowAssigneePreviewResponse unresolved(String businessType, String reason, List<String> missingFields) {
        WorkflowAssigneePreviewResponse response = new WorkflowAssigneePreviewResponse();
        response.setBusinessType(businessType);
        response.setCalculable(false);
        response.setReason(reason);
        response.setMissingFields(missingFields == null ? List.of() : List.copyOf(missingFields));
        response.setNodes(List.of());
        return response;
    }

    @Data
    public static class NodeAssigneePreview {
        private int stepNo;
        private String nodeId;
        private String nodeCode;
        private String label;
        private String approverType;
        private String approverRole;
        private String approverId;
        private boolean resolved;
        private int assigneeCount;
        private String reason;
        private List<Assignee> assignees = List.of();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Assignee {
        private String userId;
    }
}
