package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("business_comment_like_record")
public class BusinessCommentLikeRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    
    private Long commentId;
    private Long userId;
    private String tenantId;
    
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    
    @TableLogic
    private Integer deleted;
}
