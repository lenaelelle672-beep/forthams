package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 邮件模板实体
 *
 * <p>定义邮件模板内容（Thymeleaf 格式），支持变量替换。
 * isBuiltin 标记区分系统内置和用户自定义模板。</p>
 */
@Data
@TableName("sys_mail_template")
public class MailTemplate implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 租户ID */
    private String tenantId;

    /** 模板编码 */
    private String templateCode;

    /** 模板名称 */
    private String templateName;

    /** 模板分类 */
    private String category;

    /** 邮件主题模板（支持 ${} 变量） */
    private String subjectTemplate;

    /** 邮件正文 HTML（Thymeleaf 模板） */
    private String contentTemplate;

    /** 内容类型 */
    private String contentType;

    /** 变量定义 JSON */
    private String variables;

    /** 是否内置模板 */
    private Integer isBuiltin;

    /** 状态：0-停用 1-启用 */
    private Integer status;

    private String createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    private String updateBy;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
