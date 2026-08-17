package com.ams.mapper;

import com.ams.entity.RoleDataScopeRule;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RoleDataScopeMapper extends BaseMapper<RoleDataScopeRule> {

    @Select("""
            SELECT r.id AS role_id, r.tenant_id, rule_scope.data_scope
            FROM sys_user_role ur
            INNER JOIN sys_user u ON u.id = ur.user_id
            INNER JOIN sys_user_tenant ut ON ut.user_id = u.id
            INNER JOIN sys_role r ON r.id = ur.role_id
            LEFT JOIN sys_role_data_scope rule_scope
                ON rule_scope.role_id = r.id
                AND rule_scope.tenant_id = r.tenant_id
            WHERE ur.user_id = #{userId}
              AND u.tenant_id = #{tenantId}
              AND u.status = 1
              AND COALESCE(u.deleted, 0) = 0
              AND ut.tenant_id = #{tenantId}
              AND ut.status = 1
              AND r.tenant_id = #{tenantId}
              AND r.status = 1
              AND r.deleted = 0
            ORDER BY r.id
            """)
    List<RoleDataScopeRule> selectByUserIdAndTenantId(@Param("userId") Long userId,
                                                       @Param("tenantId") String tenantId);

    @Select("""
            SELECT id, tenant_id, role_id, data_scope, create_time, update_time
            FROM sys_role_data_scope
            WHERE tenant_id = #{tenantId}
            ORDER BY role_id, id
            """)
    List<RoleDataScopeRule> selectByTenantId(@Param("tenantId") String tenantId);
}
