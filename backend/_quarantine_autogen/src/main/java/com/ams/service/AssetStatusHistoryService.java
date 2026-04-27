package com.ams.service;

import com.ams.entity.LifecycleHistory;
import com.ams.mapper.LifecycleHistoryMapper;
import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 资产状态变更历史服务
 * 
 * <p>提供资产状态变更历史的记录与查询功能，支持：
 * <ul>
 *   <li>记录资产状态变更流水</li>
 *   <li>按资产编号查询状态变更历史</li>
 *   <li>按时间范围筛选历史记录</li>
 *   <li>分页查询支持</li>
 * </ul>
 * 
 * <p>该服务为资产报废流程（SWARM-002）的核心组件，
 * 用于满足审计追溯要求，保留完整的资产状态变更记录。
 * 
 * @see LifecycleHistory
 * @see LifecycleHistoryMapper
 */
@Service
public class AssetStatusHistoryService {

    /** 状态变更类型：报废申请提交 */
    public static final String TYPE_SCRAP_APPLY = "SCRAP_APPLY";
    
    /** 状态变更类型：报废审批通过 */
    public static final String TYPE_SCRAP_APPROVED = "SCRAP_APPROVED";
    
    /** 状态变更类型：报废申请驳回 */
    public static final String TYPE_SCRAP_REJECTED = "SCRAP_REJECTED";

    @Autowired
    private LifecycleHistoryMapper lifecycleHistoryMapper;

    /**
     * 记录资产状态变更
     * 
     * <p>当资产发生状态变更时（如提交报废申请、审批通过等），
     * 自动调用此方法记录变更流水。
     * 
     * @param assetId      资产ID
     * @param type         变更类型，如"SCRAP_APPLY"
     * @param fromStatus   变更前状态
     * @param toStatus     变更后状态
     * @param operatorId   操作人ID
     * @param extraData    额外数据（如申请理由等）
     * @return 记录结果
     * @throws BusinessException 如果记录失败
     */
    @Transactional(rollbackFor = Exception.class)
    public Result<LifecycleHistory> recordStatusChange(
            Long assetId,
            String type,
            String fromStatus,
            String toStatus,
            Long operatorId,
            Map<String, Object> extraData) {
        
        try {
            LifecycleHistory history = new LifecycleHistory();
            history.setAssetId(assetId);
            history.setChangeType(type);
            history.setPreviousStatus(fromStatus);
            history.setNewStatus(toStatus);
            history.setOperatorId(operatorId);
            history.setChangeTime(LocalDateTime.now());
            history.setExtraData(extraData != null ? new HashMap<>(extraData) : null);
            
            lifecycleHistoryMapper.insert(history);
            
            return Result.success(history);
        } catch (Exception e) {
            throw new BusinessException("记录状态变更历史失败: " + e.getMessage());
        }
    }

    /**
     * 记录报废申请提交
     * 
     * <p>当用户提交报废申请时调用，自动记录状态从"退役"变为"待审批"。
     * 
     * @param assetId     资产ID
     * @param applicantId 申请人ID
     * @param reason      申请理由
     * @return 记录结果
     */
    @Transactional(rollbackFor = Exception.class)
    public Result<LifecycleHistory> recordScrapApply(
            Long assetId,
            Long applicantId,
            String reason) {
        
        Map<String, Object> extraData = new HashMap<>();
        extraData.put("reason", reason);
        
        return recordStatusChange(
            assetId,
            TYPE_SCRAP_APPLY,
            "retired",
            "pending",
            applicantId,
            extraData
        );
    }

    /**
     * 记录报废审批通过
     * 
     * <p>当审批人通过报废申请时调用，自动记录状态从"待审批"变为"已报废"。
     * 
     * @param assetId      资产ID
     * @param approverId   审批人ID
     * @return 记录结果
     */
    @Transactional(rollbackFor = Exception.class)
    public Result<LifecycleHistory> recordScrapApproved(
            Long assetId,
            Long approverId) {
        
        return recordStatusChange(
            assetId,
            TYPE_SCRAP_APPROVED,
            "pending",
            "scrapped",
            approverId,
            null
        );
    }

    /**
     * 记录报废申请驳回
     * 
     * <p>当审批人驳回报废申请时调用，自动记录状态从"待审批"变回"退役"。
     * 
     * @param assetId     资产ID
     * @param approverId  审批人ID
     * @param reason      驳回理由
     * @return 记录结果
     */
    @Transactional(rollbackFor = Exception.class)
    public Result<LifecycleHistory> recordScrapRejected(
            Long assetId,
            Long approverId,
            String reason) {
        
        Map<String, Object> extraData = new HashMap<>();
        extraData.put("reject_reason", reason);
        
        return recordStatusChange(
            assetId,
            TYPE_SCRAP_REJECTED,
            "pending",
            "retired",
            approverId,
            extraData
        );
    }

    /**
     * 查询资产状态变更历史
     * 
     * <p>支持按资产ID查询完整的历史记录列表。
     * 
     * @param assetId 资产ID
     * @return 状态变更历史列表
     */
    public Result<List<LifecycleHistory>> findByAssetId(Long assetId) {
        if (assetId == null) {
            throw new BusinessException("资产ID不能为空");
        }
        
        QueryWrapper<LifecycleHistory> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("asset_id", assetId)
                    .orderByDesc("change_time");
        
        List<LifecycleHistory> historyList = lifecycleHistoryMapper.selectList(queryWrapper);
        return Result.success(historyList);
    }

    /**
     * 分页查询资产状态变更历史
     * 
     * <p>支持按资产ID、时间范围筛选，并返回分页结果。
     * 
     * @param assetId   资产ID
     * @param startTime 开始时间（可选）
     * @param endTime   结束时间（可选）
     * @param page      页码（从1开始）
     * @param pageSize  每页记录数
     * @return 分页结果
     */
    public Result<Page<LifecycleHistory>> queryHistory(
            Long assetId,
            LocalDateTime startTime,
            LocalDateTime endTime,
            int page,
            int pageSize) {
        
        if (assetId == null) {
            throw new BusinessException("资产ID不能为空");
        }
        
        QueryWrapper<LifecycleHistory> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("asset_id", assetId);
        
        // 时间范围筛选
        if (startTime != null) {
            queryWrapper.ge("change_time", startTime);
        }
        if (endTime != null) {
            queryWrapper.le("change_time", endTime);
        }
        
        // 按时间倒序
        queryWrapper.orderByDesc("change_time");
        
        // 分页查询
        Page<LifecycleHistory> pageParam = new Page<>(page, pageSize);
        Page<LifecycleHistory> resultPage = lifecycleHistoryMapper.selectPage(pageParam, queryWrapper);
        
        return Result.success(resultPage);
    }

    /**
     * 获取资产最近一次状态变更
     * 
     * <p>用于获取资产的最新状态信息。
     * 
     * @param assetId 资产ID
     * @return 最近一次状态变更记录
     */
    public Result<LifecycleHistory> getLatestStatusChange(Long assetId) {
        if (assetId == null) {
            throw new BusinessException("资产ID不能为空");
        }
        
        QueryWrapper<LifecycleHistory> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("asset_id", assetId)
                    .orderByDesc("change_time")
                    .last("LIMIT 1");
        
        LifecycleHistory history = lifecycleHistoryMapper.selectOne(queryWrapper);
        
        if (history == null) {
            return Result.success(null);
        }
        
        return Result.success(history);
    }

    /**
     * 批量查询多个资产的状态变更历史
     * 
     * <p>用于一次性获取多个资产的历史记录。
     * 
     * @param assetIds 资产ID列表
     * @return 各资产的状态变更历史映射
     */
    public Result<Map<Long, List<LifecycleHistory>>> batchQueryByAssetIds(List<Long> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return Result.success(new HashMap<>());
        }
        
        QueryWrapper<LifecycleHistory> queryWrapper = new QueryWrapper<>();
        queryWrapper.in("asset_id", assetIds)
                    .orderByDesc("change_time");
        
        List<LifecycleHistory> allHistories = lifecycleHistoryMapper.selectList(queryWrapper);
        
        // 按资产ID分组
        Map<Long, List<LifecycleHistory>> resultMap = new HashMap<>();
        for (LifecycleHistory history : allHistories) {
            resultMap.computeIfAbsent(history.getAssetId(), k -> new java.util.ArrayList<>())
                     .add(history);
        }
        
        return Result.success(resultMap);
    }

    /**
     * 检查资产是否有进行中的报废流程
     * 
     * <p>用于在提交新报废申请前检查是否存在待处理的申请。
     * 
     * @param assetId 资产ID
     * @return true 表示存在进行中的报废流程
     */
    public Result<Boolean> hasPendingScrapRequest(Long assetId) {
        if (assetId == null) {
            throw new BusinessException("资产ID不能为空");
        }
        
        QueryWrapper<LifecycleHistory> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("asset_id", assetId)
                    .eq("change_type", TYPE_SCRAP_APPLY)
                    .orderByDesc("change_time")
                    .last("LIMIT 1");
        
        LifecycleHistory history = lifecycleHistoryMapper.selectOne(queryWrapper);
        
        if (history == null) {
            return Result.success(false);
        }
        
        // 检查是否后续有审批或驳回记录
        QueryWrapper<LifecycleHistory> subsequentQuery = new QueryWrapper<>();
        subsequentQuery.eq("asset_id", assetId)
                       .eq("change_type", TYPE_SCRAP_APPROVED)
                       .or()
                       .eq("change_type", TYPE_SCRAP_REJECTED)
                       .gt("change_time", history.getChangeTime());
        
        Long count = lifecycleHistoryMapper.selectCount(subsequentQuery);
        
        return Result.success(count == 0);
    }
}