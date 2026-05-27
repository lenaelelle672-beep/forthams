package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 角色部门关联实体 — 对应 sys_role_dept 表
 *
 * <p>角色与部门的数据权限关联表，为数据权限阶段做准备。</p>
 */
@Data
@TableName("sys_role_dept")
public class SysRoleDept implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("role_id")
    private Long roleId;

    @TableField("dept_id")
    private Long deptId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
