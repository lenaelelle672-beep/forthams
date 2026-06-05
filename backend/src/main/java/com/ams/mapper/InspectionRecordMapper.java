package com.ams.mapper;

import com.ams.entity.InspectionRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 检验记录 Mapper
 */
@Mapper
public interface InspectionRecordMapper extends BaseMapper<InspectionRecord> {

    /**
     * 查询即将到期的检验记录
     *
     * @param tenantId    租户ID
     * @param warningDate 警告日期
     * @return 即将到期的检验记录列表
     */
    List<InspectionRecord> selectExpiringInspections(@Param("tenantId") String tenantId,
                                                       @Param("warningDate") LocalDate warningDate);

    /**
     * 查询已逾期的检验记录
     *
     * @param tenantId   租户ID
     * @param currentDate 当前日期
     * @return 已逾期的检验记录列表
     */
    List<InspectionRecord> selectOverdueInspections(@Param("tenantId") String tenantId,
                                                     @Param("currentDate") LocalDate currentDate);

    /**
     * 按日期范围统计检验记录
     *
     * @param tenantId  租户ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 统计结果
     */
    Map<String, Object> selectStatisticsByDateRange(@Param("tenantId") String tenantId,
                                                      @Param("startDate") LocalDate startDate,
                                                      @Param("endDate") LocalDate endDate);

    /**
     * 按检验类型统计
     *
     * @param tenantId 租户ID
     * @return 统计结果列表
     */
    List<Map<String, Object>> selectStatisticsByType(@Param("tenantId") String tenantId);

    /**
     * 按资产分类统计
     *
     * @param tenantId 租户ID
     * @return 统计结果列表
     */
    List<Map<String, Object>> selectStatisticsByAssetCategory(@Param("tenantId") String tenantId);

    /**
     * 按资产ID查询检验记录
     *
     * @param tenantId 租户ID
     * @param assetId  资产ID
     * @return 检验记录列表
     */
    List<InspectionRecord> selectByAssetId(@Param("tenantId") String tenantId,
                                            @Param("assetId") Long assetId);
}