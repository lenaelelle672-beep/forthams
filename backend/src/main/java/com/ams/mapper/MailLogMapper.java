package com.ams.mapper;

import com.ams.entity.MailLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 邮件发送日志 Mapper
 */
@Mapper
public interface MailLogMapper extends BaseMapper<MailLog> {
}
