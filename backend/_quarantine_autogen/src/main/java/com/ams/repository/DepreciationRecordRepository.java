package com.ams.repository;

import com.ams.entity.DepreciationRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 资产折旧记录数据访问层接口
 * 提供折旧记录的增删改查及复杂查询功能，支持直线法和双倍余额递减法折旧计算的数据持久化
 *
 * @author SWARM-003 Implementation Team
 * @version 1.0.0
 */
@Mapper
public interface DepreciationRecordRepository {

    /**
     * 根据资产ID查询折旧记录列表
     *
     * @param assetId 资产ID
     * @return 折旧记录列表，按期间升序排列
     */
    List<DepreciationRecord> findByAssetId(@Param("assetId") Long assetId);

    /**
     * 根据资产ID和折旧方法查询折旧记录
     *
     * @param assetId        资产ID
     * @param depreciationMethod 折旧方法（straight_line/double_declining_balance）
     * @return 符合条件的折旧记录列表
     */
    List<DepreciationRecord> findByAssetIdAndMethod(
            @Param("assetId") Long assetId,
            @Param("depreciationMethod") String depreciationMethod);

    /**
     * 根据期间查询折旧记录
     *
     * @param period 折旧期间，格式：YYYY-MM
     * @return 折旧记录列表
     */
    List<DepreciationRecord> findByPeriod(@Param("period") String period);

    /**
     * 根据期间范围查询折旧记录
     *
     * @param startPeriod 开始期间（包含），格式：YYYY-MM
     * @param endPeriod   结束期间（包含），格式：YYYY-MM
     * @return 折旧记录列表
     */
    List<DepreciationRecord> findByPeriodBetween(
            @Param("startPeriod") String startPeriod,
            @Param("endPeriod") String endPeriod);

    /**
     * 根据资产ID和期间查询单条折旧记录
     * 用于校验同资产同期间不重复计算
     *
     * @param assetId 资产ID
     * @param period  折旧期间
     * @return 折旧记录，不存在返回null
     */
    DepreciationRecord findByAssetIdAndPeriod(
            @Param("assetId") Long assetId,
            @Param("period") String period);

    /**
     * 查询某期间所有资产的折旧汇总
     *
     * @param period 折旧期间
     * @return 每条记录包含资产ID和当期折旧金额汇总
     */
    List<DepreciationRecord> sumByPeriodGroupByAssetId(@Param("period") String period);

    /**
     * 计算某资产的累计折旧金额
     *
     * @param assetId 资产ID
     * @return 累计折旧总金额
     */
    BigDecimal sumAccumulatedDepreciationByAssetId(@Param("assetId") Long assetId);

    /**
     * 计算某期间的总折旧金额
     *
     * @param period 折旧期间
     * @return 当期折旧总金额
     */
    BigDecimal sumDepreciationByPeriod(@Param("period") String period);

    /**
     * 批量插入折旧记录
     * 支持一次性插入多条折旧记录，提高批量计算性能
     *
     * @param records 折旧记录列表
     * @return 成功插入的记录数
     */
    int batchInsert(@Param("records") List<DepreciationRecord> records);

    /**
     * 批量更新折旧记录
     *
     * @param records 折旧记录列表
     * @return 成功更新的记录数
     */
    int batchUpdate(@Param("records") List<DepreciationRecord> records);

    /**
     * 根据资产ID删除所有折旧记录
     * 通常在资产处置或重新计算时调用
     *
     * @param assetId 资产ID
     * @return 删除的记录数
     */
    int deleteByAssetId(@Param("assetId") Long assetId);

    /**
     * 根据资产ID和期间范围删除折旧记录
     *
     * @param assetId     资产ID
     * @param startPeriod 开始期间
     * @param endPeriod   结束期间
     * @return 删除的记录数
     */
    int deleteByAssetIdAndPeriodRange(
            @Param("assetId") Long assetId,
            @Param("startPeriod") String startPeriod,
            @Param("endPeriod") String endPeriod);

    /**
     * 分页查询折旧记录
     *
     * @param offset  偏移量
     * @param limit   每页记录数
     * @param period  可选筛选条件：折旧期间
     * @param assetId 可选筛选条件：资产ID
     * @return 分页的折旧记录列表
     */
    List<DepreciationRecord> findByPage(
            @Param("offset") int offset,
            @Param("limit") int limit,
            @Param("period") String period,
            @Param("assetId") Long assetId);

    /**
     * 统计折旧记录总数
     *
     * @param period  可选筛选条件：折旧期间
     * @param assetId 可选筛选条件：资产ID
     * @return 符合条件的记录总数
     */
    long count(
            @Param("period") String period,
            @Param("assetId") Long assetId);

    /**
     * 查询尚未完成折旧的资产记录
     * 用于识别需要继续计提折旧的活跃资产
     *
     * @param originalValue 原值下限
     * @return 仍有未摊销价值的资产列表
     */
    List<DepreciationRecord> findUndepreciatedAssets(@Param("originalValue") BigDecimal originalValue);

    /**
     * 根据折旧方法统计记录数
     *
     * @param depreciationMethod 折旧方法
     * @return 使用该方法的资产数量
     */
    long countByDepreciationMethod(@Param("depreciationMethod") String depreciationMethod);

    /**
     * 批量删除后重新计算折旧
     * 先删除指定资产指定期间的记录，再插入新计算的结果
     *
     * @param recordsToDelete 要删除的记录条件列表
     * @param recordsToInsert 要插入的新记录列表
     * @return 是否执行成功
     */
    int deleteAndReinsert(
            @Param("recordsToDelete") List<DepreciationRecord> recordsToDelete,
            @Param("recordsToInsert") List<DepreciationRecord> recordsToInsert);
}