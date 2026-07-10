package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("support_ticket")
public class SupportTicket {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String title;
    private String category;
    private String priority;
    private String status;
    private String requesterName;
    private String assigneeName;
    private Integer diagnosticPackageAttached;
    private Integer diagnosticPackageMasked;
    private String summary;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
