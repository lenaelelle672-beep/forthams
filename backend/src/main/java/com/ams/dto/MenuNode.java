package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * 菜单树节点 DTO — 供前端动态菜单渲染使用。
 *
 * <p>前端期望的 MenuNode 结构：id/parentId/menuName/menuType/path/component/perms/icon/sortOrder/visible/status/children</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MenuNode {

    private Long id;
    private Long parentId;
    private String menuName;
    private String menuType;  // M=目录 C=菜单 F=按钮
    private String path;
    private String component;
    private String perms;
    private String icon;
    private Integer sortOrder;
    private Integer visible;
    private Integer status;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<MenuNode> children;

    public void addChild(MenuNode child) {
        if (children == null) {
            children = new ArrayList<>();
        }
        children.add(child);
    }
}
