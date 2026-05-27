package com.ams.mapper;

import com.ams.entity.SysOperateLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface SysOperateLogMapper extends BaseMapper<SysOperateLog> {

    // ── SQL 聚合查询（用于审计统计仪表板）───────────────────────────────────────

    @Select("<script>"
            + "SELECT DATE_FORMAT(create_time, '%Y-%m-%d') AS timeBucket, COUNT(*) AS count "
            + "FROM sys_operate_log "
            + "WHERE create_time &gt;= #{startTime} AND create_time &lt;= #{endTime} "
            + "<if test='operationType != null'> AND business_type = #{operationType} </if>"
            + "GROUP BY DATE_FORMAT(create_time, '%Y-%m-%d') "
            + "ORDER BY timeBucket ASC"
            + "</script>")
    List<AuditLogMapper.TimeBucketRow> countTrendByDay(@Param("startTime") LocalDateTime startTime,
                                                        @Param("endTime") LocalDateTime endTime,
                                                        @Param("operationType") String operationType);

    @Select("<script>"
            + "SELECT business_type AS operationType, COUNT(*) AS count "
            + "FROM sys_operate_log "
            + "WHERE create_time &gt;= #{startTime} AND create_time &lt;= #{endTime} "
            + "<if test='operationType != null'> AND business_type = #{operationType} </if>"
            + "GROUP BY business_type "
            + "ORDER BY count DESC"
            + "</script>")
    List<AuditLogMapper.TypeCountRow> countDistributionByType(@Param("startTime") LocalDateTime startTime,
                                                               @Param("endTime") LocalDateTime endTime,
                                                               @Param("operationType") String operationType);

    @Select("<script>"
            + "SELECT COALESCE(operator_name, CAST(operator_id AS CHAR)) AS operatorId, COUNT(*) AS count "
            + "FROM sys_operate_log "
            + "WHERE create_time &gt;= #{startTime} AND create_time &lt;= #{endTime} "
            + "<if test='operationType != null'> AND business_type = #{operationType} </if>"
            + "GROUP BY operator_name, operator_id "
            + "ORDER BY count DESC "
            + "LIMIT #{limit}"
            + "</script>")
    List<AuditLogMapper.OperatorCountRow> countTopOperators(@Param("startTime") LocalDateTime startTime,
                                                             @Param("endTime") LocalDateTime endTime,
                                                             @Param("operationType") String operationType,
                                                             @Param("limit") int limit);

    @Select("<script>"
            + "SELECT COUNT(*) FROM sys_operate_log "
            + "WHERE create_time &gt;= #{startTime} AND create_time &lt;= #{endTime} "
            + "<if test='operationType != null'> AND business_type = #{operationType} </if>"
            + "</script>")
    Long countTotal(@Param("startTime") LocalDateTime startTime,
                    @Param("endTime") LocalDateTime endTime,
                    @Param("operationType") String operationType);
}
