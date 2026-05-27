package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 菜单权限实体 — 对应 sys_menu 表
 *
 * <p>参照 RuoYi sys_menu 模型简化，menu_type 三态：
 * M=目录(可折叠)、C=菜单(路由链接)、F=按钮(权限控制不显示在菜单中)</p>
 */
@Data
@TableName("sys_menu")
public class SysMenu implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("menu_name")
    private String menuName;

    @TableField("parent_id")
    private Long parentId;

    @TableField("sort_order")
    private Integer sortOrder;

    /** 前端路由地址 */
    private String path;

    /** 前端组件路径 */
    private String component;

    /** 路由参数（对应 query_param 列） */
    @TableField("query_param")
    private String query;

    /** 路由名称 */
    @TableField("route_name")
    private String routeName;

    /** M=目录 C=菜单 F=按钮 */
    @TableField("menu_type")
    private String menuType;

    /** 是否显示 0=隐藏 1=显示 */
    private Integer visible;

    /** 状态 0=停用 1=正常 */
    private Integer status;

    /** 权限标识符（如 system:user:list），与 @ss.hasPermi() 匹配 */
    private String perms;

    /** 菜单图标 */
    private String icon;

    /** 是否外链 1=是 0=否 */
    @TableField("is_frame")
    private Integer isFrame;

    /** 是否缓存 1=是 0=否 */
    @TableField("is_cache")
    private Integer isCache;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    /**
     * 子菜单列表 — 仅用于菜单树形结构返回。
     *
     * <p>该字段不映射数据库列，通过 {@code @TableField(exist = false)} 排除持久化；
     * 通过 {@code @JsonInclude(NON_NULL)} 保证平铺列表接口不序列化该字段。</p>
     */
    @TableField(exist = false)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<SysMenu> children;
}
