package com.ams.mapper;

import com.ams.entity.NotificationTemplate;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface NotificationTemplateMapper extends BaseMapper<NotificationTemplate> {

    String FILTER_SQL = "<if test='category != null'> AND category = #{category} </if>"
            + "<if test='channelType != null'> AND channel_type = #{channelType} </if>"
            + "<if test='status != null'> AND status = #{status} </if>"
            + "<if test='keyword != null'> AND (template_code LIKE CONCAT('%', #{keyword}, '%')"
            + " OR template_name LIKE CONCAT('%', #{keyword}, '%')"
            + " OR title_template LIKE CONCAT('%', #{keyword}, '%')"
            + " OR content_template LIKE CONCAT('%', #{keyword}, '%')) </if>";

    String BASE_COLUMNS = "id, tenant_id, template_code, template_name, category, channel_type, "
            + "title_template, content_template, variables, is_builtin, status, create_by, create_time, update_by, update_time";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM notification_template "
            + "WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + " ORDER BY update_time DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<NotificationTemplate> selectPageRecords(@Param("tenantId") String tenantId,
                                                  @Param("category") String category,
                                                  @Param("channelType") String channelType,
                                                  @Param("status") Integer status,
                                                  @Param("keyword") String keyword,
                                                  @Param("limit") int limit,
                                                  @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(*) FROM notification_template WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + "</script>")
    long countRecords(@Param("tenantId") String tenantId,
                      @Param("category") String category,
                      @Param("channelType") String channelType,
                      @Param("status") Integer status,
                      @Param("keyword") String keyword);

    @Select("SELECT " + BASE_COLUMNS + " FROM notification_template WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    NotificationTemplate selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("SELECT " + BASE_COLUMNS + " FROM notification_template WHERE tenant_id = #{tenantId} AND template_code = #{templateCode} LIMIT 1")
    NotificationTemplate selectByCodeAndTenant(@Param("tenantId") String tenantId, @Param("templateCode") String templateCode);

    @Select("SELECT DISTINCT category FROM notification_template "
            + "WHERE tenant_id = #{tenantId} AND category IS NOT NULL AND category <> '' "
            + "ORDER BY category LIMIT #{limit}")
    List<String> listCategories(@Param("tenantId") String tenantId, @Param("limit") int limit);

    @Select("SELECT DISTINCT channel_type FROM notification_template "
            + "WHERE tenant_id = #{tenantId} AND channel_type IS NOT NULL AND channel_type <> '' "
            + "ORDER BY channel_type LIMIT #{limit}")
    List<String> listChannelTypes(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
