package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.InspectionTemplate;
import com.ams.service.InspectionTemplateService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 检验模板控制器
 * 提供模板的 CRUD 操作
 */
@RestController
@RequestMapping("/inspection-templates")
@RequiredArgsConstructor
public class InspectionTemplateController {

    private final InspectionTemplateService templateService;

    /**
     * 分页查询检验模板
     */
    @PreAuthorize("@ss.hasPermi('inspection:template:query')")
    @GetMapping({"", "/list"})
    public Result<Page<InspectionTemplate>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(templateService.listTemplates(keyword, type, pageNum, pageSize));
    }

    /**
     * 根据ID查询检验模板
     */
    @PreAuthorize("@ss.hasPermi('inspection:template:query')")
    @GetMapping("/{id}")
    public Result<InspectionTemplate> getById(@PathVariable Long id) {
        return Result.success(templateService.getTemplateById(id));
    }

    /**
     * 创建检验模板
     */
    @PreAuthorize("@ss.hasPermi('inspection:template:create')")
    @PostMapping
    public Result<InspectionTemplate> create(@Valid @RequestBody InspectionTemplate template) {
        return Result.success(templateService.createTemplate(template));
    }

    /**
     * 更新检验模板
     */
    @PreAuthorize("@ss.hasPermi('inspection:template:edit')")
    @PutMapping("/{id}")
    public Result<InspectionTemplate> update(@PathVariable Long id, @Valid @RequestBody InspectionTemplate template) {
        return Result.success(templateService.updateTemplate(id, template));
    }

    /**
     * 删除检验模板
     */
    @PreAuthorize("@ss.hasPermi('inspection:template:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        templateService.deleteTemplate(id);
        return Result.success();
    }

    /**
     * 启用/禁用检验模板
     */
    @PreAuthorize("@ss.hasPermi('inspection:template:edit')")
    @PutMapping("/{id}/status")
    public Result<Void> toggleStatus(@PathVariable Long id, @RequestParam String status) {
        templateService.toggleTemplateStatus(id, status);
        return Result.success();
    }

    /**
     * 根据资产类别获取适用的检验模板
     */
    @PreAuthorize("@ss.hasPermi('inspection:template:query')")
    @GetMapping("/by-category/{categoryId}")
    public Result<java.util.List<InspectionTemplate>> getByCategory(@PathVariable Long categoryId) {
        return Result.success(templateService.getTemplatesByAssetCategory(categoryId));
    }
}