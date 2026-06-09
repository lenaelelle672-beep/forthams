package com.ams.service;

import com.ams.entity.InspectionTemplate;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

/**
 * 检验模板服务接口
 */
public interface InspectionTemplateService {

    /**
     * 分页查询检验模板
     *
     * @param keyword    关键字（模板名称）
     * @param type       检验类型（可选）
     * @param pageNum    页码
     * @param pageSize   每页条数
     * @return 分页结果
     */
    Page<InspectionTemplate> listTemplates(String keyword, String type, Integer pageNum, Integer pageSize);

    /**
     * 根据ID查询检验模板
     *
     * @param id 模板ID
     * @return 检验模板
     */
    InspectionTemplate getTemplateById(Long id);

    /**
     * 创建检验模板
     *
     * @param template 检验模板
     * @return 创建后的模板
     */
    InspectionTemplate createTemplate(InspectionTemplate template);

    /**
     * 更新检验模板
     *
     * @param id       模板ID
     * @param template 检验模板
     * @return 更新后的模板
     */
    InspectionTemplate updateTemplate(Long id, InspectionTemplate template);

    /**
     * 复制检验模板
     *
     * @param id 源模板ID
     * @return 新复制的检验模板
     */
    InspectionTemplate copyTemplate(Long id);

    /**
     * 删除检验模板
     *
     * @param id 模板ID
     */
    void deleteTemplate(Long id);

    /**
     * 启用/禁用检验模板
     *
     * @param id     模板ID
     * @param status 状态（ACTIVE/DISABLED）
     */
    void toggleTemplateStatus(Long id, String status);

    /**
     * 根据资产类别获取适用的检验模板
     *
     * @param assetCategoryId 资产类别ID
     * @return 检验模板列表
     */
    List<InspectionTemplate> getTemplatesByAssetCategory(Long assetCategoryId);
}
