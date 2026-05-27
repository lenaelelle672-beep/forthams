package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 部门实体类
 *
 * <p>对应数据库表 {@code sys_dept}，支持平铺列表查询与树形结构查询。
 * 根据 SPEC 要求，{@code GET /depts/tree} 端点返回的数据结构必须具备层级嵌套关系，
 * 因此本实体包含 {@code children} 字段用于承载子部门列表。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("sys_dept")
public class Dept implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 部门主键 ID */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 部门名称 */
    @TableField("dept_name")
    @JsonProperty("deptName")
    private String name;

    /** 父部门 ID（顶层部门为 0 或 null） */
    private Long parentId;

    /** 部门编码（UNIQUE，对应 schema.sql dept_code 列） */
    @TableField("dept_code")
    @JsonProperty("deptCode")
    private String deptCode;

    /** 祖级节点 ID 链（格式：0,1,2，用于数据权限部门及以下查询） */
    @TableField("ancestors")
    private String ancestors;

    /** 排序号 */
    @TableField("sort_order")
    @JsonProperty("sortOrder")
    private Integer orderNum;

    /** 负责人 */
    private String leader;

    /** 联系电话 */
    private String phone;

    /** 邮箱（持久化字段，对应 schema.sql email 列） */
    @TableField("email")
    private String email;

    /** 部门领导用户 ID（关联 sys_user.id） */
    @TableField("leader_id")
    private Long leaderId;

    /** 秘书用户 ID（关联 sys_user.id） */
    @TableField("secretary_id")
    private Long secretaryId;

    /** 部门类型（如：management / technical / support） */
    @TableField("dept_type")
    private String deptType;

    /** 部门描述/备注 */
    private String description;

    /**
     * 部门状态（1=正常 0=停用，与 schema.sql TINYINT 对齐）
     * <p>修复前为 String 类型，与 TINYINT 不兼容。</p>
     */
    private Integer status;

    /** 创建时间（由 MyBatis-Plus MetaObjectHandler 自动填充） */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间（由 MyBatis-Plus MetaObjectHandler 自动填充） */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除标记 */
    @TableLogic
    private Integer deleted;

    /**
     * 子部门列表 —— 仅用于 {@code GET /depts/tree} 树形结构返回。
     *
     * <p>该字段不映射数据库列，通过 {@code @TableField(exist = false)} 排除持久化；
     * 通过 {@code @JsonInclude(JsonInclude.Include.NON_NULL)} 保证平铺列表接口
     * 不会序列化该字段。</p>
     */
    @TableField(exist = false)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<Dept> children;
}
