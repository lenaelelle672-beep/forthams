package com.ams.mapper;

import com.ams.entity.SysPost;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysPostMapper extends BaseMapper<SysPost> {

    @Select("""
        SELECT p.* FROM sys_post p
        JOIN sys_user_post up ON p.id = up.post_id
        WHERE up.user_id = #{userId} AND p.deleted = 0 AND p.status = 1
        ORDER BY p.sort_order
        """)
    List<SysPost> selectByUserId(@Param("userId") Long userId);
}
