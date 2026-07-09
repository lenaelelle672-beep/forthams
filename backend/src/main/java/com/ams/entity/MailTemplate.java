package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("mail_template")
public class MailTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String templateCode;
    private String templateName;
    private String category;
    private String subjectTemplate;
    private String contentTemplate;
    private String contentType;
    private String variables;
    private Integer isBuiltin;
    private Integer status;
    private String createBy;
    private LocalDateTime createTime;
    private String updateBy;
    private LocalDateTime updateTime;
}
