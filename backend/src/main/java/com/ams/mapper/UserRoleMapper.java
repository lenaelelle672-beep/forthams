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
        INNER JOIN sys_role r ON ur.role_id = r.id
        WHERE ur.user_id = #{userId}
          AND r.status = 1
          AND r.deleted = 0
        """)
    List<String> selectRoleCodesByUserId(@Param("userId") Long userId);
}
