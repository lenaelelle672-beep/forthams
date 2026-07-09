package com.ams.mapper;

import com.ams.entity.NotificationPreference;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface NotificationPreferenceMapper {

    String BASE_COLUMNS = "id, tenant_id, category, in_app, email, quiet_start, quiet_end, status, create_time, update_time";

    @Select("SELECT " + BASE_COLUMNS + " FROM notification_preference "
            + "WHERE tenant_id = #{tenantId} AND status = 1 "
            + "ORDER BY category ASC, update_time DESC, id DESC")
    List<NotificationPreference> selectAllActive(@Param("tenantId") String tenantId);

    @Select("SELECT " + BASE_COLUMNS + " FROM notification_preference "
            + "WHERE tenant_id = #{tenantId} AND category = #{category} AND status = 1 "
            + "ORDER BY update_time DESC, id DESC LIMIT 1")
    NotificationPreference selectByCategoryAndTenant(@Param("tenantId") String tenantId, @Param("category") String category);

    @Select("SELECT DISTINCT category FROM notification_preference "
            + "WHERE tenant_id = #{tenantId} AND status = 1 AND category IS NOT NULL AND category <> '' "
            + "ORDER BY category LIMIT #{limit}")
    List<String> listCategories(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
