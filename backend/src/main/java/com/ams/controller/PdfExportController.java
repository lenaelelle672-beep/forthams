package com.ams.controller;

import com.ams.entity.StocktakingCycle;
import com.ams.entity.StocktakingTask;
import com.ams.mapper.StocktakingCycleMapper;
import com.ams.mapper.StocktakingTaskMapper;
import com.ams.service.PdfExportService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * PDF 导出控制器 — 提供资产清单、维修工单、盘点报告的 PDF 导出端点
 */
@RestController
@RequestMapping("/pdf")
@RequiredArgsConstructor
@Tag(name = "PDF 导出", description = "资产清单、维修工单、盘点报告 PDF 导出")
public class PdfExportController {

    private final PdfExportService pdfExportService;
    private final StocktakingCycleMapper cycleMapper;
    private final StocktakingTaskMapper taskMapper;

    /**
     * 导出资产清单 PDF
     *
     * @return PDF 字节数组
     */
    @Operation(summary = "导出资产清单 PDF", description = "生成资产台账 PDF 报表")
    @GetMapping("/assets")
    public ResponseEntity<byte[]> exportAssetPdf() {
        // 这里应该查询资产数据，为了简单起见，先使用空数据
        // 实际项目中应该注入 AssetService 并查询数据
        Map<String, Object> data = new HashMap<>();
        data.put("totalAssets", 0);
        data.put("activeAssets", 0);
        data.put("idleAssets", 0);
        data.put("pendingApproval", 0);
        data.put("retiredAssets", 0);
        data.put("totalValue", 0.0);
        data.put("assets", Collections.emptyList());

        byte[] pdfBytes = pdfExportService.exportReport("asset-register", data);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "asset-register.pdf");
        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }

    /**
     * 导出维修工单 PDF
     *
     * @return PDF 字节数组
     */
    @Operation(summary = "导出维修工单 PDF", description = "生成工单统计 PDF 报表")
    @GetMapping("/workorders")
    public ResponseEntity<byte[]> exportWorkOrderPdf() {
        // 这里应该查询工单数据，为了简单起见，先使用空数据
        // 实际项目中应该注入 WorkOrderService 并查询数据
        Map<String, Object> data = new HashMap<>();
        data.put("totalWorkOrders", 0);
        data.put("completedOrders", 0);
        data.put("completionRate", 0);
        data.put("inProgressOrders", 0);
        data.put("pendingOrders", 0);
        data.put("overdueOrders", 0);
        data.put("statusDistribution", Collections.emptyList());
        data.put("deptRanking", Collections.emptyList());
        data.put("recentOrders", Collections.emptyList());

        byte[] pdfBytes = pdfExportService.exportReport("workorder-summary", data);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "workorder-summary.pdf");
        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }

    /**
     * 导出盘点报告 PDF
     *
     * @param cycleId 盘点周期 ID（可选，不传则导出最近一次盘点）
     * @return PDF 字节数组
     */
    @Operation(summary = "导出盘点报告 PDF", description = "生成盘点报告 PDF 报表")
    @GetMapping("/stocktaking")
    public ResponseEntity<byte[]> exportStocktakingPdf(
            @RequestParam(required = false) Long cycleId) {
        // 获取盘点周期
        StocktakingCycle cycle;
        if (cycleId != null) {
            cycle = cycleMapper.selectById(cycleId);
        } else {
            // 获取最近一次盘点周期
            List<StocktakingCycle> cycles = cycleMapper.selectList(
                    new LambdaQueryWrapper<StocktakingCycle>()
                            .orderByDesc(StocktakingCycle::getCreateTime)
                            .last("LIMIT 1"));
            cycle = cycles.isEmpty() ? null : cycles.get(0);
        }

        Map<String, Object> data = new HashMap<>();
        if (cycle != null) {
            // 盘点周期信息
            data.put("cycleName", cycle.getCycleName());
            data.put("cycleType", cycle.getCycleType());
            data.put("startDate", cycle.getStartDate() != null ? 
                    cycle.getStartDate().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")) : "-");
            data.put("endDate", cycle.getEndDate() != null ? 
                    cycle.getEndDate().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")) : "-");
            data.put("status", cycle.getStatus());

            // 获取盘点任务
            List<StocktakingTask> tasks = taskMapper.selectList(
                    new LambdaQueryWrapper<StocktakingTask>()
                            .eq(StocktakingTask::getCycleId, cycle.getId())
                            .orderByAsc(StocktakingTask::getId));

            // 统计数据
            int totalTasks = tasks.size();
            long completedTasks = tasks.stream().filter(t -> "COMPLETED".equals(t.getStatus())).count();
            long pendingTasks = tasks.stream().filter(t -> "PENDING".equals(t.getStatus())).count();
            long countedTasks = tasks.stream().filter(t -> "COUNTED".equals(t.getStatus())).count();
            long varianceCount = tasks.stream().filter(t -> t.getVariance() != null && t.getVariance() != 0).count();
            double completionRate = totalTasks > 0 ? (double) completedTasks / totalTasks * 100 : 0;

            data.put("totalTasks", totalTasks);
            data.put("completedTasks", completedTasks);
            data.put("pendingTasks", pendingTasks);
            data.put("countedTasks", countedTasks);
            data.put("varianceCount", varianceCount);
            data.put("completionRate", String.format("%.1f", completionRate));

            // 任务明细（需要关联资产信息，这里简化处理）
            List<Map<String, Object>> taskList = new ArrayList<>();
            for (StocktakingTask task : tasks) {
                Map<String, Object> taskMap = new HashMap<>();
                taskMap.put("id", task.getId());
                taskMap.put("assetNo", "ASSET-" + task.getAssetId()); // 简化处理
                taskMap.put("assetName", "资产-" + task.getAssetId()); // 简化处理
                taskMap.put("expectedQuantity", task.getExpectedQuantity());
                taskMap.put("actualQuantity", task.getActualQuantity());
                taskMap.put("variance", task.getVariance());
                taskMap.put("status", task.getStatus());
                taskMap.put("countedBy", task.getCountedBy() != null ? String.valueOf(task.getCountedBy()) : "-");
                taskMap.put("countTime", task.getCountTime() != null ? 
                        task.getCountTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "-");
                taskList.add(taskMap);
            }
            data.put("tasks", taskList);
        } else {
            // 无盘点周期数据
            data.put("cycleName", "无");
            data.put("cycleType", "无");
            data.put("startDate", "-");
            data.put("endDate", "-");
            data.put("status", "无");
            data.put("totalTasks", 0);
            data.put("completedTasks", 0);
            data.put("pendingTasks", 0);
            data.put("countedTasks", 0);
            data.put("varianceCount", 0);
            data.put("completionRate", "0.0");
            data.put("tasks", Collections.emptyList());
        }

        byte[] pdfBytes = pdfExportService.exportReport("stocktaking-report", data);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "stocktaking-report.pdf");
        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }
}