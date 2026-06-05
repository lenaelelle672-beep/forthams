package com.ams.mapper;

import com.ams.entity.EnergyConsumption;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Mapper
public interface EnergyConsumptionMapper extends BaseMapper<EnergyConsumption> {

    /**
     * S0.5f / S3-patch: cascade ids 预热版（已被 selectByLocationIds 取代保留向后兼容）
     */
    @Select("<script>" +
            "SELECT ec.* " +
            "FROM energy_consumption ec " +
            "INNER JOIN asset a ON ec.asset_id = a.id AND a.deleted = 0 " +
            "WHERE a.location_id IN " +
            "<foreach collection='locationIds' item='id' open='(' separator=',' close=')'>" +
            "  #{id}" +
            "</foreach> " +
            "AND ec.period_type = #{periodType} " +
            "AND ec.period_start BETWEEN #{start} AND #{end} " +
            "ORDER BY ec.period_start DESC" +
            "</script>")
    List<EnergyConsumption> selectByLocationIds(@Param("locationIds") List<Long> locationIds,
                                                  @Param("start") LocalDate start,
                                                  @Param("end") LocalDate end,
                                                  @Param("periodType") String periodType);

    /**
     * W24 step2 — /energy/ranking?scope=asset
     * 注：energy_consumption 无 tenant_id 列，已加入 TenantLineInnerInterceptor 白名单；
     * 走 asset JOIN 由 TenantLineInnerInterceptor 自动追加 WHERE a.tenant_id = ? 完成多租户隔离。
     */
    @Select("SELECT ec.asset_id AS assetId, " +
            "       a.asset_name AS assetName, " +
            "       a.asset_no AS assetNo, " +
            "       SUM(ec.consumption) AS consumption, " +
            "       ec.unit AS unit " +
            "FROM energy_consumption ec " +
            "LEFT JOIN asset a ON a.id = ec.asset_id AND a.deleted = 0 " +
            "WHERE ec.period_type = #{periodType} " +
            "  AND ec.period_start &gt;= #{start} " +
            "  AND ec.period_start &lt;= #{end} " +
            "  AND (#{meterType} IS NULL OR ec.meter_type = #{meterType}) " +
            "GROUP BY ec.asset_id, a.asset_name, a.asset_no, ec.unit " +
            "ORDER BY consumption DESC " +
            "LIMIT #{limit}")
    List<Map<String, Object>> rankingByAsset(@Param("start") LocalDate start,
                                              @Param("end") LocalDate end,
                                              @Param("periodType") String periodType,
                                              @Param("meterType") String meterType,
                                              @Param("limit") Integer limit);

    /**
     * W24 step2 — /energy/ranking?scope=building|floor|area
     * 走 location.ancestors LIKE 过滤 cascade 子树。
     * 使用 CDATA 包裹避免 MyBatis 把 SQL 当 XML 解析时遇到特殊字符报错。
     */
    @Select("<![CDATA[" +
            "SELECT l.id AS locationId, " +
            "       l.name AS locationName, " +
            "       l.location_type AS locationType, " +
            "       IFNULL(SUM(ec.consumption), 0) AS consumption, " +
            "       ec.unit AS unit " +
            "FROM location l " +
            "LEFT JOIN asset a ON FIND_IN_SET(a.location_id, l.ancestors) > 0 " +
            "  AND a.deleted = 0 " +
            "  AND a.location_id IS NOT NULL " +
            "LEFT JOIN energy_consumption ec ON ec.asset_id = a.id " +
            "  AND ec.period_type = #{periodType} " +
            "  AND ec.period_start >= #{start} " +
            "  AND ec.period_start <= #{end} " +
            "  AND (#{meterType} IS NULL OR ec.meter_type = #{meterType}) " +
            "WHERE l.location_type = #{locType} " +
            "  AND l.deleted = 0 " +
            "GROUP BY l.id, l.name, l.location_type, ec.unit " +
            "ORDER BY consumption DESC " +
            "LIMIT #{limit}" +
            "]]>")
    List<Map<String, Object>> rankingByLocation(@Param("locType") String locType,
                                                  @Param("start") LocalDate start,
                                                  @Param("end") LocalDate end,
                                                  @Param("periodType") String periodType,
                                                  @Param("meterType") String meterType,
                                                  @Param("limit") Integer limit);

    /**
     * W24 step2 — /locations/{id}/assets?withEnergy=true
     * 走 location.id = #{locationId} 或 location.ancestors LIKE 命中 cascade 子树。
     * 注意：使用纯 location（无别名） — MyBatis-Plus TenantLineInnerInterceptor
     * 在白名单 ignoreTable 中按表名（不含 alias）匹配，能正确放行。
     * 避免 CDATA 包裹以让 DataPermissionInterceptor 也能解析。
     */
    @Select("SELECT a.id AS assetId, " +
            "       a.asset_no AS assetNo, " +
            "       a.asset_name AS assetName, " +
            "       a.status AS status, " +
            "       a.location_id AS locationId, " +
            "       IFNULL(SUM(ec.consumption), 0) AS consumption, " +
            "       ec.unit AS unit, " +
            "       COUNT(ec.id) AS readingCount " +
            "FROM asset a " +
            "LEFT JOIN location ON a.location_id = location.id " +
            "LEFT JOIN energy_consumption ec ON ec.asset_id = a.id " +
            "  AND ec.period_type = #{periodType} " +
            "  AND ec.period_start >= #{start} " +
            "  AND ec.period_start <= #{end} " +
            "WHERE (a.location_id = #{locationId} " +
            "       OR location.ancestors LIKE CONCAT('%,', #{locationId}, ',%')) " +
            "  AND a.deleted = 0 " +
            "GROUP BY a.id, a.asset_no, a.asset_name, a.status, a.location_id, ec.unit " +
            "ORDER BY consumption DESC " +
            "LIMIT 500")
    List<Map<String, Object>> assetsByLocation(@Param("locationId") Long locationId,
                                                @Param("start") LocalDate start,
                                                @Param("end") LocalDate end,
                                                @Param("periodType") String periodType,
                                                @Param("withEnergy") Boolean withEnergy);
}
