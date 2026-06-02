package com.ams.mapper;

import com.ams.entity.NotificationPreference;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户通知偏好 Mapper
 */
@Mapper
public interface NotificationPreferenceMapper extends BaseMapper<NotificationPreference> {
}
