package com.ams.mapper;

import com.ams.entity.SysUserPost;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysUserPostMapper extends BaseMapper<SysUserPost> {

    @Select("""
        SELECT post_id FROM sys_user_post WHERE user_id = #{userId}
        """)
    List<Long> selectPostIdsByUserId(@Param("userId") Long userId);

    @Delete("""
        DELETE FROM sys_user_post WHERE user_id = #{userId}
        """)
    void deleteByUserId(@Param("userId") Long userId);
}
