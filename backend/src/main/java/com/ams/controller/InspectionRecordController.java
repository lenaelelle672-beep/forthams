package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.InspectionStatisticsDTO;
import com.ams.entity.InspectionRecord;
import com.ams.service.InspectionRecordService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 检验记录控制器
 * 提供检验记录的 CRUD 操作和统计报表
 */
@RestController
@RequestMapping("/inspection-records")
@RequiredArgsConstructor
public class InspectionRecordController {

    private final InspectionRecordService recordService;

    /**
     * 分页查询检验记录
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:query')")
    @GetMapping({"", "/list"})
    public Result<Page<InspectionRecord>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String inspectionType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(recordService.listRecords(keyword, assetId, inspectionType,
                status, startDate, endDate, pageNum, pageSize));
    }

    /**
     * 根据ID查询检验记录
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:query')")
    @GetMapping("/{id}")
    public Result<InspectionRecord> getById(@PathVariable Long id) {
        return Result.success(recordService.getRecordById(id));
    }

    /**
     * 创建检验记录
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:create')")
    @PostMapping
    public Result<InspectionRecord> create(@Valid @RequestBody InspectionRecord record) {
        return Result.success(recordService.createRecord(record));
    }

    /**
     * 更新检验记录
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:edit')")
    @PutMapping("/{id}")
    public Result<InspectionRecord> update(@PathVariable Long id, @Valid @RequestBody InspectionRecord record) {
        return Result.success(recordService.updateRecord(id, record));
    }

    /**
     * 删除检验记录
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        recordService.deleteRecord(id);
        return Result.success();
    }

    /**
     * 按资产查询检验记录
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:query')")
    @GetMapping("/asset/{assetId}")
    public Result<List<InspectionRecord>> getByAssetId(@PathVariable Long assetId) {
        return Result.success(recordService.getRecordsByAssetId(assetId));
    }

    /**
     * 根据模板自动创建检验记录
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:create')")
    @PostMapping("/from-template")
    public Result<InspectionRecord> createFromTemplate(@RequestParam Long assetId,
                                                        @RequestParam Long templateId) {
        return Result.success(recordService.createRecordFromTemplate(assetId, templateId));
    }

    /**
     * 统计报表
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:statistics')")
    @GetMapping("/statistics")
    public Result<InspectionStatisticsDTO> getStatistics(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate) {
        return Result.success(recordService.getStatistics(startDate, endDate));
    }

    /**
     * 图表数据 - 按检验类型
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:charts')")
    @GetMapping("/charts/by-type")
    public Result<List<Map<String, Object>>> getChartsByType() {
        return Result.success(recordService.getChartsDataByType());
    }

    /**
     * 图表数据 - 按资产分类
     */
    @PreAuthorize("@ss.hasPermi('inspection:record:charts')")
    @GetMapping("/charts/by-category")
    public Result<List<Map<String, Object>>> getChartsByCategory() {
        return Result.success(recordService.getChartsDataByAssetCategory());
    }
}