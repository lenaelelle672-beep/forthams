package com.ams.state;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

/**
 * 资产状态枚举定义类
 * 
 * 定义资产管理系统的核心状态枚举，包括：
 * - IN_USE: 正常使用状态
 * - PENDING_SCRAP: 待报废状态
 * - SCRAPPED: 已报废状态
 * - DISPOSED: 已处置状态
 * 
 * Phase 1 目标：构建资产状态流转引擎的核心逻辑
 * 
 * @author AMS Team
 * @since 1.0
 */
public enum AssetStatus {
    
    /**
     * 正常使用状态
     * 资产处于正常运行使用中
     */
    IN_USE("正常使用", "IN_USE"),
    
    /**
     * 待报废状态
     * 资产已提交报废申请，等待审批
     */
    PENDING_SCRAP("待报废", "PENDING_SCRAP"),
    
    /**
     * 已报废状态
     * 资产已通过报废审批，确认报废
     */
    SCRAPPED("已报废", "SCRAPPED"),
    
    /**
     * 已处置状态
     * 资产已完成实物处置流程
     */
    DISPOSED("已处置", "DISPOSED");

    private final String description;
    private final String code;

    private static final Map<AssetStatus, List<AssetStatus>> VALID_TRANSITIONS;
    private static final List<AssetStatus> ALL_STATUSES;

    static {
        // 定义合法的状态流转规则
        Map<AssetStatus, List<AssetStatus>> transitions = new HashMap<>();
        
        // 正常使用 → 待报废
        transitions.put(IN_USE, Arrays.asList(PENDING_SCRAP));
        
        // 待报废 → 已报废
        transitions.put(PENDING_SCRAP, Arrays.asList(SCRAPPED, IN_USE));
        
        // 已报废 → 已处置
        transitions.put(SCRAPPED, Arrays.asList(DISPOSED));
        
        // 已处置：终态，不可再流转
        transitions.put(DISPOSED, Collections.emptyList());
        
        VALID_TRANSITIONS = Collections.unmodifiableMap(transitions);
        ALL_STATUSES = Collections.unmodifiableList(Arrays.asList(values()));
    }

    AssetStatus(String description, String code) {
        this.description = description;
        this.code = code;
    }

    /**
     * 获取状态描述
     * 
     * @return 状态的中文描述
     */
    public String getDescription() {
        return description;
    }

    /**
     * 获取状态编码
     * 
     * @return 状态的英文编码
     */
    public String getCode() {
        return code;
    }

    /**
     * 验证状态流转是否合法
     * 
     * @param targetStatus 目标状态
     * @return true 如果流转合法，否则 false
     */
    public boolean canTransitionTo(AssetStatus targetStatus) {
        if (targetStatus == null) {
            return false;
        }
        List<AssetStatus> allowedTargets = VALID_TRANSITIONS.get(this);
        return allowedTargets != null && allowedTargets.contains(targetStatus);
    }

    /**
     * 执行状态流转
     * 
     * @param targetStatus 目标状态
     * @throws StateTransitionException 如果状态流转不合法
     */
    public void transitionTo(AssetStatus targetStatus) {
        if (!canTransitionTo(targetStatus)) {
            throw new StateTransitionException(
                String.format("状态流转不合法: %s -> %s", this.description, targetStatus.description)
            );
        }
    }

    /**
     * 获取允许流转的目标状态列表
     * 
     * @return 允许流转的状态列表
     */
    public List<AssetStatus> getAllowedTransitions() {
        List<AssetStatus> allowed = VALID_TRANSITIONS.get(this);
        return allowed != null ? allowed : Collections.emptyList();
    }

    /**
     * 检查是否为终态
     * 终态不可再进行状态流转
     * 
     * @return true 如果是终态，否则 false
     */
    public boolean isTerminal() {
        return this == DISPOSED;
    }

    /**
     * 获取所有资产状态枚举值
     * 
     * @return 完整的状态列表
     */
    public static List<AssetStatus> getAllStatuses() {
        return ALL_STATUSES;
    }

    /**
     * 根据状态编码获取枚举值
     * 
     * @param code 状态编码
     * @return 对应的枚举值，如果未找到返回 null
     */
    public static AssetStatus fromCode(String code) {
        for (AssetStatus status : values()) {
            if (status.code.equals(code)) {
                return status;
            }
        }
        return null;
    }

    /**
     * 根据描述获取枚举值
     * 
     * @param description 状态描述
     * @return 对应的枚举值，如果未找到返回 null
     */
    public static AssetStatus fromDescription(String description) {
        for (AssetStatus status : values()) {
            if (status.description.equals(description)) {
                return status;
            }
        }
        return null;
    }

    /**
     * 获取有效的状态流转路径描述
     * 
     * @return 合法的流转路径说明
     */
    public String getValidTransitionsDescription() {
        List<AssetStatus> allowed = getAllowedTransitions();
        if (allowed.isEmpty()) {
            return "终态，不可流转";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < allowed.size(); i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(this.description).append(" -> ").append(allowed.get(i).description);
        }
        return sb.toString();
    }

    @Override
    public String toString() {
        return String.format("AssetStatus{code='%s', description='%s'}", code, description);
    }
}