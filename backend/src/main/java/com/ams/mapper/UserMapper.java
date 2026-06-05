package com.ams.mapper;

import com.ams.entity.User;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    /**
     * 根据部门ID列表查询用户
     *
     * @param deptIds 部门ID列表
     * @return 用户列表
     */
    @Select("<script>" +
            "SELECT id, username, real_name, email, phone, dept_id, status FROM sys_user " +
            "WHERE status = 1 " +
            "<if test='deptIds != null and deptIds.size() > 0'>" +
            "AND dept_id IN " +
            "<foreach collection='deptIds' item='deptId' open='(' separator=',' close=')'>" +
            "#{deptId}" +
            "</foreach>" +
            "</if>" +
            "ORDER BY create_time DESC " +
            "LIMIT 50" +
            "</script>")
    List<User> selectUsersByDeptIds(@Param("deptIds") List<Long> deptIds);
}
