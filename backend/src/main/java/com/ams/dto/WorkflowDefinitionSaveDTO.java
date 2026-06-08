package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class WorkflowDefinitionSaveDTO {
    @NotBlank(message = "流程名称不能为空")
    @Size(max = 100, message = "流程名称最长100字符")
    private String name;

    @Size(max = 500, message = "流程描述最长500字符")
    private String description;

    @NotNull(message = "流程定义不能为空")
    private Map<String, Object> definition;

    /** @deprecated 操作人ID已改为从JWT安全上下文获取，此字段将被忽略 */
    @Deprecated
    @JsonIgnore
    private Long operatorId;
}
