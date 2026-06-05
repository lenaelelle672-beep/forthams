package com.ams.service;

import com.ams.entity.RiskMatrix;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

/**
 * 风险矩阵配置服务接口
 */
public interface RiskMatrixService {

    /**
     * 分页查询风险矩阵配置
     * @param pageNum 页码
     * @param pageSize 每页大小
     * @return 分页结果
     */
    Page<RiskMatrix> list(Integer pageNum, Integer pageSize);

    /**
     * 根据ID查询风险矩阵配置
     * @param id 矩阵ID
     * @return 风险矩阵配置
     */
    RiskMatrix getById(Long id);

    /**
     * 创建风险矩阵配置
     * @param matrix 矩阵配置
     * @return 创建后的矩阵配置
     */
    RiskMatrix create(RiskMatrix matrix);

    /**
     * 更新风险矩阵配置
     * @param id 矩阵ID
     * @param matrix 矩阵配置
     * @return 更新后的矩阵配置
     */
    RiskMatrix update(Long id, RiskMatrix matrix);

    /**
     * 删除风险矩阵配置
     * @param id 矩阵ID
     */
    void delete(Long id);

    /**
     * 获取租户启用的风险矩阵配置
     * @return 启用的风险矩阵配置列表
     */
    List<RiskMatrix> getActiveMatrix();

    /**
     * 根据矩阵配置计算风险等级
     * @param probability 概率（1-5）
     * @param severity 严重度（1-5）
     * @return 风险等级（LOW/MEDIUM/HIGH/CRITICAL）
     */
    String calculateRiskLevel(Integer probability, Integer severity);

    /**
     * 启用/禁用风险矩阵配置
     * @param id 矩阵ID
     * @param active 是否启用（1启用/0禁用）
     */
    void setActive(Long id, Integer active);
}