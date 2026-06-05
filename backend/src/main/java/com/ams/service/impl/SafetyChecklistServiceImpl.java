package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.dto.SafetyChecklistBatchResult;
import com.ams.dto.WorkOrderDTO;
import com.ams.entity.*;
import com.ams.mapper.*;
import com.ams.service.NotificationService;
import com.ams.service.PdfExportService;
import com.ams.service.SafetyChecklistAttachmentService;
import com.ams.service.SafetyChecklistService;
import com.ams.service.TenantService;
import com.ams.service.WorkOrderService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SafetyChecklistServiceImpl implements SafetyChecklistService {
    private final SafetyChecklistTemplateMapper templateMapper;
    private final SafetyChecklistItemMapper itemMapper;
    private final SafetyChecklistExecutionMapper executionMapper;
    private final SafetyChecklistResultMapper resultMapper;
    private final WorkOrderService workOrderService;
    private final NotificationService notificationService;
    private final SafetyChecklistAttachmentService safetyChecklistAttachmentService;
    private final PdfExportService pdfExportService;
    private final TenantService tenantService;

    // ── 模板 CRUD ─────────────────────────────────────────────────────────────

    @Override
    public Page<SafetyChecklistTemplate> listTemplates(String keyword, Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<SafetyChecklistTemplate> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<SafetyChecklistTemplate> wrapper = new LambdaQueryWrapper<SafetyChecklistTemplate>()
                .eq(SafetyChecklistTemplate::getTenantId, tenantId);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(SafetyChecklistTemplate::getTemplateName, keyword);
        }
        wrapper.orderByDesc(SafetyChecklistTemplate::getCreateTime);
        return templateMapper.selectPage(page, wrapper);
    }

    @Override
    public SafetyChecklistTemplate getTemplateById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return templateMapper.selectOne(new LambdaQueryWrapper<SafetyChecklistTemplate>()
                .eq(SafetyChecklistTemplate::getId, id)
                .eq(SafetyChecklistTemplate::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SafetyChecklistTemplate createTemplate(SafetyChecklistTemplate template) {
        String tenantId = TenantContext.requireTenantId();
        template.setTenantId(tenantId);
        if (template.getStatus() == null) {
            template.setStatus("ACTIVE");
        }
        templateMapper.insert(template);
        return template;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SafetyChecklistTemplate updateTemplate(Long id, SafetyChecklistTemplate template) {
        String tenantId = TenantContext.requireTenantId();
        SafetyChecklistTemplate existing = getTemplateById(id);
        if (existing == null) {
            throw new IllegalArgumentException("Template not found");
        }
        template.setId(id);
        template.setTenantId(tenantId);
        templateMapper.updateById(template);
        return getTemplateById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteTemplate(Long id) {
        SafetyChecklistTemplate existing = getTemplateById(id);
        if (existing == null) {
            throw new IllegalArgumentException("Template not found");
        }
        // 级联删除检查项
        itemMapper.delete(new LambdaQueryWrapper<SafetyChecklistItem>()
                .eq(SafetyChecklistItem::getTemplateId, id));
        templateMapper.deleteById(id);
    }

    // ── 检查项管理 ─────────────────────────────────────────────────────────────

    @Override
    public List<SafetyChecklistItem> getItemsByTemplateId(Long templateId) {
        return itemMapper.selectList(new LambdaQueryWrapper<SafetyChecklistItem>()
                .eq(SafetyChecklistItem::getTemplateId, templateId)
                .orderByAsc(SafetyChecklistItem::getSortOrder));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SafetyChecklistItem createItem(SafetyChecklistItem item) {
        itemMapper.insert(item);
        return item;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SafetyChecklistItem updateItem(Long id, SafetyChecklistItem item) {
        SafetyChecklistItem existing = itemMapper.selectById(id);
        if (existing == null) {
            throw new IllegalArgumentException("Item not found");
        }
        item.setId(id);
        itemMapper.updateById(item);
        return itemMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteItem(Long id) {
        itemMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void batchSaveItems(Long templateId, List<SafetyChecklistItem> items) {
        // 删除旧项
        itemMapper.delete(new LambdaQueryWrapper<SafetyChecklistItem>()
                .eq(SafetyChecklistItem::getTemplateId, templateId));
        // 批量新增
        for (int i = 0; i < items.size(); i++) {
            SafetyChecklistItem item = items.get(i);
            item.setTemplateId(templateId);
            if (item.getSortOrder() == null) {
                item.setSortOrder(i);
            }
            itemMapper.insert(item);
        }
    }

    // ── 执行流程 ───────────────────────────────────────────────────────────────

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SafetyChecklistExecution startExecution(Long templateId, Long assetId, Long executorId) {
        String tenantId = TenantContext.requireTenantId();
        SafetyChecklistExecution execution = new SafetyChecklistExecution();
        execution.setTemplateId(templateId);
        execution.setAssetId(assetId);
        execution.setExecutorId(executorId);
        execution.setExecuteDate(LocalDate.now());
        execution.setStatus("IN_PROGRESS");
        execution.setTenantId(tenantId);
        executionMapper.insert(execution);
        return execution;
    }

    @Override
    public SafetyChecklistExecution getExecutionById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return executionMapper.selectOne(new LambdaQueryWrapper<SafetyChecklistExecution>()
                .eq(SafetyChecklistExecution::getId, id)
                .eq(SafetyChecklistExecution::getTenantId, tenantId));
    }

    @Override
    public Page<SafetyChecklistExecution> listExecutions(Long templateId, Long assetId, String status,
                                                          Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<SafetyChecklistExecution> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<SafetyChecklistExecution> wrapper = new LambdaQueryWrapper<SafetyChecklistExecution>()
                .eq(SafetyChecklistExecution::getTenantId, tenantId);
        if (templateId != null) {
            wrapper.eq(SafetyChecklistExecution::getTemplateId, templateId);
        }
        if (assetId != null) {
            wrapper.eq(SafetyChecklistExecution::getAssetId, assetId);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(SafetyChecklistExecution::getStatus, status);
        }
        wrapper.orderByDesc(SafetyChecklistExecution::getCreateTime);
        return executionMapper.selectPage(page, wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void submitResults(Long executionId, List<SafetyChecklistResult> results) {
        SafetyChecklistExecution execution = getExecutionById(executionId);
        if (execution == null) {
            throw new IllegalArgumentException("Execution not found");
        }
        // 删除旧结果后重新插入
        resultMapper.delete(new LambdaQueryWrapper<SafetyChecklistResult>()
                .eq(SafetyChecklistResult::getExecutionId, executionId));
        for (SafetyChecklistResult result : results) {
            result.setExecutionId(executionId);
            resultMapper.insert(result);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SafetyChecklistExecution completeExecution(Long executionId) {
        SafetyChecklistExecution execution = getExecutionById(executionId);
        if (execution == null) {
            throw new IllegalArgumentException("Execution not found");
        }

        // 获取所有检查结果
        List<SafetyChecklistResult> results = getResultsByExecutionId(executionId);

        // 判断是否有 FAIL
        boolean hasFail = results.stream().anyMatch(r -> "FAIL".equals(r.getResult()));
        boolean allPass = results.stream().allMatch(r -> "PASS".equals(r.getResult()) || "NA".equals(r.getResult()));

        // 计算总体结果
        if (allPass) {
            execution.setOverallResult("PASS");
        } else if (hasFail) {
            execution.setOverallResult("FAIL");
        } else {
            execution.setOverallResult("CONDITIONAL");
        }

        execution.setStatus("COMPLETED");
        executionMapper.updateById(execution);

        // 如果有 FAIL 项，自动生成整改工单
        if (hasFail) {
            autoCreateRemedyWorkOrder(execution, results);
        }

        return execution;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteExecution(Long executionId) {
        SafetyChecklistExecution execution = getExecutionById(executionId);
        if (execution == null) {
            throw new IllegalArgumentException("Execution not found");
        }

        // 级联删除：先清理所有相关的照片
        List<SafetyChecklistResult> results = getResultsByExecutionId(executionId);
        for (SafetyChecklistResult result : results) {
            // 删除该结果的所有照片
            List<com.ams.entity.SysAttachment> attachments =
                    safetyChecklistAttachmentService.getAttachments(result.getId());
            for (com.ams.entity.SysAttachment attachment : attachments) {
                safetyChecklistAttachmentService.deleteAttachment(attachment.getId());
                // TODO: 删除物理文件（从文件系统或对象存储中删除）
                log.info("[文件清理] 已删除照片: filePath={}", attachment.getFilePath());
            }
        }

        // 删除结果
        resultMapper.delete(new LambdaQueryWrapper<SafetyChecklistResult>()
                .eq(SafetyChecklistResult::getExecutionId, executionId));

        // 删除执行记录
        executionMapper.deleteById(executionId);

        log.info("[执行记录删除] 已删除执行记录及其所有照片: executionId={}", executionId);
    }

    /**
     * 自动生成整改工单 — 安全检查不合规项
     */
    private void autoCreateRemedyWorkOrder(SafetyChecklistExecution execution, List<SafetyChecklistResult> results) {
        try {
            // 找出所有 FAIL 的检查项
            List<Long> failItemIds = results.stream()
                    .filter(r -> "FAIL".equals(r.getResult()))
                    .map(SafetyChecklistResult::getItemId)
                    .collect(Collectors.toList());

            if (failItemIds.isEmpty()) return;

            // 查询检查项名称
            List<SafetyChecklistItem> failItems = itemMapper.selectList(
                    new LambdaQueryWrapper<SafetyChecklistItem>()
                            .in(SafetyChecklistItem::getId, failItemIds));

            String failItemNames = failItems.stream()
                    .map(SafetyChecklistItem::getItemName)
                    .collect(Collectors.joining("、"));

            WorkOrderDTO dto = new WorkOrderDTO();
            dto.setTitle("安全检查不合规整改");
            dto.setDescription("安全检查执行记录 #" + execution.getId()
                    + " 中发现以下不合规项：" + failItemNames
                    + "。请尽快安排整改。");
            dto.setPriority("HIGH");
            dto.setAssetId(execution.getAssetId());
            dto.setReporterId(execution.getExecutorId());
            dto.setDeptId(null);

            workOrderService.createWorkOrder(dto);
            log.info("[SafetyChecklist] 已为执行记录 {} 生成整改工单，不合规项：{}", execution.getId(), failItemNames);
        } catch (RuntimeException e) {
            log.error("[SafetyChecklist] 自动生成整改工单失败", e);
        }
    }

    // ── 执行结果 ───────────────────────────────────────────────────────────────

    @Override
    public List<SafetyChecklistResult> getResultsByExecutionId(Long executionId) {
        return resultMapper.selectList(new LambdaQueryWrapper<SafetyChecklistResult>()
                .eq(SafetyChecklistResult::getExecutionId, executionId));
    }

    // ── 定时检查 ───────────────────────────────────────────────────────────────

    /**
     * 定时检查即将到期的安全检查任务，发送提醒通知
     * 每天早上9点执行（错峰优化，避开 T5.2 的 8 点高峰）
     */
    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional(rollbackFor = Exception.class)
    @Override
    public void checkExpiringSafetyChecklists() {
        log.info("开始执行即将到期安全检查任务检查");
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                checkExpiringForTenant(tenantId);
            } catch (RuntimeException e) {
                log.error("租户 {} 安全检查任务到期检查失败: {}", tenantId, e.getMessage(), e);
            }
        }
        log.info("即将到期安全检查任务检查完成");
    }

    /**
     * 定时检查逾期执行任务，每小时第30分钟执行
     * 查找状态为 IN_PROGRESS 且执行日期超过7天的任务，标记为逾期并发送通知
     */
    @Scheduled(cron = "0 30 * * * ?")
    @Transactional(rollbackFor = Exception.class)
    @Override
    public void checkOverdueExecutions() {
        log.info("开始执行逾期安全检查执行任务检查");
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                checkOverdueForTenant(tenantId);
            } catch (RuntimeException e) {
                log.error("租户 {} 逾期执行任务检查失败: {}", tenantId, e.getMessage(), e);
            }
        }
        log.info("逾期安全检查执行任务检查完成");
    }

    /**
     * 检查特定租户的逾期执行任务
     *
     * @param tenantId 租户ID
     */
    private void checkOverdueForTenant(String tenantId) {
        // 查找状态为 IN_PROGRESS 且执行日期超过7天的任务
        LocalDate thresholdDate = LocalDate.now().minusDays(7);
        int pageSize = 100;
        int currentPage = 1;
        int totalOverdue = 0;

        while (true) {
            // 分页查询进行中的任务
            Page<SafetyChecklistExecution> page = new Page<>(currentPage, pageSize);
            LambdaQueryWrapper<SafetyChecklistExecution> wrapper = new LambdaQueryWrapper<SafetyChecklistExecution>()
                    .eq(SafetyChecklistExecution::getTenantId, tenantId)
                    .eq(SafetyChecklistExecution::getStatus, "IN_PROGRESS")
                    .lt(SafetyChecklistExecution::getExecuteDate, thresholdDate)
                    .orderByAsc(SafetyChecklistExecution::getExecuteDate);

            Page<SafetyChecklistExecution> result = executionMapper.selectPage(page, wrapper);
            List<SafetyChecklistExecution> executions = result.getRecords();

            if (executions.isEmpty()) {
                break;
            }

            for (SafetyChecklistExecution execution : executions) {
                try {
                    sendOverdueNotification(execution, tenantId);
                    totalOverdue++;
                } catch (RuntimeException e) {
                    log.error("发送逾期执行任务通知失败，执行记录ID: {}: {}", execution.getId(), e.getMessage(), e);
                }
            }

            currentPage++;
        }

        if (totalOverdue > 0) {
            log.info("租户 {} 发现 {} 个逾期执行任务", tenantId, totalOverdue);
        }
    }

    /**
     * 发送逾期执行任务通知
     *
     * @param execution 执行记录
     * @param tenantId  租户ID
     */
    private void sendOverdueNotification(SafetyChecklistExecution execution, String tenantId) {
        // 获取模板信息
        SafetyChecklistTemplate template = templateMapper.selectById(execution.getTemplateId());
        String templateName = template != null ? template.getTemplateName() : "未知模板";

        // 构建通知内容
        String title = "安全检查执行任务逾期";
        String content = String.format("安全检查任务 \"%s\" 已逾期 %d 天，请尽快完成执行。任务开始日期：%s",
                templateName, LocalDate.now().toEpochDay() - execution.getExecuteDate().toEpochDay(), execution.getExecuteDate());

        // 发送通知给执行人
        if (execution.getExecutorId() != null) {
            notificationService.sendByTemplate(
                    "safety_checklist_overdue",
                    Map.of(
                            "templateName", templateName,
                            "executeDate", execution.getExecuteDate().toString(),
                            "daysOverdue", String.valueOf(LocalDate.now().toEpochDay() - execution.getExecuteDate().toEpochDay())
                    ),
                    execution.getExecutorId(),
                    execution.getId(),
                    "SAFETY_CHECKLIST_EXECUTION"
            );
        }

        log.info("[SafetyChecklist] 已发送逾期执行任务通知，执行记录ID: {}，模板: {}",
                execution.getId(), templateName);
    }

    /**
     * 检查特定租户的即将到期安全检查任务
     *
     * @param tenantId 租户ID
     */
    private void checkExpiringForTenant(String tenantId) {
        // 查找状态为 IN_PROGRESS 且执行日期超过7天的任务（即将逾期提醒）
        LocalDate warningDate = LocalDate.now().plusDays(7);
        List<SafetyChecklistExecution> soonToExpireExecutions = executionMapper.selectList(
                new LambdaQueryWrapper<SafetyChecklistExecution>()
                        .eq(SafetyChecklistExecution::getTenantId, tenantId)
                        .eq(SafetyChecklistExecution::getStatus, "IN_PROGRESS")
                        .lt(SafetyChecklistExecution::getExecuteDate, warningDate)
        );

        for (SafetyChecklistExecution execution : soonToExpireExecutions) {
            try {
                sendExpiryReminder(execution, tenantId);
            } catch (RuntimeException e) {
                log.error("发送安全检查任务提醒失败，执行记录ID: {}: {}", execution.getId(), e.getMessage(), e);
            }
        }
    }

    /**
     * 发送安全检查任务到期提醒
     *
     * @param execution 执行记录
     * @param tenantId  租户ID
     */
    private void sendExpiryReminder(SafetyChecklistExecution execution, String tenantId) {
        // 获取模板信息
        SafetyChecklistTemplate template = templateMapper.selectById(execution.getTemplateId());
        String templateName = template != null ? template.getTemplateName() : "未知模板";

        // 构建通知内容
        String title = "安全检查任务即将到期";
        String content = String.format("安全检查任务 \"%s\" 将在 %d 天后到期，请尽快完成执行。任务开始日期：%s",
                templateName, execution.getExecuteDate().toEpochDay() - LocalDate.now().toEpochDay(), execution.getExecuteDate());

        // 发送通知给执行人
        if (execution.getExecutorId() != null) {
            notificationService.sendByTemplate(
                    "safety_checklist_expiry_reminder",
                    Map.of(
                            "templateName", templateName,
                            "executeDate", execution.getExecuteDate().toString(),
                            "daysRemaining", String.valueOf(execution.getExecuteDate().toEpochDay() - LocalDate.now().toEpochDay())
                    ),
                    execution.getExecutorId(),
                    execution.getId(),
                    "SAFETY_CHECKLIST_EXECUTION"
            );
        }

        log.info("[SafetyChecklist] 已发送安全检查任务提醒，执行记录ID: {}，模板: {}",
                execution.getId(), templateName);
    }

    /**
     * 获取活跃租户列表
     */
    private List<String> getActiveTenantIds() {
        // 从 TenantService 获取配置化租户 ID 列表（阶段 1 占位实现）
        return tenantService.getActiveTenantIds();
    }

    // ── 批量执行 ───────────────────────────────────────────────────────────────

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SafetyChecklistBatchResult batchStartExecutions(Long templateId, List<Long> assetIds, Long executorId) {
        String tenantId = TenantContext.requireTenantId();
        if (assetIds == null || assetIds.isEmpty()) {
            throw new IllegalArgumentException("资产ID列表不能为空");
        }

        log.info("开始批量启动安全检查执行: templateId={}, assetIds={}, executorId={}", templateId, assetIds.size(), executorId);

        // 验证模板存在
        SafetyChecklistTemplate template = templateMapper.selectOne(
                new LambdaQueryWrapper<SafetyChecklistTemplate>()
                        .eq(SafetyChecklistTemplate::getId, templateId)
                        .eq(SafetyChecklistTemplate::getTenantId, tenantId)
        );
        if (template == null) {
            throw new IllegalArgumentException("模板不存在: templateId=" + templateId);
        }

        // 使用分批次处理（每批次100条）
        int batchSize = 100;
        int successCount = 0;
        int failCount = 0;
        java.util.List<Long> failedAssetIds = new java.util.ArrayList<>();
        Map<Long, SafetyChecklistExecution> results = new java.util.HashMap<>();

        for (int i = 0; i < assetIds.size(); i += batchSize) {
            int end = Math.min(i + batchSize, assetIds.size());
            List<Long> batchAssetIds = assetIds.subList(i, end);

            for (Long assetId : batchAssetIds) {
                try {
                    SafetyChecklistExecution execution = startExecution(templateId, assetId, executorId);
                    successCount++;
                    results.put(assetId, execution);
                } catch (RuntimeException e) {
                    failCount++;
                    failedAssetIds.add(assetId);
                    log.error("启动安全检查执行失败: templateId={}, assetId={}", templateId, assetId, e);
                }
            }
        }

        log.info("批量启动安全检查执行完成: 成功={}, 失败={}", successCount, failCount);

        return SafetyChecklistBatchResult.builder()
                .successCount(successCount)
                .failCount(failCount)
                .failedAssetIds(failedAssetIds)
                .results(results)
                .build();
    }

    // ── PDF 报告生成 ─────────────────────────────────────────────────────────────

    @Override
    public byte[] generateReport(Long executionId) {
        // 查询执行记录
        SafetyChecklistExecution execution = getExecutionById(executionId);
        if (execution == null) {
            throw new IllegalArgumentException("执行记录不存在: executionId=" + executionId);
        }

        // 查询模板
        SafetyChecklistTemplate template = templateMapper.selectById(execution.getTemplateId());

        // 查询检查项
        List<SafetyChecklistItem> items = getItemsByTemplateId(execution.getTemplateId());

        // 查询结果
        List<SafetyChecklistResult> results = getResultsByExecutionId(executionId);

        // 查询照片
        Map<Long, List<com.ams.entity.SysAttachment>> photosByResultId = new java.util.HashMap<>();
        for (SafetyChecklistResult result : results) {
            List<com.ams.entity.SysAttachment> photos = safetyChecklistAttachmentService.getAttachments(result.getId());
            photosByResultId.put(result.getId(), photos);
        }

        // 构建数据模型
        Map<String, Object> data = new java.util.HashMap<>();
        data.put("execution", execution);
        data.put("template", template);
        data.put("items", items);
        data.put("results", results);
        data.put("photosByResultId", photosByResultId);
        data.put("reportTime", java.time.LocalDateTime.now());

        // 调用 PdfExportService 生成 PDF
        return pdfExportService.exportReport("safety_checklist_report", data);
    }
}
