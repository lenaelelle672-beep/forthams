package com.ams.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("notification_preference")
public class NotificationPreference {
    private Long id;
    private String tenantId;
    private String category;
    private Integer inApp;
    private Integer email;
    private String quietStart;
    private String quietEnd;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
