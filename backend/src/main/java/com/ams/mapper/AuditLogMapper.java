package com.ams.mapper;

import com.ams.entity.GeneralAuditEntry;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

public interface AuditLogMapper extends BaseMapper<GeneralAuditEntry> {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    class TimeBucketRow {
        private String timeBucket;
        private Long count;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    class TypeCountRow {
        private String operationType;
        private Long count;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    class OperatorCountRow {
        private String operatorId;
        private Long count;
    }

    @Select("<script>"
            + "SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') AS timeBucket, "
            + "       COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE timestamp &gt;= #{startTime} "
            + "  AND timestamp &lt;  #{endTime} "
            + "<if test='operationType != null'>"
            + "  AND operation_type = #{operationType} "
            + "</if>"
            + "<if test='operatorId != null'>"
            + "  AND operator_id = #{operatorId} "
            + "</if>"
            + "<if test='module != null'>"
            + "  AND resource_type = #{module} "
            + "</if>"
            + "GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d') "
            + "ORDER BY timeBucket ASC"
            + "</script>")
    List<TimeBucketRow> countByDay(@Param("startTime") LocalDateTime startTime,
                                    @Param("endTime") LocalDateTime endTime,
                                    @Param("operationType") String operationType,
                                    @Param("operatorId") String operatorId,
                                    @Param("module") String module);

    @Select("<script>"
            + "SELECT DATE_FORMAT(timestamp, '%Y-%m-%dT%H:00:00') AS timeBucket, "
            + "       COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE timestamp &gt;= #{startTime} "
            + "  AND timestamp &lt;  #{endTime} "
            + "<if test='operationType != null'>"
            + "  AND operation_type = #{operationType} "
            + "</if>"
            + "<if test='operatorId != null'>"
            + "  AND operator_id = #{operatorId} "
            + "</if>"
            + "<if test='module != null'>"
            + "  AND resource_type = #{module} "
            + "</if>"
            + "GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%dT%H:00:00') "
            + "ORDER BY timeBucket ASC"
            + "</script>")
    List<TimeBucketRow> countByHour(@Param("startTime") LocalDateTime startTime,
                                     @Param("endTime") LocalDateTime endTime,
                                     @Param("operationType") String operationType,
                                     @Param("operatorId") String operatorId,
                                     @Param("module") String module);

    @Select("<script>"
            + "SELECT DATE_FORMAT(DATE_SUB(timestamp, INTERVAL WEEKDAY(timestamp) DAY), '%Y-%m-%d') AS timeBucket, "
            + "       COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE timestamp &gt;= #{startTime} "
            + "  AND timestamp &lt;  #{endTime} "
            + "<if test='operationType != null'>"
            + "  AND operation_type = #{operationType} "
            + "</if>"
            + "<if test='operatorId != null'>"
            + "  AND operator_id = #{operatorId} "
            + "</if>"
            + "<if test='module != null'>"
            + "  AND resource_type = #{module} "
            + "</if>"
            + "GROUP BY DATE_FORMAT(DATE_SUB(timestamp, INTERVAL WEEKDAY(timestamp) DAY), '%Y-%m-%d') "
            + "ORDER BY timeBucket ASC"
            + "</script>")
    List<TimeBucketRow> countByWeek(@Param("startTime") LocalDateTime startTime,
                                     @Param("endTime") LocalDateTime endTime,
                                     @Param("operationType") String operationType,
                                     @Param("operatorId") String operatorId,
                                     @Param("module") String module);

    @Select("SELECT operation_type AS operationType, "
            + "       COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE timestamp &gt;= #{startTime} "
            + "  AND timestamp &lt;  #{endTime} "
            + "GROUP BY operation_type "
            + "ORDER BY count DESC")
    List<TypeCountRow> countByOperationType(@Param("startTime") LocalDateTime startTime,
                                             @Param("endTime") LocalDateTime endTime);

    @Select("SELECT operator_id AS operatorId, "
            + "       COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE timestamp &gt;= #{startTime} "
            + "  AND timestamp &lt;  #{endTime} "
            + "GROUP BY operator_id "
            + "ORDER BY count DESC "
            + "LIMIT #{limit}")
    List<OperatorCountRow> countByOperator(@Param("startTime") LocalDateTime startTime,
                                            @Param("endTime") LocalDateTime endTime,
                                            @Param("limit") int limit);

    @Select("SELECT DISTINCT operation_type FROM general_audit_entry WHERE operation_type IS NOT NULL ORDER BY operation_type")
    List<String> findAllOperationTypes();
}
