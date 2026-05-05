package com.ams.mapper;

import com.ams.entity.DepreciationRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * 折旧记录 Mapper 接口
 * 
 * <p>提供折旧记录的数据库访问能力，支持以下功能：
 * <ul>
 *   <li>基础 CRUD 操作</li>
 *   <li>按资产ID查询折旧记录列表</li>
 *   <li>按期间查询折旧记录</li>
 *   <li>批量插入折旧记录</li>
 *   <li>查询指定资产在某一日期之前的累计折旧</li>
 * </ul>
 * 
 * @see DepreciationRecord
 * @since SWARM-003 Iteration 1
 */
@Mapper
public interface DepreciationRecordMapper extends BaseMapper<DepreciationRecord> {

    /**
     * 根据资产ID查询所有折旧记录
     * 
     * @param assetId 资产ID
     * @return 该资产的所有折旧记录列表，按期间升序排列
     */
    @Select("SELECT * FROM depreciation_records WHERE asset_id = #{assetId} ORDER BY period ASC")
    List<DepreciationRecord> selectByAssetId(@Param("assetId") UUID assetId);

    /**
     * 根据资产ID和期间查询折旧记录
     * 
     * @param assetId 资产ID
     * @param period 期间 (格式: YYYY-MM)
     * @return 对应的折旧记录，不存在则返回 null
     */
    @Select("SELECT * FROM depreciation_records WHERE asset_id = #{assetId} AND period = #{period}")
    DepreciationRecord selectByAssetIdAndPeriod(@Param("assetId") UUID assetId, @Param("period") String period);

    /**
     * 根据期间查询所有折旧记录
     * 
     * @param year 年份
     * @param month 月份
     * @return 该期间的所有折旧记录列表
     */
    @Select("SELECT * FROM depreciation_records WHERE period = #{year} || '-' || LPAD(#{month}::TEXT, 2, '0')")
    List<DepreciationRecord> selectByPeriod(@Param("year") int year, @Param("month") int month);

    /**
     * 查询指定资产在某一日期之前的累计折旧金额
     * 
     * @param assetId 资产ID
     * @param beforeDate 日期上限
     * @return 累计折旧金额
     */
    @Select("SELECT COALESCE(SUM(monthly_depreciation), 0) FROM depreciation_records " +
            "WHERE asset_id = #{assetId} AND depreciation_date < #{beforeDate}")
    BigDecimal selectAccumulatedDepreciation(
            @Param("assetId") UUID assetId, 
            @Param("beforeDate") LocalDate beforeDate);

    /**
     * 批量插入折旧记录
     * 
     * @param records 折旧记录列表
     * @return 成功插入的记录数
     */
    @Insert("<script>" +
            "INSERT INTO depreciation_records " +
            "(id, asset_id, period, depreciation_date, calculation_method, " +
            "original_value, accumulated_depreciation, current_net_value, monthly_depreciation, created_at) " +
            "VALUES " +
            "<foreach collection='records' item='record' separator=','>" +
            "(#{record.id}, #{record.assetId}, #{record.period}, #{record.depreciationDate}, " +
            "#{record.calculationMethod}, #{record.originalValue}, #{record.accumulatedDepreciation}, " +
            "#{record.currentNetValue}, #{record.monthlyDepreciation}, #{record.createdAt})" +
            "</foreach>" +
            "ON CONFLICT (asset_id, period) DO UPDATE SET " +
            "accumulated_depreciation = EXCLUDED.accumulated_depreciation, " +
            "current_net_value = EXCLUDED.current_net_value, " +
            "monthly_depreciation = EXCLUDED.monthly_depreciation, " +
            "created_at = EXCLUDED.created_at" +
            "</script>")
    int insertBatch(@Param("records") List<DepreciationRecord> records);

    /**
     * 删除指定资产的所有折旧记录
     * 
     * @param assetId 资产ID
     * @return 删除的记录数
     */
    @Delete("DELETE FROM depreciation_records WHERE asset_id = #{assetId}")
    int deleteByAssetId(@Param("assetId") UUID assetId);

    /**
     * 删除指定期间的所有折旧记录
     * 
     * @param period 期间 (格式: YYYY-MM)
     * @return 删除的记录数
     */
    @Delete("DELETE FROM depreciation_records WHERE period = #{period}")
    int deleteByPeriod(@Param("period") String period);

    /**
     * 查询资产的最新折旧记录
     * 
     * @param assetId 资产ID
     * @return 最新折旧记录，按期间降序排列取第一条
     */
    @Select("SELECT * FROM depreciation_records WHERE asset_id = #{assetId} ORDER BY period DESC LIMIT 1")
    DepreciationRecord selectLatestByAssetId(@Param("assetId") UUID assetId);

    /**
     * 查询指定期间范围内的折旧汇总
     * 
     * @param startPeriod 开始期间 (格式: YYYY-MM)
     * @param endPeriod 结束期间 (格式: YYYY-MM)
     * @return 该期间范围内的折旧记录列表
     */
    @Select("SELECT * FROM depreciation_records WHERE period >= #{startPeriod} AND period <= #{endPeriod} ORDER BY period ASC")
    List<DepreciationRecord> selectByPeriodRange(
            @Param("startPeriod") String startPeriod, 
            @Param("endPeriod") String endPeriod);

    /**
     * 统计指定期间的资产数量
     * 
     * @param year 年份
     * @param month 月份
     * @return 资产数量
     */
    @Select("SELECT COUNT(DISTINCT asset_id) FROM depreciation_records " +
            "WHERE period = #{year} || '-' || LPAD(#{month}::TEXT, 2, '0')")
    int countDistinctAssetByPeriod(@Param("year") int year, @Param("month") int month);

    /**
     * 计算指定期间的折旧总额
     * 
     * @param year 年份
     * @param month 月份
     * @return 折旧总额
     */
    @Select("SELECT COALESCE(SUM(monthly_depreciation), 0) FROM depreciation_records " +
            "WHERE period = #{year} || '-' || LPAD(#{month}::TEXT, 2, '0')")
    BigDecimal sumDepreciationByPeriod(@Param("year") int year, @Param("month") int month);
}