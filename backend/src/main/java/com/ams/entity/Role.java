package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_role")
public class Role implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String roleName;
    private String roleCode;
    private String description;
    /** 数据权限范围：ALL/DEPT/DEPT_AND_SUB/SELF/CUSTOM */
    private String dataScope;
    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
