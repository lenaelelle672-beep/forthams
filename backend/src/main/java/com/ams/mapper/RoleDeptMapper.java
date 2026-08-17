package com.ams.mapper;

import com.ams.entity.RoleDept;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RoleDeptMapper extends BaseMapper<RoleDept> {

    @Select("""
            <script>
            SELECT tenant_id, role_id, dept_id
            FROM sys_role_dept
            WHERE tenant_id = #{tenantId}
              AND role_id IN
              <foreach collection="roleIds" item="roleId" open="(" separator="," close=")">
                #{roleId}
              </foreach>
            ORDER BY role_id, dept_id, id
            </script>
            """)
    List<RoleDept> selectByTenantIdAndRoleIds(@Param("tenantId") String tenantId,
                                               @Param("roleIds") List<Long> roleIds);
}
