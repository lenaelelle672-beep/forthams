package com.ams.mapper;

import com.ams.dto.AuditDistResp;
import com.ams.dto.AuditTrendResp;
import com.ams.dto.OperatorRankingVO;
import com.ams.entity.GeneralAuditEntry;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

public interface AuditLogMapper extends BaseMapper<GeneralAuditEntry> {

    String FILTER_SQL = "<if test='startTime != null'> AND timestamp &gt;= #{startTime} </if>"
            + "<if test='endTime != null'> AND timestamp &lt; #{endTime} </if>"
            + "<if test='operationType != null'> AND (operation_type = #{operationType} OR action = #{operationType}) </if>"
            + "<if test='operatorId != null'> AND operator_id = #{operatorId} </if>"
            + "<if test='operatorName != null'> AND operator_name LIKE CONCAT('%', #{operatorName}, '%') </if>"
            + "<if test='resourceType != null'> AND resource_type = #{resourceType} </if>"
            + "<if test='resourceId != null'> AND resource_id = #{resourceId} </if>"
            + "<if test='keyword != null'> AND (description LIKE CONCAT('%', #{keyword}, '%')"
            + " OR operator_name LIKE CONCAT('%', #{keyword}, '%')"
            + " OR resource_type LIKE CONCAT('%', #{keyword}, '%')"
            + " OR operation_type LIKE CONCAT('%', #{keyword}, '%')) </if>";

    @Select("<script>"
            + "SELECT id, tenant_id, trace_id, timestamp, action, operation_type, operator_id, operator_name, "
            + "resource_type, resource_id, description, http_method, request_uri, ip_address, user_agent, "
            + "before_record, after_record, raw_payload, error_message, error_stack, status, created_at "
            + "FROM general_audit_entry "
            + "WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + "ORDER BY timestamp DESC, id DESC "
            + "LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<GeneralAuditEntry> selectPageRecords(@Param("tenantId") String tenantId,
                                              @Param("startTime") LocalDateTime startTime,
                                              @Param("endTime") LocalDateTime endTime,
                                              @Param("operationType") String operationType,
                                              @Param("operatorId") Long operatorId,
                                              @Param("operatorName") String operatorName,
                                              @Param("resourceType") String resourceType,
                                              @Param("resourceId") String resourceId,
                                              @Param("keyword") String keyword,
                                              @Param("limit") int limit,
                                              @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(*) FROM general_audit_entry WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + "</script>")
    long countRecords(@Param("tenantId") String tenantId,
                      @Param("startTime") LocalDateTime startTime,
                      @Param("endTime") LocalDateTime endTime,
                      @Param("operationType") String operationType,
                      @Param("operatorId") Long operatorId,
                      @Param("operatorName") String operatorName,
                      @Param("resourceType") String resourceType,
                      @Param("resourceId") String resourceId,
                      @Param("keyword") String keyword);

    @Select("SELECT id, tenant_id, trace_id, timestamp, action, operation_type, operator_id, operator_name, "
            + "resource_type, resource_id, description, http_method, request_uri, ip_address, user_agent, "
            + "before_record, after_record, raw_payload, error_message, error_stack, status, created_at "
            + "FROM general_audit_entry WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    GeneralAuditEntry selectDetail(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("<script>"
            + "SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') AS date, COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE tenant_id = #{tenantId} AND timestamp &gt;= #{startTime} AND timestamp &lt; #{endTime} "
            + "<if test='operationType != null'> AND (operation_type = #{operationType} OR action = #{operationType}) </if>"
            + "GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d') ORDER BY date ASC"
            + "</script>")
    List<AuditTrendResp.DataPoint> countByDay(@Param("tenantId") String tenantId,
                                              @Param("startTime") LocalDateTime startTime,
                                              @Param("endTime") LocalDateTime endTime,
                                              @Param("operationType") String operationType);

    @Select("<script>"
            + "SELECT DATE_FORMAT(timestamp, '%Y-%m-%dT%H:00:00') AS date, COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE tenant_id = #{tenantId} AND timestamp &gt;= #{startTime} AND timestamp &lt; #{endTime} "
            + "<if test='operationType != null'> AND (operation_type = #{operationType} OR action = #{operationType}) </if>"
            + "GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%dT%H:00:00') ORDER BY date ASC"
            + "</script>")
    List<AuditTrendResp.DataPoint> countByHour(@Param("tenantId") String tenantId,
                                               @Param("startTime") LocalDateTime startTime,
                                               @Param("endTime") LocalDateTime endTime,
                                               @Param("operationType") String operationType);

    @Select("SELECT COALESCE(operation_type, action, 'UNKNOWN') AS actionType, COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE tenant_id = #{tenantId} AND timestamp >= #{startTime} AND timestamp < #{endTime} "
            + "GROUP BY COALESCE(operation_type, action, 'UNKNOWN') ORDER BY count DESC")
    List<AuditDistResp.DistributionItem> countByOperationType(@Param("tenantId") String tenantId,
                                                              @Param("startTime") LocalDateTime startTime,
                                                              @Param("endTime") LocalDateTime endTime);

    @Select("SELECT operator_id AS operatorId, COALESCE(operator_name, '未知用户') AS operatorName, COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE tenant_id = #{tenantId} AND timestamp >= #{startTime} AND timestamp < #{endTime} "
            + "GROUP BY operator_id, operator_name ORDER BY count DESC LIMIT #{limit}")
    List<OperatorRankingVO> countByOperator(@Param("tenantId") String tenantId,
                                            @Param("startTime") LocalDateTime startTime,
                                            @Param("endTime") LocalDateTime endTime,
                                            @Param("limit") int limit);

    @Select("SELECT DISTINCT COALESCE(operation_type, action) FROM general_audit_entry "
            + "WHERE tenant_id = #{tenantId} AND COALESCE(operation_type, action) IS NOT NULL "
            + "ORDER BY COALESCE(operation_type, action) LIMIT #{limit}")
    List<String> listOperationTypes(@Param("tenantId") String tenantId, @Param("limit") int limit);

    @Select("SELECT DISTINCT resource_type FROM general_audit_entry "
            + "WHERE tenant_id = #{tenantId} AND resource_type IS NOT NULL AND resource_type <> '' "
            + "ORDER BY resource_type LIMIT #{limit}")
    List<String> listResourceTypes(@Param("tenantId") String tenantId, @Param("limit") int limit);

    @Select("SELECT DISTINCT COALESCE(operator_name, '未知用户') FROM general_audit_entry "
            + "WHERE tenant_id = #{tenantId} AND operator_name IS NOT NULL AND operator_name <> '' "
            + "ORDER BY operator_name LIMIT #{limit}")
    List<String> listOperators(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
