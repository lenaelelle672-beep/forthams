package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("sys_tenant")
public class SysTenant {
    @TableId(type = IdType.INPUT)
    private String id;
    private String name;
    private String domain;
    private String plan;
    private Integer maxUsers;
    private Integer maxAssets;
    private String status;
    private String contactName;
    private String contactPhone;
    private String contactEmail;
    private LocalDateTime expireAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
