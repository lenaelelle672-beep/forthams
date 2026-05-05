package com.ams.service;

import com.ams.entity.LifecycleHistory;
import com.ams.mapper.LifecycleHistoryMapper;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 资产生命周期记录器
 * 
 * 负责记录和查询资产生命周期内的所有状态变更事件，
 * 支持报废/退役流程的完整历史追溯。
 * 
 * @since SWARM-2026-Q2-002 Iteration 4
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LifecycleRecorder {

    private final LifecycleHistoryMapper lifecycleHistoryMapper;
    private final AssetMapper assetMapper;

    /**
     * 记录资产状态变更事件
     * 
     * @param assetId 资产ID
     * @param eventType 事件类型（如：采购入库、领用、维修、报废申请、审批完成）
     * @param operator 操作人
     * @param metadata 额外元数据（JSON格式）
     * @return 记录ID
     */
    @Transactional
    public Long recordEvent(Long assetId, String eventType, String operator, String metadata) {
        LifecycleHistory history = new LifecycleHistory();
        history.setAssetId(assetId);
        history.setEventType(eventType);
        history.setOperator(operator);
        history.setMetadata(metadata);
        history.setCreatedAt(LocalDateTime.now());
        
        int inserted = lifecycleHistoryMapper.insert(history);
        if (inserted > 0) {
            log.info("Lifecycle event recorded: assetId={}, event={}, operator={}", 
                     assetId, eventType, operator);
        }
        return history.getId();
    }

    /**
     * 记录报废申请提交事件
     * 
     * @param assetId 资产ID
     * @param reason 报废原因
     * @param estimatedValue 预估残值
     * @param applicant 申请人
     */
    @Transactional
    public void recordRetirementApplication(Long assetId, String reason, 
                                           BigDecimal estimatedValue, String applicant) {
        String metadata = String.format(
            "{\"reason\":\"%s\",\"estimated_residual_value\":%s,\"status\":\"审批中\"}",
            reason, estimatedValue
        );
        recordEvent(assetId, "报废申请", applicant, metadata);
        
        // 锁定资产状态（防止并发提交）
        Asset asset = assetMapper.selectById(assetId);
        if (asset != null) {
            asset.setStatus("审批中");
            asset.setUpdateTime(LocalDateTime.now());
            assetMapper.updateById(asset);
            log.info("Asset status locked to '审批中': assetId={}", assetId);
        }
    }

    /**
     * 记录审批完成事件
     * 
     * @param assetId 资产ID
     * @param finalStatus 最终状态（已报废/已退役）
     * @param approvers 审批人列表（逗号分隔）
     */
    @Transactional
    public void recordApprovalComplete(Long assetId, String finalStatus, String approvers) {
        String metadata = String.format(
            "{\"final_status\":\"%s\",\"approvers\":\"%s\",\"approval_chain_completed\":true}",
            finalStatus, approvers
        );
        recordEvent(assetId, "审批完成", approvers, metadata);
        
        // 更新资产最终状态
        Asset asset = assetMapper.selectById(assetId);
        if (asset != null) {
            asset.setStatus(finalStatus);
            asset.setUpdateTime(LocalDateTime.now());
            assetMapper.updateById(asset);
            log.info("Asset retired: assetId={}, finalStatus={}", assetId, finalStatus);
        }
    }

    /**
     * 记录审批驳回事件
     * 
     * @param assetId 资产ID
     * @param rejectReason 驳回原因
     * @param rejector 驳回人
     */
    @Transactional
    public void recordApprovalRejected(Long assetId, String rejectReason, String rejector) {
        String metadata = String.format(
            "{\"reject_reason\":\"%s\",\"status\":\"可用\"}",
            rejectReason
        );
        recordEvent(assetId, "审批驳回", rejector, metadata);
        
        // 解锁资产状态
        Asset asset = assetMapper.selectById(assetId);
        if (asset != null) {
            asset.setStatus("可用");
            asset.setUpdateTime(LocalDateTime.now());
            assetMapper.updateById(asset);
            log.info("Asset status unlocked after rejection: assetId={}", assetId);
        }
    }

    /**
     * 查询资产生命周期时间轴（按时间正序）
     * 
     * @param assetId 资产ID
     * @return 生命周期事件列表
     */
    public List<LifecycleHistory> getTimeline(Long assetId) {
        return lifecycleHistoryMapper.selectTimelineByAssetId(assetId);
    }

    /**
     * 查询资产生命周期时间轴（按时间倒序）
     * 
     * @param assetId 资产ID
     * @return 生命周期事件列表
     */
    public List<LifecycleHistory> getTimelineReversed(Long assetId) {
        return lifecycleHistoryMapper.selectTimelineByAssetIdReversed(assetId);
    }

    /**
     * 查询指定时间范围内的事件
     * 
     * @param assetId 资产ID
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 事件列表
     */
    public List<LifecycleHistory> getEventsByDateRange(Long assetId, 
                                                       LocalDateTime startTime, 
                                                       LocalDateTime endTime) {
        return lifecycleHistoryMapper.selectEventsByDateRange(assetId, startTime, endTime);
    }

    /**
     * 批量记录事件（用于导入场景）
     * 
     * @param events 事件列表
     * @return 成功记录数
     */
    @Transactional
    public int batchRecordEvents(List<LifecycleHistory> events) {
        int count = 0;
        for (LifecycleHistory event : events) {
            if (lifecycleHistoryMapper.insert(event) > 0) {
                count++;
            }
        }
        log.info("Batch recorded {} lifecycle events", count);
        return count;
    }
}