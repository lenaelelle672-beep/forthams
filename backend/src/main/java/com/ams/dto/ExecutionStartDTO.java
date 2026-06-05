package com.ams.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 开始施工请求 DTO。
 */
@Data
public class ExecutionStartDTO {

    @NotNull(message = "维保记录ID不能为空")
    private Long maintenanceRecordId;

    @NotNull(message = "工单ID不能为空")
    private Long workOrderId;

    private Long assigneeId;

    private String assigneeName;

    private String remark;
}
