package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * 资产报废/退役生命周期事件记录
 * 
 * <p>记录资产从正常状态到报废/退役的完整生命周期变更历史，
 * 包括申请创建、审批节点流转、状态变更等关键事件。</p>
 * 
 * <p>所有生命周期事件必须在此表中记录，支持审计追溯与流程回放。</p>
 * 
 * @author AMS Team
 * @since Iteration 5 (Phase 3: 流程引擎与审批链集成)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("retirement_history")
public class RetirementHistory {

    /**
     * 生命周期事件唯一标识
     */
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /**
     * 关联资产ID
     * 必填，标识事件所属的资产
     */
    private Long assetId;

    /**
     * 生命周期事件类型
     * 
     * <p>枚举值:</p>
     * <ul>
     *   <li>RETIREMENT_CREATED - 报废/退役申请创建</li>
     *   <li>LEVEL_1_APPROVED - 第1级审批通过</li>
     *   <li>LEVEL_2_APPROVED - 第2级审批通过</li>
     *   <li>LEVEL_3_APPROVED - 第3级审批通过</li>
     *   <li>LEVEL_4_APPROVED - 第4级审批通过</li>
     *   <li>LEVEL_5_APPROVED - 第5级审批通过</li>
     *   <li>RETIREMENT_COMPLETED - 报废/退役流程完成</li>
     *   <li>APPLICATION_REJECTED - 申请被驳回</li>
     *   <li>APPLICATION_CANCELLED - 申请人主动撤销</li>
     *   <li>APPLICATION_RESUBMITTED - 驳回后重新提交</li>
     *   <li>ASSET_LOCKED - 资产状态锁定</li>
     *   <li>ASSET_UNLOCKED - 资产状态解锁</li>
     * </ul>
     */
    private String eventType;

    /**
     * 变更前状态
     * 用于记录状态机转换的起始状态
     */
    private String fromStatus;

    /**
     * 变更后状态
     * 用于记录状态机转换的目标状态
     */
    private String toStatus;

    /**
     * 关联的报废申请ID
     * 可为空（资产锁定等事件不关联具体申请）
     */
    private Long applicationId;

    /**
     * 关联的审批任务ID
     * 审批节点事件关联具体的审批任务
     */
    private Long approvalTaskId;

    /**
     * 关联的审批链配置ID
     * 标识使用的是哪套审批链规则
     */
    private Long approvalChainId;

    /**
     * 操作人ID
     * 记录执行此事件的用户
     */
    private Long operatorId;

    /**
     * 操作人用户名
     * 用于展示与快速检索
     */
    private String operatorUsername;

    /**
     * 操作人部门ID
     * 用于部门维度的审批链解析
     */
    private Long operatorDeptId;

    /**
     * 操作人IP地址
     * 审计要求：记录操作来源
     */
    private String operatorIp;

    /**
     * 事件发生时间
     * 自动记录，不可修改
     */
    private LocalDateTime eventTime;

    /**
     * 审批意见/备注
     * 审批节点必须填写，非审批节点可选
     */
    private String comment;

    /**
     * 附件URL列表（JSON格式）
     * 存储报废申请提交的证明材料等
     */
    private String attachments;

    /**
     * 乐观锁版本号
     * 用于防止并发操作导致的数据不一致
     */
    @Version
    private Integer version;

    /**
     * 是否已同步到审计日志
     * true: 已同步，不可修改
     * false: 待同步
     */
    private Boolean syncedToAudit;

    /**
     * 扩展字段（JSON格式）
     * 用于存储事件相关的额外上下文信息
     */
    private String extraData;

    /**
     * 记录创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 记录更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /**
     * 逻辑删除标记
     * 0: 未删除
     * 1: 已删除
     * 注意：生命周期事件物理上不可删除，仅允许逻辑删除
     */
    @TableLogic
    private Integer deleted;

    // ============================================================
    // 业务方法
    // ============================================================

    /**
     * 判断是否为审批通过事件
     *
     * @return true if event type indicates approval
     */
    public boolean isApprovalEvent() {
        return eventType != null && eventType.startsWith("LEVEL_") && eventType.endsWith("_APPROVED");
    }

    /**
     * 判断是否为终态事件
     * 终态事件：RETIREMENT_COMPLETED 或 APPLICATION_REJECTED
     *
     * @return true if event is terminal
     */
    public boolean isTerminalEvent() {
        return "RETIREMENT_COMPLETED".equals(eventType) || "APPLICATION_REJECTED".equals(eventType);
    }

    /**
     * 获取审批级别
     * 仅对审批事件有效
     *
     * @return 审批级别（1-5），非审批事件返回null
     */
    public Integer getApprovalLevel() {
        if (!isApprovalEvent()) {
            return null;
        }
        // 从 "LEVEL_X_APPROVED" 格式中提取级别
        try {
            String levelStr = eventType.replace("LEVEL_", "").replace("_APPROVED", "");
            return Integer.parseInt(levelStr);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 事件类型常量定义
     */
    public static final class EventTypes {
        public static final String RETIREMENT_CREATED = "RETIREMENT_CREATED";
        public static final String LEVEL_1_APPROVED = "LEVEL_1_APPROVED";
        public static final String LEVEL_2_APPROVED = "LEVEL_2_APPROVED";
        public static final String LEVEL_3_APPROVED = "LEVEL_3_APPROVED";
        public static final String LEVEL_4_APPROVED = "LEVEL_4_APPROVED";
        public static final String LEVEL_5_APPROVED = "LEVEL_5_APPROVED";
        public static final String RETIREMENT_COMPLETED = "RETIREMENT_COMPLETED";
        public static final String APPLICATION_REJECTED = "APPLICATION_REJECTED";
        public static final String APPLICATION_CANCELLED = "APPLICATION_CANCELLED";
        public static final String APPLICATION_RESUBMITTED = "APPLICATION_RESUBMITTED";
        public static final String ASSET_LOCKED = "ASSET_LOCKED";
        public static final String ASSET_UNLOCKED = "ASSET_UNLOCKED";

        private EventTypes() {
            // 私有构造函数防止实例化
        }
    }
}