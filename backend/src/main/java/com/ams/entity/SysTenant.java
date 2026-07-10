package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_tenant")
public class SysTenant {
    /** 租户标识，如 T001，与各业务表的 tenant_id 对齐 */
    @TableId(type = IdType.INPUT)
    private String id;
    private String name;
    private String plan;
    private Integer maxUsers;
    private Integer maxAssets;
    private String status;
    private String contactName;
    private String contactPhone;
    private String contactEmail;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
