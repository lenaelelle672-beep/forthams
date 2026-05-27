package com.ams.mapper;

import com.ams.entity.SysMenu;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 菜单权限 Mapper — 对应 sys_menu 表
 *
 * <p>自定义 SQL 优先使用注解 @Select，与现有 Mapper 风格一致。</p>
 */
@Mapper
public interface SysMenuMapper extends BaseMapper<SysMenu> {

    /**
     * 查询用户所有权限码（三表 JOIN）
     *
     * <p>每次登录和请求时调用。DISTINCT 避免多角色相同权限重复。</p>
     */
    @Select("""
        SELECT DISTINCT m.perms
        FROM sys_menu m
        INNER JOIN sys_role_menu rm ON m.id = rm.menu_id
        INNER JOIN sys_user_role ur ON rm.role_id = ur.role_id
        INNER JOIN sys_role r ON r.id = ur.role_id
        WHERE ur.user_id = #{userId}
          AND r.status = 1
          AND r.deleted = 0
          AND m.status = 1
          AND m.deleted = 0
          AND m.perms IS NOT NULL
          AND m.perms != ''
        """)
    List<String> selectPermsByUserId(@Param("userId") Long userId);

    /**
     * 查询用户可见的菜单树（目录+菜单类型，不含按钮）
     *
     * <p>结果在 Service 层递归构建树。</p>
     */
    @Select("""
        SELECT DISTINCT m.*
        FROM sys_menu m
        INNER JOIN sys_role_menu rm ON m.id = rm.menu_id
        INNER JOIN sys_user_role ur ON rm.role_id = ur.role_id
        INNER JOIN sys_role r ON r.id = ur.role_id
        WHERE ur.user_id = #{userId}
          AND r.status = 1
          AND r.deleted = 0
          AND m.status = 1
          AND m.deleted = 0
          AND m.menu_type IN ('M', 'C')
        ORDER BY m.parent_id, m.sort_order
        """)
    List<SysMenu> selectMenuTreeByUserId(@Param("userId") Long userId);

    /**
     * 查询所有有效权限码（全局校验使用）
     */
    @Select("""
        SELECT DISTINCT perms
        FROM sys_menu
        WHERE status = 1
          AND deleted = 0
          AND perms IS NOT NULL
          AND perms != ''
        """)
    List<String> selectAllPerms();
}
