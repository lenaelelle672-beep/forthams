package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("location")
public class Location {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String locationCode;

    @TableField("parent_id")
    private Long parentId;

    private Integer sortOrder;

    private String description;

    private Integer status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    private Integer deleted;

    /**
     * 祖先ID链（V2_9__location_tree.sql 已建 ancestors VARCHAR(500) 列）。
     * 形如 ",1,3,5,"，用于 cascade 子查询与 LIKE 过滤。
     * 与 findDescendants 递归 CTE 配合，可避免 SQL 端递归。
     * MyBatis-Plus 必须显式 @TableField 声明，否则静默忽略导致 cascade 查询阻塞。
     */
    @TableField("ancestors")
    private String ancestors;

    /**
     * 层级深度（V2_9__location_tree.sql 已建 level INT 列）。
     * 根节点 level=0，子节点 level=parent.level+1。
     */
    @TableField("level")
    private Integer level;

    /**
     * 空间单元类型（V2_9__location_tree.sql 已建 location_type VARCHAR(20) 列）。
     * 枚举值: PROVINCE / CITY / DISTRICT / BUILDING / FLOOR / ROOM。
     * 与 LocationType 枚举保持一致，便于 service 层判别。
     */
    @TableField("location_type")
    private String locationType;

    @TableField(exist = false)
    private List<Location> children;
}
