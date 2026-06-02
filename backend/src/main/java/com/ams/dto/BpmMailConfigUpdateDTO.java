package com.ams.dto;

import lombok.Data;

@Data
public class BpmMailConfigUpdateDTO {

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
