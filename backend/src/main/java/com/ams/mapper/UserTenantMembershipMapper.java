package com.ams.mapper;

import com.ams.entity.UserTenantMembership;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserTenantMembershipMapper extends BaseMapper<UserTenantMembership> {

    @Select("""
            SELECT COUNT(1)
            FROM sys_user_tenant
            WHERE user_id = #{userId}
              AND tenant_id = #{tenantId}
              AND status = 1
            """)
    long countActiveMembership(@Param("userId") Long userId, @Param("tenantId") String tenantId);

    @Select("""
            SELECT tenant_id
            FROM sys_user_tenant
            WHERE user_id = #{userId}
              AND status = 1
            ORDER BY tenant_id
            """)
    List<String> selectActiveTenantIdsByUserId(@Param("userId") Long userId);
}
