package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("mail_gateway")
public class MailGateway {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String gatewayCode;
    private String gatewayName;
    private String hostMasked;
    private Integer port;
    private String tlsMode;
    private Boolean authConfigured;
    private String senderMasked;
    private Integer priority;
    private Boolean enabled;
    private String lastTestStatus;
    private LocalDateTime lastTestAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
