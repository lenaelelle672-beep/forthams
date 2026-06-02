package com.ams.dto;

import lombok.Data;

@Data
public class BpmMailVariableUpdateDTO {

    private String varName;

    private String defaultValue;

    private String remark;
}
