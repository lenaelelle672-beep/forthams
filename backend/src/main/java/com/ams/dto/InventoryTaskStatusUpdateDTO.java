package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class InventoryTaskStatusUpdateDTO {

    @NotBlank(message = "盘点任务状态不能为空")
    @Pattern(regexp = "(?i)DRAFT|IN_PROGRESS|COMPLETED|APPROVED|CANCELLED",
            message = "盘点任务状态不合法")
    private String status;
}
