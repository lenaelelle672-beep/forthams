package com.ams.mapper;

import com.ams.entity.AssetDepreciation;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 资产折旧 Mapper 接口
 * 
 * <p>职责说明：
 * <ul>
 *   <li>提供资产折旧数据的持久化操作</li>
 *   <li>支持直线法和双倍余额递减法折旧计算结果的存储</li>
 *   <li>提供折旧数据的批量更新和查询能力</li>
 * </ul>
 * 
 * <p>关联实体：
 * <ul>
 *   <li>{@link com.ams.entity.AssetDepreciation}</li>
 *   <li>{@link com.ams.entity.Asset}</li>
 *   <li>{@link com.ams.entity.DepreciationRecord}</li>
 * </ul>
 * 
 * <p>使用约束：
 * <ul>
 *   <li>资产原值必须 > 0</li>
 *   <li>预计使用年限 >= 1（年为单位）</li>
 *   <li>残值率范围：0% ~ 50%</li>
 * </ul>
 * 
 * @author SWARM-003 Team
 * @version 1.0.0
 * @since Iteration 1
 */
@Mapper
public interface AssetDepreciationMapper extends BaseMapper<AssetDepreciation> {

    /**
     * 根据资产编码查询折旧记录
     * 
     * <p>功能说明：
     * 根据资产唯一编码查询该资产的所有折旧记录，按折旧日期升序排列。
     * 
     * @param assetCode 资产编码（唯一标识）
     * @return 折旧记录列表
     */
    @Select("SELECT * FROM asset_depreciation WHERE asset_code = #{assetCode} ORDER BY depreciation_date ASC")
    List<AssetDepreciation> findByAssetCode(@Param("assetCode") String assetCode);

    /**
     * 根据日期范围查询折旧记录
     * 
     * <p>功能说明：
     * 查询指定日期范围内的所有折旧记录，支持报表生成和数据分析。
     * 
     * @param startDate 开始日期（包含）
     * @param endDate 结束日期（包含）
     * @return 折旧记录列表
     */
    @Select("SELECT * FROM asset_depreciation WHERE depreciation_date >= #{startDate} AND depreciation_date <= #{endDate} ORDER BY depreciation_date ASC")
    List<AssetDepreciation> findByDateRange(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 根据资产编码和日期查询单条折旧记录
     * 
     * <p>功能说明：
     * 用于幂等性检查，确保同一月份不会重复计算折旧。
     * 
     * @param assetCode 资产编码
     * @param depreciationDate 折旧日期
     * @return 折旧记录（可能为 null）
     */
    @Select("SELECT * FROM asset_depreciation WHERE asset_code = #{assetCode} AND depreciation_date = #{depreciationDate} LIMIT 1")
    AssetDepreciation findByAssetCodeAndDate(
            @Param("assetCode") String assetCode,
            @Param("depreciationDate") LocalDate depreciationDate);

    /**
     * 更新资产的当前账面净值
     * 
     * <p>功能说明：
     * 在折旧计算完成后，更新资产的当前账面净值。
     * 
     * @param assetCode 资产编码
     * @param currentBookValue 当前账面净值
     * @return 更新行数
     */
    @Update("UPDATE asset SET current_book_value = #{currentBookValue}, updated_at = NOW() WHERE asset_code = #{assetCode}")
    int updateCurrentBookValue(
            @Param("assetCode") String assetCode,
            @Param("currentBookValue") BigDecimal currentBookValue);

    /**
     * 批量更新资产折旧数据
     * 
     * <p>功能说明：
     * 用于定时任务批量计算后的数据更新，支持最多 50,000 条资产同时处理。
     * 
     * @param assetCodes 资产编码列表
     * @param calculationDate 计算日期
     * @return 更新行数
     */
    @Update("<script>" +
            "UPDATE asset SET current_book_value = (" +
            "  SELECT COALESCE(MAX(ending_book_value), current_book_value) " +
            "  FROM asset_depreciation " +
            "  WHERE asset_depreciation.asset_code = asset.asset_code " +
            "  AND depreciation_date <= #{calculationDate}" +
            "), updated_at = NOW() " +
            "WHERE asset_code IN " +
            "<foreach collection='assetCodes' item='code' open='(' separator=',' close=')'>" +
            "  #{code}" +
            "</foreach>" +
            "</script>")
    int batchUpdateBookValue(
            @Param("assetCodes") List<String> assetCodes,
            @Param("calculationDate") LocalDate calculationDate);

    /**
     * 查询待计算折旧的资产列表
     * 
     * <p>功能说明：
     * 查询所有状态为 ACTIVE 且尚未全额计提折旧的资产。
     * 排除已处置（DISPOSED）和已全额折旧的资产。
     * 
     * @param cutoffDate 截止日期
     * @return 待折旧资产编码列表
     */
    @Select("SELECT a.asset_code FROM asset a " +
            "WHERE a.status = 'ACTIVE' " +
            "AND a.current_book_value > (a.original_value * COALESCE(a.salvage_rate, 5) / 100) " +
            "AND NOT EXISTS (" +
            "  SELECT 1 FROM asset_depreciation ad " +
            "  WHERE ad.asset_code = a.asset_code " +
            "  AND ad.depreciation_date = #{cutoffDate}" +
            ")")
    List<String> findAssetsPendingDepreciation(@Param("cutoffDate") LocalDate cutoffDate);

    /**
     * 获取资产的累计折旧金额
     * 
     * <p>功能说明：
     * 计算指定资产从购置到当前日期的累计折旧金额。
     * 
     * @param assetCode 资产编码
     * @return 累计折旧金额
     */
    @Select("SELECT COALESCE(SUM(depreciation_amount), 0) FROM asset_depreciation WHERE asset_code = #{assetCode}")
    BigDecimal getAccumulatedDepreciation(@Param("assetCode") String assetCode);

    /**
     * 根据批次号查询折旧记录
     * 
     * <p>功能说明：
     * 用于追溯特定批次计算任务的执行结果。
     * 批次号格式：DEP + yyyyMMddHHmmss
     * 
     * @param batchNumber 批次号
     * @return 折旧记录列表
     */
    @Select("SELECT * FROM asset_depreciation WHERE batch_number = #{batchNumber} ORDER BY asset_code ASC")
    List<AssetDepreciation> findByBatchNumber(@Param("batchNumber") String batchNumber);
}