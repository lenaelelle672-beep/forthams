package com.ams.mapper;

import com.ams.entity.UserRole;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserRoleMapper extends BaseMapper<UserRole> {

    @Select("""
        SELECT r.role_code
        FROM sys_user_role ur
        INNER JOIN sys_role r ON ur.role_id = r.id
        WHERE ur.user_id = #{userId}
          AND r.status = 1
          AND r.deleted = 0
        """)
    List<String> selectRoleCodesByUserId(@Param("userId") Long userId);

    @Select("""
        SELECT DISTINCT u.id
        FROM sys_user u
        INNER JOIN sys_user_role ur ON ur.user_id = u.id
        INNER JOIN sys_role r ON ur.role_id = r.id
        WHERE (r.role_code = #{role} OR r.role_name = #{role})
          AND u.status = 1
          AND u.deleted = 0
          AND r.status = 1
          AND r.deleted = 0
        """)
    List<Long> selectActiveUserIdsByRole(@Param("role") String role);

    /** 查询用户已关联的角色ID列表 */
    @Select("""
        SELECT ur.role_id
        FROM sys_user_role ur
        INNER JOIN sys_role r ON ur.role_id = r.id
        WHERE ur.user_id = #{userId}
          AND r.deleted = 0
        """)
    List<Long> selectRoleIdsByUserId(@Param("userId") Long userId);

    /** 按用户ID删除所有角色关联（用于重新分配角色） */
    @Delete("""
        DELETE FROM sys_user_role WHERE user_id = #{userId}
        """)
    void deleteByUserId(@Param("userId") Long userId);

    /** 查询指定角色编码是否存在于启用且未删除的角色表中 */
    @Select("""
        SELECT COUNT(1)
        FROM sys_role r
        WHERE (r.role_code = #{roleCode} OR r.role_name = #{roleCode})
          AND r.status = 1
          AND r.deleted = 0
        """)
    int countActiveByRoleCode(@Param("roleCode") String roleCode);
}
