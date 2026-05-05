package com.ams.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
public class WorkOrderDTO {
    private Long id;
    private String workOrderNo;
    private String title;
    private String description;
    private String status;
    private String priority;
    private Long assetId;
    private String assetName;
    private String assetCode;
    private Long reporterId;
    private String reporterName;
    private Long assigneeId;
    private String assigneeName;
    private Long deptId;
    private String deptName;
    private LocalDateTime plannedStartDate;
    private LocalDateTime plannedEndDate;
    private LocalDateTime actualStartDate;
    private LocalDateTime actualEndDate;
    private BigDecimal estimatedCost;
    private BigDecimal actualCost;
    private String completionNote;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public WorkOrderDTO(Long id, String status) {
        this.id = id;
        this.status = status;
    }
}
