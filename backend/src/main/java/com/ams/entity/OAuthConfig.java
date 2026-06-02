package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("sys_oauth_config")
public class OAuthConfig {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String provider;
    private String appId;
    private String appSecret;
    private String redirectUrl;
    private Integer enabled;
    private String remark;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
