package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 邮件模板创建 DTO
 */
@Data
public class MailTemplateCreateDTO {

    @NotBlank(message = "模板编码不能为空")
    private String templateCode;

    @NotBlank(message = "模板名称不能为空")
    private String templateName;

    private String category;

    @NotBlank(message = "邮件主题模板不能为空")
    private String subjectTemplate;

    @NotBlank(message = "邮件内容模板不能为空")
    private String contentTemplate;

    private String contentType;

    /** 变量定义 JSON */
    private String variables;

    private Integer status;
}
