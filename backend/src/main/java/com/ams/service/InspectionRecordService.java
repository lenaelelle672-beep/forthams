package com.ams.service;

import com.ams.dto.InspectionStatisticsDTO;
import com.ams.entity.InspectionRecord;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 检验记录服务接口
 */
public interface InspectionRecordService {

    /**
     * 分页查询检验记录
     *
     * @param keyword    关键字
     * @param assetId    资产ID（可选）
     * @param inspectionType 检验类型（可选）
     * @param status     状态（可选）
     * @param startDate  开始日期（可选）
     * @param endDate    结束日期（可选）
     * @param pageNum    页码
     * @param pageSize   每页条数
     * @return 分页结果
     */
    Page<InspectionRecord> listRecords(String keyword, Long assetId, String inspectionType,
                                         String status, LocalDate startDate, LocalDate endDate,
                                         Integer pageNum, Integer pageSize);

    /**
     * 根据ID查询检验记录
     *
     * @param id 记录ID
     * @return 检验记录
     */
    InspectionRecord getRecordById(Long id);

    /**
     * 创建检验记录
     *
     * @param record 检验记录
     * @return 创建后的记录
     */
    InspectionRecord createRecord(InspectionRecord record);

    /**
     * 更新检验记录
     *
     * @param id     记录ID
     * @param record 检验记录
     * @return 更新后的记录
     */
    InspectionRecord updateRecord(Long id, InspectionRecord record);

    /**
     * 删除检验记录
     *
     * @param id 记录ID
     */
    void deleteRecord(Long id);

    /**
     * 根据资产ID查询检验记录
     *
     * @param assetId 资产ID
     * @return 检验记录列表
     */
    List<InspectionRecord> getRecordsByAssetId(Long assetId);

    /**
     * 根据模板自动创建检验记录
     *
     * @param assetId   资产ID
     * @param templateId 模板ID
     * @return 创建的检验记录
     */
    InspectionRecord createRecordFromTemplate(Long assetId, Long templateId);

    /**
     * 获取检验统计数据
     *
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 统计数据
     */
    InspectionStatisticsDTO getStatistics(LocalDate startDate, LocalDate endDate);

    /**
     * 获取图表数据（按类型统计）
     *
     * @return 图表数据列表
     */
    List<Map<String, Object>> getChartsDataByType();

    /**
     * 获取图表数据（按资产分类统计）
     *
     * @return 图表数据列表
     */
    List<Map<String, Object>> getChartsDataByAssetCategory();
}