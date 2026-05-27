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

    @TableField("sort_order")
    private Integer sortOrder;

    /** 数据权限范围：1=全部 2=自定义 3=本部门 4=本部门及以下 5=仅本人 */
    @TableField("data_scope")
    private Integer dataScope;

    /** 菜单树父子联动：1=严格 0=非严格 */
    @TableField("menu_check_strictly")
    private Integer menuCheckStrictly;

    /** 部门树父子联动：1=严格 0=非严格 */
    @TableField("dept_check_strictly")
    private Integer deptCheckStrictly;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
