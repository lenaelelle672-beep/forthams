package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_post")
public class SystemPost {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String postCode;
    private String postName;
    private Integer sortOrder;
    private String status;
    private String remark;
    private Integer removed;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
