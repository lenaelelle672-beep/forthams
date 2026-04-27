package com.ams.repository;

import com.ams.entity.OperationLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.SelectProvider;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.annotations.ResultType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 操作日志仓储层 (Operation Log Repository)
 * 
 * <p>职责：支撑操作日志仪表板 (SWARM-003) 的数据访问需求，
 * 提供日志聚合统计、趋势分析、风险分布等查询能力。
 * 
 * <p>数据范围：默认查询最近 90 天内的操作日志数据
 * 
 * <p>安全约束：
 * <ul>
 *   <li>敏感字段（如 password 变更详情）在应用层脱敏后返回</li>
 *   <li>禁止在 SQL 中暴露原始查询语句</li>
 * </ul>
 * 
 * @since SWARM-003 Iteration 1
 * @see OperationLog
 */
@Mapper
public interface OperationLogRepository extends BaseMapper<OperationLog> {

    /**
     * 聚合统计：按操作类型分组统计日志数量
     * 
     * <p>ATB-001 验证点：
     * <ul>
     *   <li>返回的 total_count 与数据库实际记录数一致</li>
     *   <li>支持按操作类型过滤</li>
     *   <li>超出 90 天范围时由 Service 层校验</li>
     * </ul>
     *
     * @param startDate 查询起始时间（含）
     * @param endDate   查询结束时间（含）
     * @return 操作类型与数量的映射列表
     */
    @Select("""
        SELECT operation_type AS operationType, 
               COUNT(*) AS count 
        FROM operation_logs 
        WHERE created_at >= #{startDate} 
          AND created_at <= #{endDate} 
        GROUP BY operation_type 
        ORDER BY count DESC
        """)
    List<Map<String, Object>> aggregateByOperationType(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    /**
     * 聚合统计：按风险等级分组统计日志数量及占比
     * 
     * <p>ATB-003 验证点：
     * <ul>
     *   <li>所有风险等级占比之和应为 100%</li>
     *   <li>支持的 risk_level 值：LOW, MEDIUM, HIGH, CRITICAL</li>
     * </ul>
     *
     * @param startDate 查询起始时间（含）
     * @param endDate   查询结束时间（含）
     * @return 风险等级与数量、占比的映射列表
     */
    @Select("""
        SELECT risk_level AS riskLevel,
               COUNT(*) AS count,
               ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS ratio
        FROM operation_logs 
        WHERE created_at >= #{startDate} 
          AND created_at <= #{endDate}
          AND risk_level IS NOT NULL
        GROUP BY risk_level
        ORDER BY 
            CASE risk_level 
                WHEN 'CRITICAL' THEN 1 
                WHEN 'HIGH' THEN 2 
                WHEN 'MEDIUM' THEN 3 
                WHEN 'LOW' THEN 4 
                ELSE 5 
            END
        """)
    List<Map<String, Object>> aggregateByRiskLevel(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    /**
     * 趋势分析：按日统计操作数量
     * 
     * <p>ATB-002 验证点：
     * <ul>
     *   <li>返回指定天数的数据点</li>
     *   <li>每个数据点包含 date 和 count 字段</li>
     *   <li>支持连续日期补零（无数据的天数 count=0）</li>
     * </ul>
     *
     * @param startDate 查询起始日期
     * @param endDate   查询结束日期
     * @return 每日日期与操作数量的映射列表
     */
    @Select("""
        SELECT DATE(created_at) AS date, 
               COUNT(*) AS count 
        FROM operation_logs 
        WHERE created_at >= #{startDate} 
          AND created_at < #{endDate} + INTERVAL '1 day'
        GROUP BY DATE(created_at) 
        ORDER BY date ASC
        """)
    List<Map<String, Object>> selectDailyTrend(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    /**
     * 趋势分析：按小时统计操作数量（用于日内趋势）
     * 
     * <p>适用场景：查看单日内的操作分布
     *
     * @param targetDate 目标日期
     * @return 每小时（0-23）与操作数量的映射列表
     */
    @Select("""
        SELECT EXTRACT(HOUR FROM created_at) AS hour, 
               COUNT(*) AS count 
        FROM operation_logs 
        WHERE DATE(created_at) = DATE(#{targetDate})
        GROUP BY EXTRACT(HOUR FROM created_at) 
        ORDER BY hour ASC
        """)
    List<Map<String, Object>> selectHourlyTrend(
            @Param("targetDate") LocalDateTime targetDate);

    /**
     * 分页查询：获取最近的日志列表
     * 
     * <p>ATB-004 验证点：
     * <ul>
     *   <li>敏感字段在返回前需由 Service 层脱敏处理</li>
     *   <li>支持按操作类型、用户 ID 过滤</li>
     * </ul>
     *
     * @param page         分页参数
     * @param startDate    查询起始时间（可选）
     * @param endDate      查询结束时间（可选）
     * @param operationType 操作类型过滤（可选）
     * @param userId       用户 ID 过滤（可选）
     * @param riskLevel    风险等级过滤（可选）
     * @return 分页日志列表
     */
    @SelectProvider(type = OperationLogSqlProvider.class, method = "selectRecentLogs")
    IPage<OperationLog> selectRecentLogs(
            Page<OperationLog> page,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("operationType") String operationType,
            @Param("userId") String userId,
            @Param("riskLevel") String riskLevel);

    /**
     * 统计：获取总日志数量
     * 
     * <p>用于仪表板概览数据
     *
     * @param startDate 查询起始时间（可选）
     * @param endDate   查询结束时间（可选）
     * @return 总记录数
     */
    @Select("""
        SELECT COUNT(*) FROM operation_logs 
        WHERE (#{startDate} IS NULL OR created_at >= #{startDate})
          AND (#{endDate} IS NULL OR created_at <= #{endDate})
        """)
    long countTotalLogs(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    /**
     * 统计：按操作类型获取唯一值列表
     * 
     * <p>用于前端筛选下拉框
     *
     * @return 所有不重复的操作类型
     */
    @Select("SELECT DISTINCT operation_type FROM operation_logs WHERE operation_type IS NOT NULL ORDER BY operation_type")
    List<String> selectDistinctOperationTypes();

    /**
     * 统计：按风险等级获取唯一值列表
     * 
     * <p>用于前端筛选下拉框
     *
     * @return 所有不重复的风险等级
     */
    @Select("SELECT DISTINCT risk_level FROM operation_logs WHERE risk_level IS NOT NULL ORDER BY risk_level")
    List<String> selectDistinctRiskLevels();

    /**
     * 统计：获取活跃用户数（有过操作记录的用户）
     * 
     * @param startDate 查询起始时间
     * @param endDate   查询结束时间
     * @return 活跃用户数
     */
    @Select("""
        SELECT COUNT(DISTINCT user_id) FROM operation_logs 
        WHERE created_at >= #{startDate} 
          AND created_at <= #{endDate}
          AND user_id IS NOT NULL
        """)
    int countActiveUsers(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    /**
     * 动态 SQL 提供器
     * 
     * <p>用于支持可选条件的动态查询构建
     */
    class OperationLogSqlProvider {
        
        /**
         * 构建动态查询 SQL
         * 
         * <p>支持以下可选过滤条件：
         * <ul>
         *   <li>时间范围 (startDate, endDate)</li>
         *   <li>操作类型 (operationType)</li>
         *   <li>用户 ID (userId)</li>
         *   <li>风险等级 (riskLevel)</li>
         * </ul>
         *
         * @param params 包含查询参数的 Map
         * @return 构建好的 SQL 语句
         */
        public String selectRecentLogs(Map<String, Object> params) {
            StringBuilder sql = new StringBuilder();
            sql.append("SELECT * FROM operation_logs WHERE 1=1");
            
            if (params.get("startDate") != null) {
                sql.append(" AND created_at >= #{startDate}");
            }
            if (params.get("endDate") != null) {
                sql.append(" AND created_at <= #{endDate}");
            }
            if (params.get("operationType") != null && !((String)params.get("operationType")).isEmpty()) {
                sql.append(" AND operation_type = #{operationType}");
            }
            if (params.get("userId") != null && !((String)params.get("userId")).isEmpty()) {
                sql.append(" AND user_id = #{userId}");
            }
            if (params.get("riskLevel") != null && !((String)params.get("riskLevel")).isEmpty()) {
                sql.append(" AND risk_level = #{riskLevel}");
            }
            
            sql.append(" ORDER BY created_at DESC");
            
            return sql.toString();
        }
    }
}