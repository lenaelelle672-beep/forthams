package com.ams.mapper;

import com.ams.entity.UserRole;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserRoleMapper extends BaseMapper<UserRole> {

    @Select("""
        SELECT r.role_code
         FROM sys_user_role ur
         INNER JOIN sys_user u ON u.id = ur.user_id
         INNER JOIN sys_user_tenant ut ON ut.user_id = u.id
         INNER JOIN sys_role r ON ur.role_id = r.id
         WHERE ur.user_id = #{userId}
           AND u.tenant_id = #{tenantId}
           AND u.status = 1
           AND COALESCE(u.deleted, 0) = 0
           AND ut.tenant_id = #{tenantId}
           AND ut.status = 1
           AND r.tenant_id = #{tenantId}
          AND r.status = 1
          AND COALESCE(r.deleted, 0) = 0
        """)
    List<String> selectRoleCodesByUserIdAndTenantId(@Param("userId") Long userId,
                                                     @Param("tenantId") String tenantId);

    @Select("""
        SELECT DISTINCT p.permission_code
         FROM sys_user_role ur
         INNER JOIN sys_user u ON u.id = ur.user_id
         INNER JOIN sys_user_tenant ut ON ut.user_id = u.id
         INNER JOIN sys_role r ON ur.role_id = r.id
        INNER JOIN sys_role_permission rp ON rp.role_id = r.id
        INNER JOIN sys_permission p ON rp.permission_id = p.id
        WHERE ur.user_id = #{userId}
          AND u.tenant_id = #{tenantId}
           AND u.status = 1
           AND COALESCE(u.deleted, 0) = 0
           AND ut.tenant_id = #{tenantId}
           AND ut.status = 1
           AND r.tenant_id = #{tenantId}
          AND r.status = 1
          AND COALESCE(r.deleted, 0) = 0
          AND p.status = 1
          AND COALESCE(p.deleted, 0) = 0
        """)
    List<String> selectPermissionCodesByUserIdAndTenantId(@Param("userId") Long userId,
                                                           @Param("tenantId") String tenantId);

    @Select("""
        SELECT DISTINCT CAST(ur.user_id AS CHAR)
         FROM sys_user_role ur
         INNER JOIN sys_role r ON ur.role_id = r.id
         INNER JOIN sys_user u ON u.id = ur.user_id
         INNER JOIN sys_user_tenant ut ON ut.user_id = u.id
        WHERE r.role_code = #{roleCode}
          AND r.tenant_id = #{tenantId}
          AND r.status = 1
          AND COALESCE(r.deleted, 0) = 0
          AND u.tenant_id = #{tenantId}
           AND u.status = 1
           AND COALESCE(u.deleted, 0) = 0
           AND ut.tenant_id = #{tenantId}
           AND ut.status = 1
         """)
    List<String> selectUserIdsByRoleCode(@Param("roleCode") String roleCode,
                                          @Param("tenantId") String tenantId);

    @Select("""
         SELECT COUNT(1)
         FROM sys_user_role ur
         LEFT JOIN sys_role r ON ur.role_id = r.id
         WHERE ur.user_id = #{userId}
           AND (r.id IS NULL
                 OR r.tenant_id IS NULL
                 OR r.tenant_id <> #{tenantId}
                 OR r.status IS NULL
                 OR r.status <> 1
                OR COALESCE(r.deleted, 0) <> 0)
         """)
    long countInvalidTenantRoleAssignments(@Param("userId") Long userId,
                                            @Param("tenantId") String tenantId);
}
