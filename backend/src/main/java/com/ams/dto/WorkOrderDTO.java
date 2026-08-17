package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
public class WorkOrderDTO {
    private Long id;
    private String workOrderNo;
    @NotBlank(message = "工单标题不能为空")
    @Size(max = 256, message = "工单标题长度不能超过256个字符")
    private String title;
    @Size(max = 4000, message = "工单说明长度不能超过4000个字符")
    private String description;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private String status;
    @Size(max = 32, message = "工单优先级长度不能超过32个字符")
    private String priority;
    @Positive(message = "资产ID必须为正数")
    private Long assetId;
    private String assetName;
    private String assetCode;
    private Long reporterId;
    private String reporterName;
    @Positive(message = "工单处理人ID必须为正数")
    private Long assigneeId;
    private String assigneeName;
    @Positive(message = "工单部门ID必须为正数")
    private Long deptId;
    private String deptName;
    private LocalDateTime plannedStartDate;
    private LocalDateTime plannedEndDate;
    private LocalDateTime actualStartDate;
    private LocalDateTime actualEndDate;
    @DecimalMin(value = "0.00", message = "预计费用不能为负数")
    @Digits(integer = 13, fraction = 2, message = "预计费用最多13位整数和2位小数")
    private BigDecimal estimatedCost;
    @DecimalMin(value = "0.00", message = "实际费用不能为负数")
    @Digits(integer = 13, fraction = 2, message = "实际费用最多13位整数和2位小数")
    private BigDecimal actualCost;
    @Size(max = 1000, message = "完成说明长度不能超过1000个字符")
    private String completionNote;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public WorkOrderDTO(Long id, String status) {
        this.id = id;
        this.status = status;
    }
}
