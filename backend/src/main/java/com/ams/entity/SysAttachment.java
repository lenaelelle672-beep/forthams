package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_attachment")
public class SysAttachment implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String businessType;
    private Long businessId;
    private String fileName;
    private String filePath;
    private Long fileSize;
    private String fileType;
    private Long uploadBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableLogic
    private Integer deleted;
}
