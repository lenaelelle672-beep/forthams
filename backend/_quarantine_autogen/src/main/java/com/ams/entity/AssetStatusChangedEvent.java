package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 资产状态变更事件实体类
 * 
 * <p>用于记录资产在生命周期中的状态变更，生成完整的生命周期历史记录。
 * 当资产状态发生变更时（如申请报废、审批通过、已退役等），系统自动创建此事件记录。
 * 
 * <p>功能说明：
 * <ul>
 *   <li>记录资产状态的前后变化</li>
 *   <li>支持生命周期追溯与审计</li>
 *   <li>作为领域事件发布到消息队列</li>
 * </ul>
 * 
 * <p>状态转换规则：
 * <ul>
 *   <li>在役(InService) → 申请中(Pending)</li>
 *   <li>申请中(Pending) → 审批中(Approval)</li>
 *   <li>审批中(Approval) → 已退役(Retired) / 已报废(Scrapped)</li>
 *   <li>审批驳回 → 在役(InService) 回退</li>
 * </ul>
 *
 * @author AMS Team
 * @version 1.0
 * @since 2024-01-01
 */
@Data
@TableName("asset_status_changed_event")
public class AssetStatusChangedEvent {

    /**
     * 事件记录ID，使用UUID生成
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 关联的资产ID
     * 标识此次状态变更对应的资产
     */
    private String assetId;

    /**
     * 资产名称
     * 用于快速检索和展示
     */
    private String assetName;

    /**
     * 变更前的状态
     * 记录状态变更前的资产状态
     */
    private String previousStatus;

    /**
     * 变更后的状态
     * 记录状态变更后的资产状态
     */
    private String newStatus;

    /**
     * 操作人ID
     * 执行状态变更操作用户的ID
     */
    private String operatorId;

    /**
     * 操作人用户名
     * 用于审计日志展示
     */
    private String operatorName;

    /**
     * 操作时间戳
     * 精确到毫秒的变更时间
     */
    private LocalDateTime operationTime;

    /**
     * 触发事件类型
     * 如：APPLICATION_SUBMITTED, APPROVAL_APPROVED, APPROVAL_REJECTED, DISPOSAL_COMPLETED
     */
    private String triggerEvent;

    /**
     * 关联的申请单ID
     * 如果是报废申请触发的变更，记录关联的申请单ID
     */
    private String applicationId;

    /**
     * 关联的审批记录ID
     * 如果是审批触发的变更，记录关联的审批记录ID
     */
    private String approvalRecordId;

    /**
     * 变更原因
     * 记录此次变更的原因或备注
     */
    private String changeReason;

    /**
     * 操作人终端IP地址
     * 用于安全审计
     */
    private String operatorIp;

    /**
     * 操作人浏览器UserAgent
     * 用于安全审计
     */
    private String operatorUserAgent;

    /**
     * 乐观锁版本号
     * 用于并发控制
     */
    @Version
    private Long version;

    /**
     * 创建时间
     * 记录数据库插入时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     * 记录数据库更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /**
     * 逻辑删除标记
     * 0-未删除，1-已删除
     */
    @TableLogic
    private Integer deleted;
}