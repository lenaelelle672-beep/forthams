package com.ams.service;

import com.ams.entity.Inspection;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.time.LocalDate;
import java.util.List;

public interface InspectionService {
    Page<Inspection> listInspection(String keyword, String inspectionType, String result,
                                    LocalDate startDate, LocalDate endDate,
                                    Integer pageNum, Integer pageSize);
    Inspection getById(Long id);
    Inspection create(Inspection inspection);
    Inspection update(Long id, Inspection inspection);
    void delete(Long id);
    List<Inspection> getExpiringInspections(int days);

    /**
     * 根据资产ID查询检验历史（分页）
     *
     * @param assetId   资产ID
     * @param pageNum   页码
     * @param pageSize  每页条数
     * @return 分页结果
     */
    Page<Inspection> getHistoryByAssetId(Long assetId, Integer pageNum, Integer pageSize);

    // ==================== 自动生成检验任务方法 ====================

    /**
     * 自动生成检验任务（按资产ID列表或资产类别ID）
     * 使用分批次处理避免单次事务过大
     *
     * @param assetIds        资产ID列表（可为 null，按类别生成）
     * @param assetCategoryId 资产类别ID（可为 null，按资产ID列表生成）
     * @return 生成的检验记录列表
     */
    List<Inspection> autoGenerateInspections(List<Long> assetIds, Long assetCategoryId);

    /**
     * 查询资产的检验历史
     *
     * @param assetId 资产ID
     * @return 检验历史记录列表
     */
    List<Inspection> getInspectionHistory(Long assetId);

    // ==================== 定时任务方法 ====================

    /**
     * 定时任务：每天早上 8 点检查即将到期检验（提前 30 天提醒）
     * 查询即将到期的检验记录并发送通知
     */
    void checkExpiringInspections();

    /**
     * 定时任务：每天早上 8 点标记逾期检验（超过 nextInspectionDate）
     * 查询已逾期的检验记录并发送提醒
     */
    void markOverdueInspections();

    /**
     * 定时任务：每周一上午 9 点生成检验统计报告
     * 统计上周检验完成率、逾期率等指标并发送报告
     */
    void generateInspectionStatistics();

    // ==================== 批量操作方法 ====================

    /**
     * 批量生成检验任务(按资产ID列表)
     * 使用分批次处理避免单次事务过大
     *
     * @param assetIds 资产ID列表
     * @return 生成的检验记录列表
     */
    List<Inspection> batchGenerateInspections(List<Long> assetIds);

    /**
     * 按资产类别批量生成检验任务
     * 查询该类别下的所有资产并生成检验任务
     *
     * @param assetCategoryId 资产类别ID
     * @return 生成的检验记录列表
     */
    List<Inspection> batchGenerateByCategory(Long assetCategoryId);

    // ==================== 照片上传方法 ====================

    /**
     * 上传检验照片
     * 支持批量上传照片并关联到检验记录
     *
     * @param inspectionId 检验记录ID
     * @param photoUrls    照片URL列表
     */
    void uploadPhotos(Long inspectionId, List<String> photoUrls);

    // ==================== 报告生成方法 ====================

    /**
     * 生成检验报告
     * 支持生成 PDF 格式的检验报告
     *
     * @param inspectionId 检验记录ID
     * @param format       报告格式(目前仅支持 pdf)
     * @return 报告字节数组
     */
    byte[] generateReport(Long inspectionId, String format);
}
