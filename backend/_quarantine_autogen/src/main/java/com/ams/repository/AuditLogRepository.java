package com.ams.repository;

import com.ams.entity.AuditLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 审计日志数据访问层
 * 
 * <p>提供审计日志的数据库查询操作，支持按时间范围、用户ID、操作类型过滤
 * 以及分页查询功能。</p>
 * 
 * <p><b>相关需求:</b> SWARM-003 操作日志仪表板</p>
 * 
 * @since SWARM-003
 * @version 1.0
 */
@Mapper
public interface AuditLogRepository extends BaseMapper<AuditLog> {

    /**
     * 分页查询审计日志列表
     * 
     * <p>支持组合条件过滤：时间范围、用户ID、操作类型</p>
     * 
     * @param page 分页对象（包含页码和每页大小）
     * @param userId 用户ID（可选，null表示不筛选）
     * @param operationType 操作类型（可选，null表示不筛选）
     * @param startTime 开始时间（可选，null表示不限制）
     * @param endTime 结束时间（可选，null表示不限制）
     * @return 分页后的审计日志列表
     */
    @Select("<script>" +
            "SELECT * FROM audit_log WHERE 1=1 " +
            "<when test='userId != null'> AND user_id = #{userId} </when>" +
            "<when test='operationType != null'> AND operation_type = #{operationType} </when>" +
            "<when test='startTime != null'> AND created_at &gt;= #{startTime} </when>" +
            "<when test='endTime != null'> AND created_at &lt;= #{endTime} </when>" +
            "ORDER BY created_at DESC" +
            "</script>")
    IPage<AuditLog> selectAuditLogsByFilters(
            Page<AuditLog> page,
            @Param("userId") String userId,
            @Param("operationType") String operationType,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * 统计指定时间范围内的审计日志数量
     * 
     * <p>用于趋势图表数据展示</p>
     * 
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 审计日志数量
     */
    @Select("SELECT COUNT(*) FROM audit_log " +
            "WHERE created_at &gt;= #{startTime} AND created_at &lt;= #{endTime}")
    long countByTimeRange(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * 按日期统计每日审计日志数量
     * 
     * <p>返回指定天数内的每日操作统计，用于趋势图表</p>
     * 
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 每日统计结果列表 [{date: "2024-01-01", count: 120}, ...]
     */
    @Select("SELECT DATE(created_at) as date, COUNT(*) as count " +
            "FROM audit_log " +
            "WHERE created_at &gt;= #{startTime} AND created_at &lt;= #{endTime} " +
            "GROUP BY DATE(created_at) " +
            "ORDER BY date ASC")
    List<DailyStat> countByDay(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * 按操作类型统计审计日志数量
     * 
     * <p>返回各操作类型的统计分布</p>
     * 
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 操作类型统计列表 [{operationType: "CREATE", count: 50}, ...]
     */
    @Select("SELECT operation_type as operationType, COUNT(*) as count " +
            "FROM audit_log " +
            "WHERE created_at &gt;= #{startTime} AND created_at &lt;= #{endTime} " +
            "GROUP BY operation_type " +
            "ORDER BY count DESC")
    List<TypeStat> countByOperationType(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * 每日统计结果内部类
     * 
     * <p>用于接收 countByDay 查询结果</p>
     */
    interface DailyStat {
        /**
         * 获取统计日期
         * @return 日期字符串 (YYYY-MM-DD)
         */
        String getDate();
        
        /**
         * 获取该日期的操作数量
         * @return 操作数量
         */
        Long getCount();
    }

    /**
     * 操作类型统计结果内部类
     * 
     * <p>用于接收 countByOperationType 查询结果</p>
     */
    interface TypeStat {
        /**
         * 获取操作类型
         * @return 操作类型枚举值 (CREATE/READ/UPDATE/DELETE)
         */
        String getOperationType();
        
        /**
         * 获取该类型的操作数量
         * @return 操作数量
         */
        Long getCount();
    }
}