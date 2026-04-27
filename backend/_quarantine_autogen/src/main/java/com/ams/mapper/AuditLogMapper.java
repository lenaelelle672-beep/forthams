package com.ams.mapper;

import com.ams.entity.AuditLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.SelectProvider;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.builder.annotation.ProviderMethodResolver;
import org.apache.ibatis.jdbc.SQL;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 审计日志数据访问层
 * 
 * <p>提供审计日志的数据库查询能力，支持按时间范围、操作用户、操作类型过滤，
 * 以及分页查询和趋势统计数据获取。</p>
 * 
 * @author AMS Team
 * @version 1.0
 * @since 2024-01-15
 */
@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {

    /**
     * 根据多条件组合查询审计日志列表（带分页）
     * 
     * <p>支持以下过滤条件（均为可选）：</p>
     * <ul>
     *   <li>startTime - 起始时间（闭区间）</li>
     *   <li>endTime - 结束时间（闭区间）</li>
     *   <li>userId - 操作用户ID</li>
     *   <li>operationType - 操作类型（CREATE/READ/UPDATE/DELETE）</li>
     * </ul>
     * 
     * @param startTime 起始时间（ISO8601格式，可为null）
     * @param endTime 结束时间（ISO8601格式，可为null）
     * @param userId 用户ID（可为null）
     * @param operationType 操作类型（可为null）
     * @param offset 偏移量（计算公式：offset = (page - 1) * pageSize）
     * @param limit 每页记录数
     * @return 符合条件的审计日志列表
     * 
     * @example
     * <pre>
     * // 查询第1页，每页20条
     * auditLogMapper.selectLogsWithFilters(null, null, null, null, 0, 20);
     * 
     * // 查询2024-01-01到2024-01-31的DELETE操作
     * auditLogMapper.selectLogsWithFilters(
     *     "2024-01-01T00:00:00", "2024-01-31T23:59:59", 
     *     null, "DELETE", 0, 20
     * );
     * </pre>
     */
    @SelectProvider(type = AuditLogSqlProvider.class, method = "selectLogsWithFilters")
    List<AuditLog> selectLogsWithFilters(
        @Param("startTime") String startTime,
        @Param("endTime") String endTime,
        @Param("userId") String userId,
        @Param("operationType") String operationType,
        @Param("offset") int offset,
        @Param("limit") int limit
    );

    /**
     * 统计符合过滤条件的审计日志总数
     * 
     * <p>用于生成分页信息的 total 字段，返回符合条件的记录总数。</p>
     * 
     * @param startTime 起始时间（ISO8601格式，可为null）
     * @param endTime 结束时间（ISO8601格式，可为null）
     * @param userId 用户ID（可为null）
     * @param operationType 操作类型（可为null）
     * @return 符合条件的记录总数
     */
    @SelectProvider(type = AuditLogSqlProvider.class, method = "countLogsWithFilters")
    long countLogsWithFilters(
        @Param("startTime") String startTime,
        @Param("endTime") String endTime,
        @Param("userId") String userId,
        @Param("operationType") String operationType
    );

    /**
     * 获取每日操作数量趋势数据
     * 
     * <p>按日期聚合统计每日日志数量，用于生成趋势统计图表。</p>
     * 
     * @param startTime 起始时间
     * @param endTime 结束时间
     * @param operationType 操作类型过滤（可为null表示全部类型）
     * @return 每日统计列表，每条记录包含 date 和 count 字段
     */
    @Select("SELECT DATE(created_at) as date, COUNT(*) as count " +
            "FROM audit_log " +
            "WHERE created_at >= #{startTime} " +
            "AND created_at <= #{endTime} " +
            "#{operationTypeClause} " +
            "GROUP BY DATE(created_at) " +
            "ORDER BY date ASC")
    List<Map<String, Object>> selectDailyTrend(
        @Param("startTime") String startTime,
        @Param("endTime") String endTime,
        @Param("operationTypeClause") String operationTypeClause
    );

    /**
     * 按操作类型统计数量分布
     * 
     * @param startTime 起始时间
     * @param endTime 结束时间
     * @return 各操作类型的数量映射
     */
    @Select("SELECT operation_type, COUNT(*) as count " +
            "FROM audit_log " +
            "WHERE created_at >= #{startTime} " +
            "AND created_at <= #{endTime} " +
            "GROUP BY operation_type")
    List<Map<String, Object>> selectCountByOperationType(
        @Param("startTime") String startTime,
        @Param("endTime") String endTime
    );

    /**
     * 根据用户ID查询最近的操作记录
     * 
     * @param userId 用户ID
     * @param limit 返回记录数量
     * @return 该用户的最近操作记录
     */
    @Select("SELECT * FROM audit_log " +
            "WHERE user_id = #{userId} " +
            "ORDER BY created_at DESC " +
            "LIMIT #{limit}")
    List<AuditLog> selectRecentByUserId(
        @Param("userId") String userId,
        @Param("limit") int limit
    );

    /**
     * 根据资源类型和资源ID查询操作历史
     * 
     * @param resourceType 资源类型（如：ASSET, WORK_ORDER等）
     * @param resourceId 资源ID
     * @param limit 返回记录数量
     * @return 该资源的所有操作历史
     */
    @Select("SELECT * FROM audit_log " +
            "WHERE resource_type = #{resourceType} " +
            "AND resource_id = #{resourceId} " +
            "ORDER BY created_at DESC " +
            "LIMIT #{limit}")
    List<AuditLog> selectByResource(
        @Param("resourceType") String resourceType,
        @Param("resourceId") String resourceId,
        @Param("limit") int limit
    );

    /**
     * SQL动态语句提供者
     * 
     * <p>使用MyBatis的Provider模式动态构建SQL语句，
     * 支持可选条件的灵活组合。</p>
     */
    class AuditLogSqlProvider extends ProviderMethodResolver {

        /**
         * 构建带过滤条件的查询SQL
         */
        public String selectLogsWithFilters(Map<String, Object> params) {
            return new SQL() {{
                SELECT("*");
                FROM("audit_log");
                
                String startTime = (String) params.get("startTime");
                String endTime = (String) params.get("endTime");
                String userId = (String) params.get("userId");
                String operationType = (String) params.get("operationType");
                
                if (startTime != null && !startTime.isEmpty()) {
                    WHERE("created_at >= #{startTime}");
                }
                if (endTime != null && !endTime.isEmpty()) {
                    WHERE("created_at <= #{endTime}");
                }
                if (userId != null && !userId.isEmpty()) {
                    WHERE("user_id = #{userId}");
                }
                if (operationType != null && !operationType.isEmpty()) {
                    WHERE("operation_type = #{operationType}");
                }
                
                ORDER_BY("created_at DESC");
            }}.toString();
        }

        /**
         * 构建带过滤条件的计数SQL
         */
        public String countLogsWithFilters(Map<String, Object> params) {
            return new SQL() {{
                SELECT("COUNT(*)");
                FROM("audit_log");
                
                String startTime = (String) params.get("startTime");
                String endTime = (String) params.get("endTime");
                String userId = (String) params.get("userId");
                String operationType = (String) params.get("operationType");
                
                if (startTime != null && !startTime.isEmpty()) {
                    WHERE("created_at >= #{startTime}");
                }
                if (endTime != null && !endTime.isEmpty()) {
                    WHERE("created_at <= #{endTime}");
                }
                if (userId != null && !userId.isEmpty()) {
                    WHERE("user_id = #{userId}");
                }
                if (operationType != null && !operationType.isEmpty()) {
                    WHERE("operation_type = #{operationType}");
                }
            }}.toString();
        }
    }
}