package com.ams.mapper;

import com.ams.entity.NotificationBizSwitch;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface NotificationBizSwitchMapper {

    String BASE_COLUMNS = "id, tenant_id, biz_type, event, channel_type, enabled, template_code, description, create_time, update_time";

    @Select("SELECT " + BASE_COLUMNS + " FROM notification_switch "
            + "WHERE tenant_id = #{tenantId} ORDER BY biz_type ASC, event ASC, channel_type ASC, id DESC")
    List<NotificationBizSwitch> selectAllByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT " + BASE_COLUMNS + " FROM notification_switch "
            + "WHERE tenant_id = #{tenantId} AND biz_type = #{bizType} "
            + "ORDER BY event ASC, channel_type ASC, id DESC")
    List<NotificationBizSwitch> selectByBizTypeAndTenant(@Param("tenantId") String tenantId,
                                                         @Param("bizType") String bizType);

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM notification_switch "
            + "WHERE tenant_id = #{tenantId} AND biz_type = #{bizType} AND event = #{event} "
            + "<if test='channelType != null'> AND (channel_type = #{channelType} OR channel_type = 'ALL') </if>"
            + "ORDER BY enabled ASC, channel_type ASC, id DESC"
            + "</script>")
    List<NotificationBizSwitch> selectForPreview(@Param("tenantId") String tenantId,
                                                 @Param("bizType") String bizType,
                                                 @Param("event") String event,
                                                 @Param("channelType") String channelType);

    @Select("SELECT DISTINCT biz_type FROM notification_switch "
            + "WHERE tenant_id = #{tenantId} AND biz_type IS NOT NULL AND biz_type <> '' "
            + "ORDER BY biz_type LIMIT #{limit}")
    List<String> listBizTypes(@Param("tenantId") String tenantId, @Param("limit") int limit);

    @Select("SELECT DISTINCT event FROM notification_switch "
            + "WHERE tenant_id = #{tenantId} AND event IS NOT NULL AND event <> '' "
            + "ORDER BY event LIMIT #{limit}")
    List<String> listEvents(@Param("tenantId") String tenantId, @Param("limit") int limit);

    @Select("SELECT DISTINCT channel_type FROM notification_switch "
            + "WHERE tenant_id = #{tenantId} AND channel_type IS NOT NULL AND channel_type <> '' "
            + "ORDER BY channel_type LIMIT #{limit}")
    List<String> listChannelTypes(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
