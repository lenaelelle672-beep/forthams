package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class WorkflowStatusUpdateDTO {
    @NotBlank(message = "状态不能为空")
    @Pattern(regexp = "ENABLED|DISABLED", message = "状态仅支持 ENABLED 或 DISABLED")
    private String status;

    /** @deprecated 操作人ID已改为从JWT安全上下文获取，此字段将被忽略 */
    @Deprecated
    @JsonIgnore
    private Long operatorId;
}
