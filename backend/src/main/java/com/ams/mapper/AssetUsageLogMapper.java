package com.ams.mapper;

import com.ams.entity.AssetUsageLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Mapper
public interface AssetUsageLogMapper extends BaseMapper<AssetUsageLog> {

    @Select("SELECT DATE_FORMAT(usage_date, '%Y-%m') AS month, "
            + "COALESCE(SUM(duration_hours), 0) AS totalHours, "
            + "COUNT(DISTINCT usage_date) AS useDays "
            + "FROM asset_usage_log "
            + "WHERE asset_id = #{assetId} "
            + "AND usage_date >= #{startDate} "
            + "AND usage_date <= #{endDate} "
            + "GROUP BY DATE_FORMAT(usage_date, '%Y-%m') "
            + "ORDER BY month ASC")
    List<Map<String, Object>> selectUsageByMonth(@Param("assetId") Long assetId,
                                                  @Param("startDate") LocalDate startDate,
                                                  @Param("endDate") LocalDate endDate);

    @Select("SELECT COALESCE(SUM(duration_hours), 0) AS totalHours "
            + "FROM asset_usage_log "
            + "WHERE asset_id = #{assetId} "
            + "AND usage_date >= #{startDate} "
            + "AND usage_date <= #{endDate}")
    Map<String, Object> selectTotalUsage(@Param("assetId") Long assetId,
                                          @Param("startDate") LocalDate startDate,
                                          @Param("endDate") LocalDate endDate);

    @Select("SELECT a.id AS assetId, a.asset_name AS assetName, a.asset_no AS assetNo, "
            + "COALESCE(SUM(l.duration_hours), 0) AS totalHours, "
            + "MAX(l.usage_date) AS lastUsedDate "
            + "FROM asset a "
            + "LEFT JOIN asset_usage_log l ON a.id = l.asset_id "
            + "AND l.usage_date >= #{startDate} AND l.usage_date <= #{endDate} "
            + "WHERE a.deleted = 0 "
            + "GROUP BY a.id, a.asset_name, a.asset_no "
            + "ORDER BY totalHours DESC "
            + "LIMIT #{limit}")
    List<Map<String, Object>> selectTopUtilized(@Param("limit") int limit,
                                                 @Param("startDate") LocalDate startDate,
                                                 @Param("endDate") LocalDate endDate);

    @Select("SELECT a.id AS assetId, a.asset_name AS assetName, a.asset_no AS assetNo, "
            + "a.status, DATEDIFF(CURDATE(), MAX(l.usage_date)) AS idleDays "
            + "FROM asset a "
            + "LEFT JOIN asset_usage_log l ON a.id = l.asset_id "
            + "WHERE a.deleted = 0 "
            + "GROUP BY a.id, a.asset_name, a.asset_no, a.status "
            + "HAVING idleDays >= #{days} OR MAX(l.usage_date) IS NULL")
    List<Map<String, Object>> selectIdleAssets(@Param("days") int days);

    @Select("SELECT ac.category_name AS categoryName, "
            + "COALESCE(SUM(l.duration_hours), 0) AS usedHours, "
            + "COUNT(DISTINCT l.asset_id) AS usedAssetCount, "
            + "COUNT(DISTINCT a.id) AS totalAssetCount "
            + "FROM asset a "
            + "LEFT JOIN asset_category ac ON a.category_id = ac.id "
            + "LEFT JOIN asset_usage_log l ON a.id = l.asset_id "
            + "AND l.usage_date >= #{startDate} AND l.usage_date <= #{endDate} "
            + "WHERE a.deleted = 0 "
            + "GROUP BY ac.category_name")
    List<Map<String, Object>> selectSummaryByCategory(@Param("startDate") LocalDate startDate,
                                                       @Param("endDate") LocalDate endDate);

    @Select("SELECT d.dept_name AS deptName, "
            + "COALESCE(SUM(l.duration_hours), 0) AS usedHours, "
            + "COUNT(DISTINCT l.asset_id) AS usedAssetCount, "
            + "COUNT(DISTINCT a.id) AS totalAssetCount "
            + "FROM asset a "
            + "LEFT JOIN sys_dept d ON a.dept_id = d.id "
            + "LEFT JOIN asset_usage_log l ON a.id = l.asset_id "
            + "AND l.usage_date >= #{startDate} AND l.usage_date <= #{endDate} "
            + "WHERE a.deleted = 0 "
            + "GROUP BY d.dept_name")
    List<Map<String, Object>> selectSummaryByDept(@Param("startDate") LocalDate startDate,
                                                   @Param("endDate") LocalDate endDate);

}
