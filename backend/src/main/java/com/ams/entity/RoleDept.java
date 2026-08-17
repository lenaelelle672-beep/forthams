package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_role_dept")
public class RoleDept implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long roleId;
    private Long deptId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
