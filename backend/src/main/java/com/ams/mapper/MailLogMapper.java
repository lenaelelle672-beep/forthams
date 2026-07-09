package com.ams.mapper;

import com.ams.entity.MailLog;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface MailLogMapper {

    String FILTER_SQL = "<if test='templateCode != null'> AND template_code = #{templateCode} </if>"
            + "<if test='sendStatus != null'> AND send_status = #{sendStatus} </if>"
            + "<if test='bizType != null'> AND biz_type = #{bizType} </if>"
            + "<if test='bizId != null'> AND biz_id = #{bizId} </if>"
            + "<if test='keyword != null'> AND (template_code LIKE CONCAT('%', #{keyword}, '%')"
            + " OR biz_type LIKE CONCAT('%', #{keyword}, '%')"
            + " OR CAST(biz_id AS CHAR) LIKE CONCAT('%', #{keyword}, '%')) </if>";

    String BASE_COLUMNS = "id, tenant_id, template_code, mail_from, mail_to, mail_cc, mail_bcc, "
            + "subject, content, send_status, error_message, retry_count, max_retry, biz_type, biz_id, "
            + "provider, provider_message_id, request_id, headers, payload, send_time, create_time, update_time";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM mail_log "
            + "WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + " ORDER BY COALESCE(send_time, create_time) DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<MailLog> selectPageRecords(@Param("tenantId") String tenantId,
                                    @Param("templateCode") String templateCode,
                                    @Param("sendStatus") String sendStatus,
                                    @Param("bizType") String bizType,
                                    @Param("bizId") Long bizId,
                                    @Param("keyword") String keyword,
                                    @Param("limit") int limit,
                                    @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(*) FROM mail_log WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + "</script>")
    long countRecords(@Param("tenantId") String tenantId,
                      @Param("templateCode") String templateCode,
                      @Param("sendStatus") String sendStatus,
                      @Param("bizType") String bizType,
                      @Param("bizId") Long bizId,
                      @Param("keyword") String keyword);

    @Select("SELECT " + BASE_COLUMNS + " FROM mail_log WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    MailLog selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("SELECT " + BASE_COLUMNS + " FROM mail_log "
            + "WHERE tenant_id = #{tenantId} AND biz_type = #{bizType} AND biz_id = #{bizId} "
            + "ORDER BY COALESCE(send_time, create_time) DESC, id DESC LIMIT #{limit}")
    List<MailLog> selectByBizAndTenant(@Param("tenantId") String tenantId,
                                       @Param("bizType") String bizType,
                                       @Param("bizId") Long bizId,
                                       @Param("limit") int limit);

    @Select("SELECT DISTINCT send_status FROM mail_log "
            + "WHERE tenant_id = #{tenantId} AND send_status IS NOT NULL AND send_status <> '' "
            + "ORDER BY send_status LIMIT #{limit}")
    List<String> listSendStatuses(@Param("tenantId") String tenantId, @Param("limit") int limit);

    @Select("SELECT DISTINCT biz_type FROM mail_log "
            + "WHERE tenant_id = #{tenantId} AND biz_type IS NOT NULL AND biz_type <> '' "
            + "ORDER BY biz_type LIMIT #{limit}")
    List<String> listBizTypes(@Param("tenantId") String tenantId, @Param("limit") int limit);

    @Select("SELECT DISTINCT template_code FROM mail_log "
            + "WHERE tenant_id = #{tenantId} AND template_code IS NOT NULL AND template_code <> '' "
            + "ORDER BY template_code LIMIT #{limit}")
    List<String> listTemplateCodes(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
