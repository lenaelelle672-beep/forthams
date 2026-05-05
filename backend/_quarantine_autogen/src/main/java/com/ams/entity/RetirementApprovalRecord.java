package com.ams.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产退役审批记录实体类
 * 
 * <p>用于记录每一次退役审批操作的历史信息，包括审批人、审批时间、审批决策及意见。</p>
 * 
 * <p><b>设计约束：</b></p>
 * <ul>
 *   <li>审批记录仅允许INSERT操作，不允许UPDATE/DELETE（不可篡改性）</li>
 *   <li>每条记录关联一个退役申请(RetirementRequest)</li>
 *   <li>通过requestId外键关联，支持审批历史追溯</li>
 * </ul>
 * 
 * @see RetirementRequest
 * @version 1.0
 * @since SWARM-223
 */
@Entity
@Table(name = "retirement_approval_record", indexes = {
    @Index(name = "idx_retirement_request_id", columnList = "request_id"),
    @Index(name = "idx_approver_id", columnList = "approver_id"),
    @Index(name = "idx_decision_time", columnList = "decision_time")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RetirementApprovalRecord {

    /**
     * 审批记录唯一标识符 (UUID)
     */
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", columnDefinition = "CHAR(36)")
    private UUID id;

    /**
     * 关联的退役申请ID
     * 
     * <p>外键关联到 RetirementRequest.id</p>
     */
    @Column(name = "request_id", nullable = false, columnDefinition = "CHAR(36)")
    private UUID requestId;

    /**
     * 审批人ID
     */
    @Column(name = "approver_id", nullable = false, columnDefinition = "CHAR(36)")
    private UUID approverId;

    /**
     * 审批人姓名（冗余存储，便于查询）
     */
    @Column(name = "approver_name", length = 100)
    private String approverName;

    /**
     * 审批决策
     * 
     * <p>枚举值：APPROVE（通过）/ REJECT（驳回）</p>
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "decision", nullable = false, length = 20)
    private ApprovalDecision decision;

    /**
     * 审批意见/备注
     * 
     * <p>最多1000字符，支持驳回原因说明或通过备注</p>
     */
    @Column(name = "comments", length = 1000)
    private String comments;

    /**
     * 审批时间
     */
    @Column(name = "decision_time", nullable = false)
    private LocalDateTime decisionTime;

    /**
     * 记录创建时间
     */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * 审批记录版本号（用于乐观锁）
     * 
     * <p><b>注意：</b>虽然审批记录不可篡改，但版本号用于并发控制场景</p>
     */
    @Version
    @Column(name = "version")
    private Long version;

    /**
     * 审批决策枚举
     */
    public enum ApprovalDecision {
        /**
         * 审批通过
         */
        APPROVE,
        
        /**
         * 审批驳回
         */
        REJECT
    }

    /**
     * 持久化前回调 - 自动设置创建时间和ID
     */
    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.decisionTime == null) {
            this.decisionTime = LocalDateTime.now();
        }
    }

    /**
     * 创建审批通过记录
     * 
     * @param requestId 退役申请ID
     * @param approverId 审批人ID
     * @param approverName 审批人姓名
     * @param comments 审批意见
     * @return 构建好的审批记录实体
     */
    public static RetirementApprovalRecord createApproveRecord(
            UUID requestId, 
            UUID approverId, 
            String approverName,
            String comments) {
        return RetirementApprovalRecord.builder()
                .requestId(requestId)
                .approverId(approverId)
                .approverName(approverName)
                .decision(ApprovalDecision.APPROVE)
                .comments(comments)
                .decisionTime(LocalDateTime.now())
                .build();
    }

    /**
     * 创建审批驳回记录
     * 
     * @param requestId 退役申请ID
     * @param approverId 审批人ID
     * @param approverName 审批人姓名
     * @param comments 驳回原因
     * @return 构建好的审批记录实体
     */
    public static RetirementApprovalRecord createRejectRecord(
            UUID requestId, 
            UUID approverId, 
            String approverName,
            String comments) {
        return RetirementApprovalRecord.builder()
                .requestId(requestId)
                .approverId(approverId)
                .approverName(approverName)
                .decision(ApprovalDecision.REJECT)
                .comments(comments)
                .decisionTime(LocalDateTime.now())
                .build();
    }

    /**
     * 判断是否为审批通过
     * 
     * @return true if decision is APPROVE
     */
    public boolean isApproved() {
        return ApprovalDecision.APPROVE.equals(this.decision);
    }

    /**
     * 判断是否为审批驳回
     * 
     * @return true if decision is REJECT
     */
    public boolean isRejected() {
        return ApprovalDecision.REJECT.equals(this.decision);
    }
}