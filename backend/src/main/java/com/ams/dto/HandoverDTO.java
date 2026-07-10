package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 交接任务记录只读 catalog DTO。
 *
 * 只读：不提供发起/推进/取消交接的写操作（V3 只读边界）。
 * 人员姓名与摘要已脱敏。真实资产/工单/审批对象转移未闭环（风险提示）。
 */
@Data
public class HandoverDTO {
    private Long id;
    private String title;
    private Long outgoingUserId;
    private String outgoingUserName;
    private Long incomingUserId;
    private String incomingUserName;
    private String status;
    private String statusLabel;
    private Integer assetCount;
    private Integer workorderCount;
    private Integer approvalCount;
    private String summary;
    private String riskNote;
    private String createdAt;
    private String updatedAt;

    @Data
    public static class PageResult {
        private List<HandoverDTO> records = new ArrayList<>();
        private long total;
    }

    @Data
    public static class Meta {
        private List<String> statuses = new ArrayList<>();
        private String readOnlyNotice;
    }
}
