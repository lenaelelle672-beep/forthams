package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("handover")
public class Handover {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String title;
    private Long outgoingUserId;
    private String outgoingUserName;
    private Long incomingUserId;
    private String incomingUserName;
    /** PENDING/IN_PROGRESS/COMPLETED/CANCELLED */
    private String status;
    private Integer assetCount;
    private Integer workorderCount;
    private Integer approvalCount;
    private String summary;
    private String riskNote;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
