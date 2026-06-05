package com.ams.service;

import com.ams.dto.BatchResult;

/**
 * ABC 分类服务接口
 * 提供基于价值区间的自动分类功能
 */
public interface ABCClassificationService {

    /**
     * 根据资产价值自动分类
     * 分类规则：左闭右开区间（originalValue >= minValue && originalValue < maxValue）
     *
     * @param assetId 资产 ID
     * @return 分类结果（A/B/C/CATEGORY/none），未匹配规则返回 'CATEGORY'
     */
    String classifyAsset(Long assetId);

    /**
     * 批量重新分类所有资产
     *
     * @return 批量操作结果（总数、成功数、失败数）
     */
    BatchResult reclassifyAll();

    /**
     * 按分类 ID 批量重新分类资产
     *
     * @param categoryIds 分类 ID 列表
     * @return 批量操作结果
     */
    BatchResult reclassifyByCategoryIds(java.util.List<Long> categoryIds);

    /**
     * 获取分类统计信息
     *
     * @return 分类统计数据
     */
    ClassificationStatistics getStatistics();

    /**
     * 查询资产当前分类
     *
     * @param assetId 资产 ID
     * @return 分类结果
     */
    String getByAssetId(Long assetId);

    /**
     * 分类统计数据
     */
    class ClassificationStatistics {
        private long A_count;
        private long B_count;
        private long C_count;
        private long CATEGORY_count;
        private java.math.BigDecimal A_total_value;
        private java.math.BigDecimal B_total_value;
        private java.math.BigDecimal C_total_value;
        private java.math.BigDecimal CATEGORY_total_value;

        // Getters and Setters
        public long getA_count() { return A_count; }
        public void setA_count(long A_count) { this.A_count = A_count; }
        public long getB_count() { return B_count; }
        public void setB_count(long B_count) { this.B_count = B_count; }
        public long getC_count() { return C_count; }
        public void setC_count(long C_count) { this.C_count = C_count; }
        public long getCATEGORY_count() { return CATEGORY_count; }
        public void setCATEGORY_count(long CATEGORY_count) { this.CATEGORY_count = CATEGORY_count; }
        public java.math.BigDecimal getA_total_value() { return A_total_value; }
        public void setA_total_value(java.math.BigDecimal A_total_value) { this.A_total_value = A_total_value; }
        public java.math.BigDecimal getB_total_value() { return B_total_value; }
        public void setB_total_value(java.math.BigDecimal B_total_value) { this.B_total_value = B_total_value; }
        public java.math.BigDecimal getC_total_value() { return C_total_value; }
        public void setC_total_value(java.math.BigDecimal C_total_value) { this.C_total_value = C_total_value; }
        public java.math.BigDecimal getCATEGORY_total_value() { return CATEGORY_total_value; }
        public void setCATEGORY_total_value(java.math.BigDecimal CATEGORY_total_value) { this.CATEGORY_total_value = CATEGORY_total_value; }
    }
}