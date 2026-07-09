package com.ams.mapper;

import com.ams.entity.MailGateway;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface MailGatewayMapper {

    String BASE_COLUMNS = "id, tenant_id, gateway_code, gateway_name, host_masked, port, tls_mode, "
            + "auth_configured, sender_masked, priority, enabled, last_test_status, last_test_at, created_at, updated_at";

    String FILTER_SQL = "<if test='keyword != null'> AND (gateway_code LIKE CONCAT('%', #{keyword}, '%')"
            + " OR gateway_name LIKE CONCAT('%', #{keyword}, '%')"
            + " OR host_masked LIKE CONCAT('%', #{keyword}, '%')"
            + " OR sender_masked LIKE CONCAT('%', #{keyword}, '%')) </if>"
            + "<if test='tlsMode != null'> AND tls_mode = #{tlsMode} </if>"
            + "<if test='enabled != null'> AND enabled = #{enabled} </if>"
            + "<if test='authConfigured != null'> AND auth_configured = #{authConfigured} </if>";

    @Select("<script>"
            + "SELECT COUNT(1) FROM mail_gateway WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + "</script>")
    long countRecords(@Param("tenantId") String tenantId,
                      @Param("keyword") String keyword,
                      @Param("tlsMode") String tlsMode,
                      @Param("enabled") Boolean enabled,
                      @Param("authConfigured") Boolean authConfigured);

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM mail_gateway WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + " ORDER BY enabled DESC, priority ASC, updated_at DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<MailGateway> selectPageRecords(@Param("tenantId") String tenantId,
                                        @Param("keyword") String keyword,
                                        @Param("tlsMode") String tlsMode,
                                        @Param("enabled") Boolean enabled,
                                        @Param("authConfigured") Boolean authConfigured,
                                        @Param("limit") int limit,
                                        @Param("offset") int offset);

    @Select("SELECT " + BASE_COLUMNS + " FROM mail_gateway WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    MailGateway selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("SELECT DISTINCT tls_mode FROM mail_gateway "
            + "WHERE tenant_id = #{tenantId} AND tls_mode IS NOT NULL AND tls_mode <> '' "
            + "ORDER BY tls_mode LIMIT #{limit}")
    List<String> listTlsModes(@Param("tenantId") String tenantId, @Param("limit") int limit);

    @Select("SELECT DISTINCT last_test_status FROM mail_gateway "
            + "WHERE tenant_id = #{tenantId} AND last_test_status IS NOT NULL AND last_test_status <> '' "
            + "ORDER BY last_test_status LIMIT #{limit}")
    List<String> listLastTestStatuses(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
