package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AuditLogQueryDTO;
import com.ams.dto.AuditLogResponseDTO;
import com.ams.dto.AuditStatisticsDTO;
import com.ams.service.AuditService;
import com.ams.service.AuditDashboardService;
import com.github.pagehelper.PageInfo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 审计日志控制器
 * 提供审计日志查询接口，支持按时间范围、操作用户、操作类型过滤
 * 
 * @author AMS Team
 * @version 1.0
 * @since 2024-01
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/audit-logs")
@RequiredArgsConstructor
@Tag(name = "审计日志", description = "审计日志查询与管理接口")
@CrossOrigin(origins = "*")
public class AuditController {

    private final AuditService auditService;
    private final AuditDashboardService auditDashboardService;

    /**
     * 查询审计日志列表
     * 支持按时间范围、用户ID、操作类型过滤，支持分页
     *
     * @param startTime      开始时间 (ISO8601格式)
     * @param endTime        结束时间 (ISO8601格式)
     * @param userId         操作用户ID (可选)
     * @param username       操作用户名 (可选)
     * @param operationType  操作类型: CREATE/READ/UPDATE/DELETE (可选)
     * @param page           页码 (默认1)
     * @param pageSize       每页条数 (默认20, 最大100)
     * @return 分页后的审计日志列表
     */
    @GetMapping
    @Operation(
        summary = "查询审计日志列表",
        description = "支持按时间范围、操作用户、操作类型过滤，支持分页查询"
    )
    public Result<PageInfo<AuditLogResponseDTO>> getAuditLogs(
            @Parameter(description = "开始时间 (ISO8601格式)")
            @RequestParam(required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            
            @Parameter(description = "结束时间 (ISO8601格式)")
            @RequestParam(required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            
            @Parameter(description = "操作用户ID")
            @RequestParam(required = false) String userId,
            
            @Parameter(description = "操作用户名")
            @RequestParam(required = false) String username,
            
            @Parameter(description = "操作类型: CREATE/READ/UPDATE/DELETE")
            @RequestParam(required = false) String operationType,
            
            @Parameter(description = "页码 (默认1)")
            @RequestParam(defaultValue = "1") Integer page,
            
            @Parameter(description = "每页条数 (默认20, 最大100)")
            @RequestParam(defaultValue = "20") Integer pageSize) {
        
        log.info("查询审计日志 - 开始时间: {}, 结束时间: {}, 用户ID: {}, 用户名: {}, 操作类型: {}, 页码: {}, 每页条数: {}",
                startTime, endTime, userId, username, operationType, page, pageSize);
        
        // 限制每页最大条数
        if (pageSize > 100) {
            pageSize = 100;
        }
        if (pageSize < 1) {
            pageSize = 20;
        }
        if (page < 1) {
            page = 1;
        }
        
        // 构建查询DTO
        AuditLogQueryDTO queryDTO = AuditLogQueryDTO.builder()
                .startTime(startTime)
                .endTime(endTime)
                .userId(userId)
                .username(username)
                .operationType(operationType)
                .page(page)
                .pageSize(pageSize)
                .build();
        
        PageInfo<AuditLogResponseDTO> result = auditService.queryAuditLogs(queryDTO);
        
        log.info("查询审计日志完成 - 总记录数: {}", result.getTotal());
        
        return Result.success(result);
    }

    /**
     * 获取审计日志统计趋势
     * 返回指定天数内的操作数量趋势数据
     *
     * @param days 统计天数 (默认7, 可选7/30)
     * @return 趋势统计数据
     */
    @GetMapping("/statistics")
    @Operation(
        summary = "获取审计日志统计趋势",
        description = "返回指定天数内的操作数量趋势数据及按类型分布"
    )
    public Result<AuditStatisticsDTO> getAuditStatistics(
            @Parameter(description = "统计天数 (默认7, 可选7/30)")
            @RequestParam(defaultValue = "7") Integer days) {
        
        log.info("获取审计统计趋势 - 天数: {}", days);
        
        // 限制天数范围
        if (days != 7 && days != 30) {
            days = 7;
        }
        
        AuditStatisticsDTO statistics = auditDashboardService.getAuditStatistics(days);
        
        log.info("获取审计统计趋势完成 - 趋势数据点数: {}", 
                statistics.getTrend() != null ? statistics.getTrend().size() : 0);
        
        return Result.success(statistics);
    }

    /**
     * 获取单个审计日志详情
     *
     * @param id 审计日志ID
     * @return 审计日志详情
     */
    @GetMapping("/{id}")
    @Operation(
        summary = "获取审计日志详情",
        description = "根据ID获取单条审计日志的详细信息"
    )
    public Result<AuditLogResponseDTO> getAuditLogById(
            @Parameter(description = "审计日志ID")
            @PathVariable String id) {
        
        log.info("获取审计日志详情 - ID: {}", id);
        
        AuditLogResponseDTO auditLog = auditService.getAuditLogById(id);
        
        if (auditLog == null) {
            log.warn("审计日志不存在 - ID: {}", id);
            return Result.error("审计日志不存在");
        }
        
        return Result.success(auditLog);
    }

    /**
     * 导出审计日志
     * 支持按条件导出指定时间范围内的审计日志
     *
     * @param startTime 开始时间 (ISO8601格式)
     * @param endTime   结束时间 (ISO8601格式)
     * @param userId    操作用户ID (可选)
     * @param operationType 操作类型 (可选)
     * @return 导出结果
     */
    @GetMapping("/export")
    @Operation(
        summary = "导出审计日志",
        description = "导出指定时间范围内的审计日志为CSV格式"
    )
    public Result<Map<String, Object>> exportAuditLogs(
            @Parameter(description = "开始时间 (ISO8601格式)")
            @RequestParam(required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            
            @Parameter(description = "结束时间 (ISO8601格式)")
            @RequestParam(required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            
            @Parameter(description = "操作用户ID")
            @RequestParam(required = false) String userId,
            
            @Parameter(description = "操作类型: CREATE/READ/UPDATE/DELETE")
            @RequestParam(required = false) String operationType) {
        
        log.info("导出审计日志 - 开始时间: {}, 结束时间: {}, 用户ID: {}, 操作类型: {}",
                startTime, endTime, userId, operationType);
        
        // 构建查询条件
        AuditLogQueryDTO queryDTO = AuditLogQueryDTO.builder()
                .startTime(startTime)
                .endTime(endTime)
                .userId(userId)
                .operationType(operationType)
                .build();
        
        List<AuditLogResponseDTO> logs = auditService.queryAllAuditLogs(queryDTO);
        
        log.info("导出审计日志完成 - 待导出记录数: {}", logs.size());
        
        return Result.success(Map.of(
            "count", logs.size(),
            "message", "导出成功，请查看附件",
            "data", logs
        ));
    }

    /**
     * 获取操作类型统计
     * 返回各操作类型的数量分布
     *
     * @param startTime 开始时间 (可选)
     * @param endTime   结束时间 (可选)
     * @return 操作类型统计
     */
    @GetMapping("/by-type")
    @Operation(
        summary = "获取操作类型统计",
        description = "返回各操作类型的数量分布"
    )
    public Result<Map<String, Long>> getOperationTypeStatistics(
            @Parameter(description = "开始时间")
            @RequestParam(required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            
            @Parameter(description = "结束时间")
            @RequestParam(required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        
        log.info("获取操作类型统计 - 开始时间: {}, 结束时间: {}", startTime, endTime);
        
        Map<String, Long> typeStats = auditService.getOperationTypeStatistics(startTime, endTime);
        
        return Result.success(typeStats);
    }
}