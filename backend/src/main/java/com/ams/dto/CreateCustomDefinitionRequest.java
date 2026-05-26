package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateCustomDefinitionRequest {

    @NotBlank(message = "流程类型不能为空")
    @Size(max = 64, message = "流程类型最长64字符")
    @Pattern(regexp = "^CUSTOM_[a-zA-Z][a-zA-Z0-9_]{1,62}$", message = "流程类型必须以 CUSTOM_ 开头，后跟英文名（字母开头，允许字母数字下划线）")
    private String businessType;

    @NotBlank(message = "流程名称不能为空")
    @Size(max = 100, message = "流程名称最长100字符")
    private String name;

    @Size(max = 500, message = "流程描述最长500字符")
    private String description;

    /** 操作人ID，由后端从安全上下文获取后注入 */
    private Long operatorId;
}
