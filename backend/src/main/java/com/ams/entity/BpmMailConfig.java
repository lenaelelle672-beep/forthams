package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("bpm_mail_config")
public class BpmMailConfig implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

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

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
