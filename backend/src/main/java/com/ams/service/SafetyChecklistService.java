package com.ams.service;

import com.ams.dto.SafetyChecklistBatchResult;
import com.ams.entity.SafetyChecklistExecution;
import com.ams.entity.SafetyChecklistItem;
import com.ams.entity.SafetyChecklistResult;
import com.ams.entity.SafetyChecklistTemplate;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;
import java.util.Map;

public interface SafetyChecklistService {
    // 模板 CRUD
    Page<SafetyChecklistTemplate> listTemplates(String keyword, Integer pageNum, Integer pageSize);
    SafetyChecklistTemplate getTemplateById(Long id);
    SafetyChecklistTemplate createTemplate(SafetyChecklistTemplate template);
    SafetyChecklistTemplate updateTemplate(Long id, SafetyChecklistTemplate template);
    void deleteTemplate(Long id);

    // 检查项管理
    List<SafetyChecklistItem> getItemsByTemplateId(Long templateId);
    SafetyChecklistItem createItem(SafetyChecklistItem item);
    SafetyChecklistItem updateItem(Long id, SafetyChecklistItem item);
    void deleteItem(Long id);
    void batchSaveItems(Long templateId, List<SafetyChecklistItem> items);

    // 执行流程
    SafetyChecklistExecution startExecution(Long templateId, Long assetId, Long executorId);
    SafetyChecklistExecution getExecutionById(Long id);
    Page<SafetyChecklistExecution> listExecutions(Long templateId, Long assetId, String status,
                                                   Integer pageNum, Integer pageSize);
    void submitResults(Long executionId, List<SafetyChecklistResult> results);
    SafetyChecklistExecution completeExecution(Long executionId);
    void deleteExecution(Long id);

    // 批量执行（返回批量操作结果）
    SafetyChecklistBatchResult batchStartExecutions(Long templateId, List<Long> assetIds, Long executorId);

    // 执行结果
    List<SafetyChecklistResult> getResultsByExecutionId(Long executionId);

    // PDF 报告生成
    /**
     * 生成安全检查报告（PDF）
     *
     * @param executionId 执行记录 ID
     * @return PDF 字节数组
     */
    byte[] generateReport(Long executionId);

    // 定时检查
    /**
     * 定时检查即将到期的安全检查任务，发送提醒通知
     */
    void checkExpiringSafetyChecklists();

    /**
     * 定时检查逾期执行任务，每小时执行一次
     */
    void checkOverdueExecutions();
}
