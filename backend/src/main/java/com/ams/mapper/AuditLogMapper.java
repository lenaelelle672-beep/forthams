package com.ams.mapper;

import com.ams.dto.OperatorRankingVO;
import com.ams.dto.TrendVO;
import com.ams.dto.TypeDistributionVO;
import com.ams.entity.GeneralAuditEntry;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Audit log MyBatis-Plus Mapper.
 *
 * <p>Provides CRUD operations via {@link BaseMapper} and custom aggregation
 * queries consumed by {@code AuditDashboardService} to power the audit
 * dashboard visualisation endpoints.</p>
 *
 * <h3>Aggregation methods</h3>
 * <ul>
 *   <li>{@link #countByDay} – daily time-bucket trend</li>
 *   <li>{@link #countByHour} – hourly time-bucket trend (≤ 3-day range)</li>
 *   <li>{@link #countByOperationType} – operation-type distribution</li>
 *   <li>{@link #countByOperator} – top-N operator activity ranking</li>
 * </ul>
 *
 * <p>All time parameters are interpreted as <strong>UTC</strong>. The underlying
 * queries rely on the composite index on {@code (timestamp, operation_type,
 * operator_id)} to satisfy the P95 &lt; 2000 ms performance constraint.</p>
 */
public interface AuditLogMapper extends BaseMapper<GeneralAuditEntry> {

    // ------------------------------------------------------------------ //
    //  Time-trend aggregation (day granularity)                           //
    // ------------------------------------------------------------------ //

    /**
     * Aggregate audit log counts bucketed by <strong>day</strong> within the
     * given time range.
     *
     * <p>Each row in the result represents one calendar day (UTC). Days with
     * zero events are <em>not</em> returned – the service layer is responsible
     * for filling gaps when rendering a continuous chart.</p>
     *
     * @param startTime      range start (inclusive, UTC)
     * @param endTime        range end (exclusive, UTC)
     * @param operationType  optional filter; when {@code null} all types are included
     * @return day-bucketed trend data ordered chronologically
     */
    @Select("<script>"
            + "SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') AS time_bucket, "
            + "       COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE timestamp &gt;= #{startTime} "
            + "  AND timestamp &lt;  #{endTime} "
            + "<if test='operationType != null'>"
            + "  AND operation_type = #{operationType} "
            + "</if>"
            + "GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d') "
            + "ORDER BY time_bucket ASC"
            + "</script>")
    List<TrendVO> countByDay(@Param("startTime") LocalDateTime startTime,
                             @Param("endTime") LocalDateTime endTime,
                             @Param("operationType") String operationType);

    // ------------------------------------------------------------------ //
    //  Time-trend aggregation (hour granularity)                          //
    // ------------------------------------------------------------------ //

    /**
     * Aggregate audit log counts bucketed by <strong>hour</strong> within the
     * given time range.
     *
     * <p>Should only be invoked when the query span is ≤ 3 days (enforced at
     * the service/controller layer). The {@code time_bucket} format is
     * {@code yyyy-MM-dd'T'HH:00:00} to align with ISO-8601 expectations.</p>
     *
     * @param startTime      range start (inclusive, UTC)
     * @param endTime        range end (exclusive, UTC)
     * @param operationType  optional filter; when {@code null} all types are included
     * @return hour-bucketed trend data ordered chronologically
     */
    @Select("<script>"
            + "SELECT DATE_FORMAT(timestamp, '%Y-%m-%dT%H:00:00') AS time_bucket, "
            + "       COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE timestamp &gt;= #{startTime} "
            + "  AND timestamp &lt;  #{endTime} "
            + "<if test='operationType != null'>"
            + "  AND operation_type = #{operationType} "
            + "</if>"
            + "GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%dT%H:00:00') "
            + "ORDER BY time_bucket ASC"
            + "</script>")
    List<TrendVO> countByHour(@Param("startTime") LocalDateTime startTime,
                              @Param("endTime") LocalDateTime endTime,
                              @Param("operationType") String operationType);

    // ------------------------------------------------------------------ //
    //  Operation-type distribution aggregation                            //
    // ------------------------------------------------------------------ //

    /**
     * Aggregate audit log counts grouped by {@code operation_type} within the
     * given time range.
     *
     * <p>Results are sorted by count descending so that the most frequent
     * operation types appear first – convenient for pie/bar chart rendering.</p>
     *
     * @param startTime  range start (inclusive, UTC)
     * @param endTime    range end (exclusive, UTC)
     * @return per-type distribution data
     */
    @Select("SELECT operation_type AS operationType, "
            + "       COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE timestamp &gt;= #{startTime} "
            + "  AND timestamp &lt;  #{endTime} "
            + "GROUP BY operation_type "
            + "ORDER BY count DESC")
    List<TypeDistributionVO> countByOperationType(@Param("startTime") LocalDateTime startTime,
                                                  @Param("endTime") LocalDateTime endTime);

    // ------------------------------------------------------------------ //
    //  Operator activity ranking aggregation                              //
    // ------------------------------------------------------------------ //

    /**
     * Aggregate audit log counts grouped by {@code operator_id}, returning only
     * the top {@code limit} most active operators.
     *
     * <p>The service layer caps {@code limit} at 10 (the default and maximum)
     * to prevent unbounded result sets.</p>
     *
     * @param startTime  range start (inclusive, UTC)
     * @param endTime    range end (exclusive, UTC)
     * @param limit      maximum number of operators to return (≤ 10)
     * @return operator ranking data sorted by count descending
     */
    @Select("SELECT operator_id AS operatorId, "
            + "       COUNT(*) AS count "
            + "FROM general_audit_entry "
            + "WHERE timestamp &gt;= #{startTime} "
            + "  AND timestamp &lt;  #{endTime} "
            + "GROUP BY operator_id "
            + "ORDER BY count DESC "
            + "LIMIT #{limit}")
    List<OperatorRankingVO> countByOperator(@Param("startTime") LocalDateTime startTime,
                                            @Param("endTime") LocalDateTime endTime,
                                            @Param("limit") int limit);
}