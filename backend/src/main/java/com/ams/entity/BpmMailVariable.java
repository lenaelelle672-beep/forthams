package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("bpm_mail_variable")
public class BpmMailVariable implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String varKey;

    private String varName;

    private String defaultValue;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
