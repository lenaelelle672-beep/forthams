package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * 通知记录实体类
 *
 * 用于记录工单审批流程中所有通知事件的发送历史，包括：
 * - 通知类型（邮件、短信、站内信等）
 * - 通知状态（待发送、发送中、已发送、发送失败）
 * - 通知载荷（JSON 格式的模板变量）
 * - 发送时间与重试次数
 *
 * 关联实体：
 * - WorkOrder：通知所属的工单
 * - User：通知的接收人
 *
 * @since SWARM-001 Iteration 1
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("notification_record")
public class NotificationRecord {

    /**
     * 通知记录唯一标识
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 关联工单ID
     */
    private Long workOrderId;

    /**
     * 工单编号（冗余字段，便于查询）
     */
    private String workOrderNo;

    /**
     * 触发通知的事件类型
     * 可选值：SUBMIT, APPROVE, REJECT, CLOSE
     */
    private String eventType;

    /**
     * 通知接收人用户ID
     */
    private Long recipientId;

    /**
     * 通知接收人用户名（冗余字段）
     */
    private String recipientName;

    /**
     * 通知接收人邮箱（冗余字段）
     */
    private String recipientEmail;

    /**
     * 通知渠道类型
     * 可选值：EMAIL, SMS, IN_APP
     */
    private String channelType;

    /**
     * 通知模板ID
     */
    private String templateId;

    /**
     * 通知标题
     */
    private String title;

    /**
     * 通知内容
     */
    private String content;

    /**
     * 通知状态
     * 可选值：PENDING, SENDING, SENT, FAILED
     */
    private String status;

    /**
     * 状态变更时间
     */
    private LocalDateTime statusChangedAt;

    /**
     * 错误信息（发送失败时记录）
     */
    private String errorMessage;

    /**
     * 重试次数
     */
    private Integer retryCount;

    /**
     * 最大重试次数（配置值）
     */
    private Integer maxRetries;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    /**
     * 逻辑删除标记
     */
    @TableLogic
    private Integer deleted;

    // ===================== 通知状态常量 =====================

    /** 待发送 */
    public static final String STATUS_PENDING = "PENDING";

    /** 发送中 */
    public static final String STATUS_SENDING = "SENDING";

    /** 已发送 */
    public static final String STATUS_SENT = "SENT";

    /** 发送失败 */
    public static final String STATUS_FAILED = "FAILED";

    // ===================== 通知渠道常量 =====================

    /** 邮件渠道 */
    public static final String CHANNEL_EMAIL = "EMAIL";

    /** 短信渠道 */
    public static final String CHANNEL_SMS = "SMS";

    /** 站内信渠道 */
    public static final String CHANNEL_IN_APP = "IN_APP";

    // ===================== 事件类型常量 =====================

    /** 提交事件 */
    public static final String EVENT_SUBMIT = "SUBMIT";

    /** 审批通过事件 */
    public static final String EVENT_APPROVE = "APPROVE";

    /** 审批驳回事件 */
    public static final String EVENT_REJECT = "REJECT";

    /** 关闭工单事件 */
    public static final String EVENT_CLOSE = "CLOSE";

    // ===================== 业务方法 =====================

    /**
     * 检查是否可重试
     *
     * @return 如果当前重试次数小于最大重试次数，返回 true
     */
    public boolean canRetry() {
        return retryCount != null && maxRetries != null && retryCount < maxRetries;
    }

    /**
     * 增加重试次数
     *
     * @return 增加后的重试次数
     */
    public int incrementRetryCount() {
        if (this.retryCount == null) {
            this.retryCount = 0;
        }
        this.retryCount++;
        return this.retryCount;
    }

    /**
     * 标记为已发送
     */
    public void markAsSent() {
        this.status = STATUS_SENT;
        this.statusChangedAt = LocalDateTime.now();
        this.errorMessage = null;
    }

    /**
     * 标记为发送失败
     *
     * @param errorMessage 错误信息
     */
    public void markAsFailed(String errorMessage) {
        this.status = STATUS_FAILED;
        this.statusChangedAt = LocalDateTime.now();
        this.errorMessage = errorMessage;
    }

    /**
     * 标记为发送中
     */
    public void markAsSending() {
        this.status = STATUS_SENDING;
        this.statusChangedAt = LocalDateTime.now();
    }

    /**
     * 验证通知记录是否属于有效的工作流事件
     *
     * @return 如果事件类型在有效范围内，返回 true
     */
    public boolean isValidEventType() {
        return EVENT_SUBMIT.equals(eventType)
            || EVENT_APPROVE.equals(eventType)
            || EVENT_REJECT.equals(eventType)
            || EVENT_CLOSE.equals(eventType);
    }

    /**
     * 获取通知渠道的展示名称
     *
     * @return 渠道的中文展示名称
     */
    public String getChannelDisplayName() {
        if (CHANNEL_EMAIL.equals(channelType)) {
            return "邮件";
        } else if (CHANNEL_SMS.equals(channelType)) {
            return "短信";
        } else if (CHANNEL_IN_APP.equals(channelType)) {
            return "站内信";
        }
        return channelType;
    }

    /**
     * 获取事件类型的中文描述
     *
     * @return 事件的中文描述
     */
    public String getEventTypeDescription() {
        if (EVENT_SUBMIT.equals(eventType)) {
            return "工单提交";
        } else if (EVENT_APPROVE.equals(eventType)) {
            return "工单审批通过";
        } else if (EVENT_REJECT.equals(eventType)) {
            return "工单审批驳回";
        } else if (EVENT_CLOSE.equals(eventType)) {
            return "工单关闭";
        }
        return eventType;
    }
}