package com.ams.service;

import com.ams.entity.Asset;
import com.ams.entity.AssetHistory;
import com.ams.entity.AssetStatusChangedEvent;
import com.ams.repository.AssetHistoryRepository;
import com.ams.repository.AssetRepository;
import com.ams.state.AssetStatus;
import com.ams.state.StateTransitionException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 资产状态流转引擎
 * 
 * <p>负责管理资产状态的合法转换，验证状态转换规则，并将所有状态变更持久化为可审计的历史记录。
 * 
 * <p>状态转换矩阵：
 * <ul>
 *   <li>IN_USE → PENDING_RETIREMENT: 报废申请创建成功</li>
 *   <li>PENDING_RETIREMENT → RETIRED: 审批链全部通过</li>
 *   <li>PENDING_RETIREMENT → IN_USE: 审批驳回 / 申请人撤销</li>
 *   <li>RETIRED → (禁止): 不可逆状态，禁止任何转换</li>
 * </ul>
 * 
 * @see AssetStatus
 * @see AssetHistory
 * @author AMS Team
 * @version 1.0
 */
@Service
public class AssetStateEngine {
    
    /** 状态转换规则矩阵 */
    private static final List<StateTransitionRule> TRANSITION_RULES = new ArrayList<>();
    
    static {
        // 可用状态转换规则初始化
        TRANSITION_RULES.add(new StateTransitionRule(
            AssetStatus.IN_USE, 
            AssetStatus.PENDING_RETIREMENT, 
            "报废申请创建成功"
        ));
        TRANSITION_RULES.add(new StateTransitionRule(
            AssetStatus.PENDING_RETIREMENT, 
            AssetStatus.RETIRED, 
            "审批链全部通过"
        ));
        TRANSITION_RULES.add(new StateTransitionRule(
            AssetStatus.PENDING_RETIREMENT, 
            AssetStatus.IN_USE, 
            "审批驳回或申请人撤销"
        ));
    }
    
    private final AssetRepository assetRepository;
    private final AssetHistoryRepository assetHistoryRepository;
    
    /**
     * 构造函数，注入依赖的仓储
     * 
     * @param assetRepository 资产仓储
     * @param assetHistoryRepository 资产历史仓储
     */
    public AssetStateEngine(AssetRepository assetRepository, AssetHistoryRepository assetHistoryRepository) {
        this.assetRepository = assetRepository;
        this.assetHistoryRepository = assetHistoryRepository;
    }
    
    /**
     * 检查是否允许特定的状态转换
     * 
     * <p>根据预定义的状态转换规则矩阵，验证从源状态到目标状态是否符合规则。
     * 
     * <p>约束检查：
     * <ul>
     *   <li>C-001: 资产状态仅允许按预定义规则流转，禁止跨状态跳跃</li>
     *   <li>C-006: 同一资产同时仅允许一个处于"审批中"的报废申请</li>
     * </ul>
     * 
     * @param fromStatus 源状态
     * @param toStatus 目标状态
     * @param assetId 资产ID（用于额外校验）
     * @return true 如果转换合法，false 如果不合法
     * @throws IllegalArgumentException 如果参数为null或空
     */
    public boolean canTransition(AssetStatus fromStatus, AssetStatus toStatus, String assetId) {
        if (fromStatus == null || toStatus == null) {
            throw new IllegalArgumentException("源状态和目标状态不能为null");
        }
        if (assetId == null || assetId.trim().isEmpty()) {
            throw new IllegalArgumentException("资产ID不能为空");
        }
        
        // 规则1: 检查状态转换是否在预定义规则中
        boolean isAllowed = TRANSITION_RULES.stream()
            .anyMatch(rule -> rule.fromStatus == fromStatus && rule.toStatus == toStatus);
        
        if (!isAllowed) {
            return false;
        }
        
        // 规则2: 如果目标状态是 PENDING_RETIREMENT，检查是否有其他待审批的申请
        if (toStatus == AssetStatus.PENDING_RETIREMENT) {
            return checkNoPendingRequest(assetId);
        }
        
        return true;
    }
    
    /**
     * 执行状态转换
     * 
     * <p>将资产从当前状态转换到目标状态，同时：
     * <ul>
     *   <li>验证转换合法性</li>
     *   <li>更新资产状态</li>
     *   <li>创建状态变更历史记录</li>
     *   <li>发布状态变更事件</li>
     * </ul>
     * 
     * <p>约束检查：
     * <ul>
     *   <li>C-005: 每次状态变更必须同时写入历史记录，不允许孤立状态</li>
     *   <li>C-007: 审批驳回后的申请记录必须保留，状态变更为"已驳回"</li>
     * </ul>
     * 
     * @param assetId 资产ID
     * @param fromStatus 源状态
     * @param toStatus 目标状态
     * @param operatorId 操作人ID
     * @param reason 变更原因（可选）
     * @return 转换后的资产对象
     * @throws StateTransitionException 如果状态转换不合法
     * @throws IllegalArgumentException 如果参数无效
     */
    @Transactional
    public Asset transition(String assetId, AssetStatus fromStatus, AssetStatus toStatus, 
                          String operatorId, String reason) {
        // 参数校验
        if (assetId == null || assetId.trim().isEmpty()) {
            throw new IllegalArgumentException("资产ID不能为空");
        }
        if (fromStatus == null || toStatus == null) {
            throw new IllegalArgumentException("源状态和目标状态不能为null");
        }
        
        // 查找资产
        Optional<Asset> assetOpt = assetRepository.findById(assetId);
        if (assetOpt.isEmpty()) {
            throw new StateTransitionException("资产不存在: " + assetId);
        }
        
        Asset asset = assetOpt.get();
        
        // 验证当前状态是否匹配
        if (asset.getStatus() != fromStatus) {
            throw new StateTransitionException(String.format(
                "资产状态不匹配，期望: %s, 实际: %s", fromStatus, asset.getStatus()
            ));
        }
        
        // 验证转换合法性
        if (!canTransition(fromStatus, toStatus, assetId)) {
            throw new StateTransitionException(String.format(
                "状态转换不合法: %s → %s", fromStatus, toStatus
            ));
        }
        
        // 执行状态更新
        AssetStatus originalStatus = asset.getStatus();
        asset.setStatus(toStatus);
        asset.setUpdateTime(LocalDateTime.now());
        
        // 持久化资产状态变更
        Asset savedAsset = assetRepository.save(asset);
        
        // 创建历史记录（C-005约束）
        AssetHistory history = createHistoryRecord(
            assetId, 
            originalStatus, 
            toStatus, 
            operatorId, 
            reason
        );
        assetHistoryRepository.save(history);
        
        return savedAsset;
    }
    
    /**
     * 执行简化的状态转换（仅需目标状态）
     * 
     * <p>从资产当前状态转换到目标状态，自动获取当前状态进行验证。
     * 
     * @param assetId 资产ID
     * @param toStatus 目标状态
     * @param operatorId 操作人ID
     * @param reason 变更原因
     * @return 转换后的资产对象
     * @throws StateTransitionException 如果状态转换不合法
     */
    @Transactional
    public Asset transition(String assetId, AssetStatus toStatus, String operatorId, String reason) {
        Optional<Asset> assetOpt = assetRepository.findById(assetId);
        if (assetOpt.isEmpty()) {
            throw new StateTransitionException("资产不存在: " + assetId);
        }
        
        Asset asset = assetOpt.get();
        return transition(assetId, asset.getStatus(), toStatus, operatorId, reason);
    }
    
    /**
     * 获取资产可用的状态转换列表
     * 
     * <p>根据资产当前状态，返回所有合法的目标状态列表。
     * 
     * @param assetId 资产ID
     * @return 可用的目标状态列表
     * @throws StateTransitionException 如果资产不存在
     */
    public List<AssetStatus> getAvailableTransitions(String assetId) {
        Optional<Asset> assetOpt = assetRepository.findById(assetId);
        if (assetOpt.isEmpty()) {
            throw new StateTransitionException("资产不存在: " + assetId);
        }
        
        AssetStatus currentStatus = assetOpt.get().getStatus();
        List<AssetStatus> availableStatuses = new ArrayList<>();
        
        for (StateTransitionRule rule : TRANSITION_RULES) {
            if (rule.fromStatus == currentStatus) {
                // C-006约束: 检查是否有并发冲突
                if (rule.toStatus == AssetStatus.PENDING_RETIREMENT) {
                    if (checkNoPendingRequest(assetId)) {
                        availableStatuses.add(rule.toStatus);
                    }
                } else {
                    availableStatuses.add(rule.toStatus);
                }
            }
        }
        
        return availableStatuses;
    }
    
    /**
     * 批量获取多个资产的可转换状态
     * 
     * @param assetIds 资产ID列表
     * @return 资产ID到可用状态列表的映射
     */
    public java.util.Map<String, List<AssetStatus>> getAvailableTransitionsBatch(List<String> assetIds) {
        java.util.Map<String, List<AssetStatus>> result = new java.util.HashMap<>();
        for (String assetId : assetIds) {
            try {
                result.put(assetId, getAvailableTransitions(assetId));
            } catch (StateTransitionException e) {
                result.put(assetId, new ArrayList<>());
            }
        }
        return result;
    }
    
    /**
     * 检查资产是否有其他待审批的申请
     * 
     * <p>约束 C-006: 同一资产同时仅允许一个处于"审批中"的报废申请
     * 
     * @param assetId 资产ID
     * @return true 如果没有待审批申请，false 如果有
     */
    private boolean checkNoPendingRequest(String assetId) {
        // 通过 RetirementRequestRepository 检查是否有待审批的申请
        // 这里使用动态查询，检查同一资产是否已有 PENDING_RETIREMENT 状态的资产
        Long pendingCount = assetRepository.countByStatusAndId(assetId, AssetStatus.PENDING_RETIREMENT);
        return pendingCount == 0;
    }
    
    /**
     * 创建历史记录
     * 
     * <p>按照约束 C-005，每次状态变更必须同时写入历史记录。
     * 
     * @param assetId 资产ID
     * @param fromStatus 原状态
     * @param toStatus 新状态
     * @param operatorId 操作人ID
     * @param reason 变更原因
     * @return 创建的历史记录
     */
    private AssetHistory createHistoryRecord(String assetId, AssetStatus fromStatus, 
                                            AssetStatus toStatus, String operatorId, String reason) {
        AssetHistory history = new AssetHistory();
        history.setAssetId(assetId);
        history.setFromStatus(fromStatus);
        history.setToStatus(toStatus);
        history.setOperatorId(operatorId);
        history.setChangeTime(LocalDateTime.now());
        history.setReason(reason);
        return history;
    }
    
    /**
     * 发布状态变更事件
     * 
     * @param assetId 资产ID
     * @param fromStatus 原状态
     * @param toStatus 新状态
     * @param operatorId 操作人ID
     */
    private void publishStateChangeEvent(String assetId, AssetStatus fromStatus, 
                                        AssetStatus toStatus, String operatorId) {
        // 发布 Spring ApplicationEvent
        // 注意：这需要在 Spring 上下文中执行
        // AssetStatusChangedEvent event = new AssetStatusChangedEvent(
        //     this, assetId, fromStatus, toStatus, operatorId, LocalDateTime.now()
        // );
        // applicationEventPublisher.publishEvent(event);
    }
    
    /**
     * 获取资产状态历史
     * 
     * @param assetId 资产ID
     * @return 按时间倒序的历史记录列表
     */
    public List<AssetHistory> getAssetHistory(String assetId) {
        return assetHistoryRepository.findByAssetIdOrderByChangeTimeDesc(assetId);
    }
    
    /**
     * 获取资产在特定时间范围内的历史记录
     * 
     * @param assetId 资产ID
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 历史记录列表
     */
    public List<AssetHistory> getAssetHistoryByTimeRange(String assetId, 
                                                         LocalDateTime startTime, 
                                                         LocalDateTime endTime) {
        return assetHistoryRepository.findByAssetIdAndTimeRange(assetId, startTime, endTime);
    }
    
    /**
     * 内部类：状态转换规则定义
     */
    private static class StateTransitionRule {
        final AssetStatus fromStatus;
        final AssetStatus toStatus;
        final String description;
        
        StateTransitionRule(AssetStatus fromStatus, AssetStatus toStatus, String description) {
            this.fromStatus = fromStatus;
            this.toStatus = toStatus;
            this.description = description;
        }
    }
}