package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BpmMailVariableCreateDTO {

    @NotBlank(message = "变量KEY不能为空")
    private String varKey;

    @NotBlank(message = "变量名称不能为空")
    private String varName;

    private String defaultValue;

    private String remark;
}
