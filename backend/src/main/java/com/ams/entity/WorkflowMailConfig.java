package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("workflow_mail_config")
public class WorkflowMailConfig {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String businessType;
    private String nodeKey;
    private String nodeName;
    private String triggerEvent;
    private String templateCode;
    private Integer enabled;
    private String recipientScope;
    private String riskNote;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
