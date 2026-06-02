package com.ams.dto;

import lombok.Data;

/**
 * 通知模板更新 DTO
 */
@Data
public class NotificationTemplateUpdateDTO {

    private String templateName;

    private String category;

    /** 默认通知渠道 IN_APP/EMAIL/ALL */
    private String channelType;

    private String titleTemplate;

    private String contentTemplate;

    /** 变量定义 JSON */
    private String variables;

    private Integer status;
}
