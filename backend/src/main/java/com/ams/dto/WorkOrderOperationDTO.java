package com.ams.dto;

import com.ams.enums.WorkOrderOperation;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class WorkOrderOperationDTO {

    @NotNull(message = "工单操作不能为空")
    private WorkOrderOperation operation;

    @Size(max = 1000, message = "工单备注长度不能超过1000个字符")
    private String comment;
}
