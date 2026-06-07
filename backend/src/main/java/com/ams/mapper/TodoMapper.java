package com.ams.mapper;

import com.ams.entity.SysTodo;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 待办 Mapper
 */
@Mapper
public interface TodoMapper extends BaseMapper<SysTodo> {
}
