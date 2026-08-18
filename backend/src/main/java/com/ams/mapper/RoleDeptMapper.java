package com.ams.mapper;

import com.ams.entity.RoleDept;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RoleDeptMapper extends BaseMapper<RoleDept> {

    @Select("SELECT role_id AS roleId, dept_id AS deptId FROM sys_role_dept")
    List<RoleDept> selectAllBindings();

    @Select("SELECT dept_id FROM sys_role_dept WHERE role_id = #{roleId}")
    List<Long> selectDeptIdsByRoleId(Long roleId);

    @Delete("DELETE FROM sys_role_dept WHERE role_id = #{roleId}")
    int deleteByRoleId(Long roleId);
}
