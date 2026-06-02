package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 通知模板创建 DTO
 */
@Data
public class NotificationTemplateCreateDTO {

    @NotBlank(message = "模板编码不能为空")
    private String templateCode;

    @NotBlank(message = "模板名称不能为空")
    private String templateName;

    private String category;

    /** 默认通知渠道 IN_APP/EMAIL/ALL */
    private String channelType;

    @NotBlank(message = "通知标题模板不能为空")
    private String titleTemplate;

    @NotBlank(message = "通知内容模板不能为空")
    private String contentTemplate;

    /** 变量定义 JSON */
    private String variables;

    private Integer status;
}
