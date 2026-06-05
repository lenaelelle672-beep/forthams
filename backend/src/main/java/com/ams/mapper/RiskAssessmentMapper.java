package com.ams.mapper;

import com.ams.entity.RiskAssessment;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface RiskAssessmentMapper extends BaseMapper<RiskAssessment> {

    @Select("SELECT ra.probability, ra.impact, ra.risk_level, COUNT(*) as cnt " +
            "FROM risk_assessment ra " +
            "JOIN asset a ON ra.asset_id = a.id " +
            "WHERE ra.deleted = 0 AND a.deleted = 0 " +
            "AND ra.tenant_id = #{tenantId} " +
            "GROUP BY ra.probability, ra.impact, ra.risk_level")
    List<Map<String, Object>> selectHeatmapData(@Param("tenantId") String tenantId);

    @Select("<script>" +
            "SELECT " +
            "  <choose>" +
            "    <when test='period == \"day\"'>" +
            "      DATE(create_time) as period, " +
            "    </when>" +
            "    <when test='period == \"week\"'>" +
            "      DATE(DATE_SUB(create_time, INTERVAL WEEKDAY(create_time) DAY)) as period, " +
            "    </when>" +
            "    <when test='period == \"month\"'>" +
            "      DATE_FORMAT(create_time, '%Y-%m-01') as period, " +
            "    </when>" +
            "    <otherwise>" +
            "      DATE_FORMAT(create_time, '%Y-%m-01') as period, " +
            "    </otherwise>" +
            "  </choose>" +
            "  risk_level, " +
            "  COUNT(*) as count " +
            "FROM risk_assessment " +
            "WHERE deleted = 0 " +
            "  AND tenant_id = #{tenantId} " +
            "  <if test='startDate != null and startDate != \"\"'>" +
            "    AND create_time &gt;= #{startDate} " +
            "  </if>" +
            "  <if test='endDate != null and endDate != \"\"'>" +
            "    AND create_time &lt;= #{endDate} " +
            "  </if>" +
            "GROUP BY period, risk_level " +
            "ORDER BY period ASC, FIELD(risk_level, 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')" +
            "</script>")
    List<Map<String, Object>> selectRiskLevelTrend(
            @Param("tenantId") String tenantId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("period") String period
    );
}
