package com.ams.mapper;

import com.ams.entity.SysRoleMenu;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 角色菜单关联 Mapper — 对应 sys_role_menu 表
 */
@Mapper
public interface SysRoleMenuMapper extends BaseMapper<SysRoleMenu> {

    /** 按角色 ID 删除所有菜单关联 */
    @Delete("DELETE FROM sys_role_menu WHERE role_id = #{roleId}")
    int deleteByRoleId(@Param("roleId") Long roleId);

    /** 按角色 ID 查询关联的菜单 ID 列表 */
    @org.apache.ibatis.annotations.Select("SELECT menu_id FROM sys_role_menu WHERE role_id = #{roleId}")
    List<Long> selectMenuIdsByRoleId(@Param("roleId") Long roleId);

    /** 批量插入角色菜单关联 */
    @Insert("""
        <script>
        INSERT INTO sys_role_menu (role_id, menu_id) VALUES
        <foreach collection='list' item='item' separator=','>
            (#{item.roleId}, #{item.menuId})
        </foreach>
        </script>
        """)
    int insertBatch(@Param("list") List<SysRoleMenu> list);
}
