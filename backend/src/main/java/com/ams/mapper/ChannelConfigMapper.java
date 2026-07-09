package com.ams.mapper;

import com.ams.entity.ChannelConfig;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface ChannelConfigMapper {

    String BASE_COLUMNS = "id, tenant_id, channel_type, config_name, webhook_url_masked, webhook_url_configured, signature_configured, enabled, description, created_at, updated_at";

    @Select("<script>"
            + "SELECT COUNT(1) FROM channel_config WHERE tenant_id = #{tenantId} "
            + "<if test='channelType != null'>AND channel_type = #{channelType} </if>"
            + "<if test='keyword != null'>AND (config_name LIKE CONCAT('%', #{keyword}, '%') OR description LIKE CONCAT('%', #{keyword}, '%')) </if>"
            + "</script>")
    long countRecords(@Param("tenantId") String tenantId, @Param("channelType") String channelType, @Param("keyword") String keyword);

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM channel_config WHERE tenant_id = #{tenantId} "
            + "<if test='channelType != null'>AND channel_type = #{channelType} </if>"
            + "<if test='keyword != null'>AND (config_name LIKE CONCAT('%', #{keyword}, '%') OR description LIKE CONCAT('%', #{keyword}, '%')) </if>"
            + "ORDER BY enabled DESC, updated_at DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<ChannelConfig> selectPageRecords(@Param("tenantId") String tenantId,
                                          @Param("channelType") String channelType,
                                          @Param("keyword") String keyword,
                                          @Param("limit") int limit,
                                          @Param("offset") int offset);

    @Select("SELECT " + BASE_COLUMNS + " FROM channel_config "
            + "WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    ChannelConfig selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("SELECT DISTINCT channel_type FROM channel_config "
            + "WHERE tenant_id = #{tenantId} AND channel_type IS NOT NULL AND channel_type <> '' "
            + "ORDER BY channel_type LIMIT #{limit}")
    List<String> listChannelTypes(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
