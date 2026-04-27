package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.fasterxml.jackson.annotation.JsonInclude;
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

    /**
     * 部门主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 部门名称
     */
    @TableField("dept_name")
    private String name;

    /**
     * 父部门 ID（顶层部门为 0 或 null）
     * <p>用于 {@code GET /depts/tree} 端点构建树形父子关系。</p>
     */
    private Long parentId;

    /**
     * 排序号
     */
    @TableField("sort_order")
    private Integer orderNum;

    /**
     * 负责人
     */
    private String leader;

    /**
     * 联系电话
     */
    private String phone;

    /**
     * 邮箱
     */
    private String email;

    /**
     * 部门状态（0-正常, 2-停用）
     */
    private String status;

    /**
     * 创建时间（由 MyBatis-Plus MetaObjectHandler 自动填充）
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间（由 MyBatis-Plus MetaObjectHandler 自动填充）
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /**
     * 子部门列表 —— 仅用于 {@code GET /depts/tree} 树形结构返回。
     *
     * <p>SPEC 约束："GET /tree 端点返回的数据结构必须是具备层级嵌套关系的 JSON
     * （如 children 字段），不可返回平铺结构。"</p>
     *
     * <p>该字段不映射数据库列，通过 {@code @TableField(exist = false)} 排除持久化；
     * 通过 {@code @JsonInclude(JsonInclude.Include.NON_NULL)} 保证平铺列表接口
     * 不会序列化该字段。</p>
     */
    @TableField(exist = false)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<Dept> children;
}