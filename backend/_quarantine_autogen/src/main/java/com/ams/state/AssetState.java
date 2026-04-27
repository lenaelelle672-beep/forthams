package com.ams.state;

import java.util.Arrays;
import java.util.List;

/**
 * 资产状态枚举类
 * 
 * 定义资产全生命周期中的各种状态，包括在役、退役、报废等状态。
 * 状态流转规则：
 * - ACTIVE → IDLE/RETIRED/MAINTENANCE (正常业务流转)
 * - IDLE → ACTIVE/RETIRED (资产重新启用或退役)
 * - RETIRED → SCRAPPED (报废申请审批通过后进入报废状态)
 * - MAINTENANCE → ACTIVE (维保完成返回在役)
 * - SCRAPPED 为终态，不可变更回其他状态
 * 
 * @version SWARM-002 Iteration-1
 * @since 2024-01-01
 */
public enum AssetState {
    
    /**
     * 在役 - 资产正在使用中
     */
    ACTIVE("在役", "资产正在正常使用中"),
    
    /**
     * 闲置 - 资产暂未使用但仍可用
     */
    IDLE("闲置", "资产暂未分配或使用"),
    
    /**
     * 维保中 - 资产正在维修或保养
     */
    MAINTENANCE("维保中", "资产正在维修或保养中"),
    
    /**
     * 退役 - 资产已停止使用，等待报废或处置
     */
    RETIRED("退役", "资产已停止使用，等待报废审批"),
    
    /**
     * 已报废 - 资产已完成报废流程，从台账中移除
     * 
     * 注意：报废状态为终态，不可变更回其他状态
     */
    SCRAPPED("已报废", "资产已完成报废流程，不可逆");

    private final String displayName;
    private final String description;

    AssetState(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    /**
     * 获取状态的显示名称
     * 
     * @return 状态的中文显示名称
     */
    public String getDisplayName() {
        return displayName;
    }

    /**
     * 获取状态的描述信息
     * 
     * @return 状态的详细描述
     */
    public String getDescription() {
        return description;
    }

    /**
     * 判断当前状态是否为终态（不可变更）
     * 
     * @return true 如果是终态
     */
    public boolean isTerminal() {
        return this == SCRAPPED;
    }

    /**
     * 判断是否可以提交报废申请
     * 
     * 根据 SWARM-002 规格，仅允许状态为"退役"的资产提交报废申请
     * 
     * @return true 如果可以提交报废申请
     */
    public boolean canApplyForScrap() {
        return this == RETIRED;
    }

    /**
     * 判断是否可以从当前状态流转到目标状态
     * 
     * @param targetState 目标状态
     * @return true 如果允许此状态流转
     */
    public boolean canTransitionTo(AssetState targetState) {
        if (this.isTerminal()) {
            return false;
        }
        
        return switch (this) {
            case ACTIVE -> targetState == IDLE || targetState == MAINTENANCE || targetState == RETIRED;
            case IDLE -> targetState == ACTIVE || targetState == RETIRED;
            case MAINTENANCE -> targetState == ACTIVE;
            case RETIRED -> targetState == SCRAPPED;
            case SCRAPPED -> false;
        };
    }

    /**
     * 获取所有可流转的目标状态列表
     * 
     * @return 可流转状态列表
     */
    public List<AssetState> getAllowedTransitions() {
        return switch (this) {
            case ACTIVE -> Arrays.asList(IDLE, MAINTENANCE, RETIRED);
            case IDLE -> Arrays.asList(ACTIVE, RETIRED);
            case MAINTENANCE -> Arrays.asList(ACTIVE);
            case RETIRED -> Arrays.asList(SCRAPPED);
            case SCRAPPED -> List.of();
        };
    }

    /**
     * 根据状态名称查找枚举值
     * 
     * @param name 状态名称
     * @return 对应的枚举值，如果未找到返回 null
     */
    public static AssetState fromName(String name) {
        try {
            return AssetState.valueOf(name.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * 检查状态是否为有效的工作状态（非终态）
     * 
     * @return true 如果是有效工作状态
     */
    public boolean isActive() {
        return this == ACTIVE || this == IDLE || this == MAINTENANCE;
    }

    @Override
    public String toString() {
        return String.format("%s(%s)", this.name(), displayName);
    }
}