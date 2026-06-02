package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BpmMailConfigCreateDTO {

    @NotBlank(message = "流程类型不能为空")
    private String processType;

    private String processName;

    private String nodeId;

    private String nodeName;

    private String subjectTemplate;

    private String contentTemplate;

    private String toRecipients;

    private String ccRecipients;

    private Integer enabled;

    private String remark;
}
