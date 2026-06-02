package com.ams.dto;

import lombok.Data;

/**
 * 邮件模板更新 DTO
 */
@Data
public class MailTemplateUpdateDTO {

    private String templateName;

    private String category;

    private String subjectTemplate;

    private String contentTemplate;

    private String contentType;

    /** 变量定义 JSON */
    private String variables;

    private Integer status;
}
