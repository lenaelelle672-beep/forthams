package com.ams.mapper;

import com.ams.entity.SysRoleDept;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Set;

/**
 * 角色部门关联 Mapper — 对应 sys_role_dept 表
 *
 * <p>为数据权限阶段做准备，第一期不启用数据权限查询。</p>
 */
@Mapper
public interface SysRoleDeptMapper extends BaseMapper<SysRoleDept> {

    /** 按角色 ID 删除所有部门关联 */
    @Delete("DELETE FROM sys_role_dept WHERE role_id = #{roleId}")
    int deleteByRoleId(@Param("roleId") Long roleId);

    /** 按角色 ID 查询关联的部门 ID 列表 */
    @Select("SELECT dept_id FROM sys_role_dept WHERE role_id = #{roleId}")
    List<Long> selectDeptIdsByRoleId(@Param("roleId") Long roleId);

    /** 批量插入角色部门关联 */
    @Insert("""
        <script>
        INSERT INTO sys_role_dept (role_id, dept_id) VALUES
        <foreach collection='list' item='item' separator=','>
            (#{item.roleId}, #{item.deptId})
        </foreach>
        </script>
        """)
    int insertBatch(@Param("list") List<SysRoleDept> list);

    /** 查询用户所属角色的自定义数据权限部门 ID 集合 */
    @Select("""
        SELECT DISTINCT rd.dept_id FROM sys_role_dept rd
        JOIN sys_user_role ur ON rd.role_id = ur.role_id
        JOIN sys_role r ON r.id = rd.role_id
        WHERE ur.user_id = #{userId} AND r.deleted = 0 AND r.status = 1
        """)
    Set<Long> selectDeptIdsByUserId(@Param("userId") Long userId);
}
