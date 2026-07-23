package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 流程处理人预览请求与响应 DTO。
 * 字段与前端 WorkflowAssigneePreviewRequest / WorkflowAssigneePreviewResponse 对齐。
 */
@Data
public class WorkflowAssigneePreviewDTO {

    @Data
    public static class Request {
        private Map<String, Object> definition;
        private Object businessData;
    }

    @Data
    public static class Response {
        private String businessType;
        private boolean calculable;
        private String reason;
        private List<String> missingFields = new ArrayList<>();
        private List<NodeAssignee> nodes = new ArrayList<>();
    }

    @Data
    public static class NodeAssignee {
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
        private List<Assignee> assignees = new ArrayList<>();
    }

    @Data
    public static class Assignee {
        private String userId;

        public Assignee() {}

        public Assignee(String userId) {
            this.userId = userId;
        }
    }
}
