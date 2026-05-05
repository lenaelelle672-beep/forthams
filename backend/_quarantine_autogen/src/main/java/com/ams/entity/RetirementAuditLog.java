package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 资产退役审批链审计日志实体类。
 *
 * <p>该类用于记录资产退役申请的全生命周期操作审计轨迹，包括但不限于：
 * <ul>
 *   <li>状态流转事件（如 DRAFT → PENDING_APPROVAL）</li>
 *   <li>审批操作事件（如 APPROVE、REJECT）</li>
 *   <li>退役执行事件（如 DECOMMISSION）</li>
 *   <li>归档操作事件（如 ARCHIVE）</li>
 * </ul>
 *
 * <p><b>设计约束：</b>本表采用追加写（Append-Only）策略，
 * 禁止执行 UPDATE 和 DELETE 操作。所有操作必须通过 INSERT 记录。
 *
 * <p><b>关联实体：</b>
 * <ul>
 *   <li>{@link RetirementApplication} - 关联的退役申请</li>
 *   <li>{@link User} - 操作人</li>
 * </ul>
 *
 * @version 1.0
 * @since SWARM-002 Phase 2
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("retirement_audit_log")
public class RetirementAuditLog {

    /**
     * 审计日志唯一标识符。
     *
     * <p>使用 UUID 字符串作为主键，确保分布式环境下的唯一性。
     */
    @TableId(type = IdType.INPUT)
    private String id;

    /**
     * 关联的退役申请ID。
     *
     * <p>对应 {@link RetirementApplication} 实体的主键。
     */
    private Long retirementApplicationId;

    /**
     * 事件类型。
     *
     * <p>支持的事件类型包括：
     * <ul>
     *   <li>STATE_TRANSITION - 状态流转</li>
     *   <li>CREATED - 申请创建</li>
     *   <li>SUBMIT - 申请提交</li>
     *   <li>APPROVE - 审批通过</li>
     *   <li>REJECT - 审批驳回</li>
     *   <li>DECOMMISSION - 执行退役</li>
     *   <li>ARCHIVE - 归档</li>
     *   <li>INIT - 审批链初始化</li>
     *   <li>TIMEOUT - 审批超时</li>
     * </ul>
     */
    private String eventType;

    /**
     * 事件发生前的状态。
     *
     * <p>对于 STATE_TRANSITION 类型事件，记录转换前的状态值。
     * 可能的值：DRAFT、PENDING_APPROVAL、APPROVED、REJECTED、DECOMMISSIONED、ARCHIVED
     */
    private String fromState;

    /**
     * 事件发生后的状态。
     *
     * <p>对于 STATE_TRANSITION 类型事件，记录转换后的状态值。
     */
    private String toState;

    /**
     * 操作人ID。
     *
     * <p>执行当前操作的用户ID。
     */
    private Long operatorId;

    /**
     * 操作人姓名。
     *
     * <p>冗余存储，用于快速查询，避免关联查询。
     */
    private String operatorName;

    /**
     * 审批层级。
     *
     * <p>当事件类型为 APPROVE 或 REJECT 时，记录当前审批的层级。
     * 范围：1 到 MAX_APPROVAL_LEVELS（默认5）。
     */
    private Integer approvalLevel;

    /**
     * 当前审批人ID。
     *
     * <p>记录当前正在处理审批的用户ID。
     */
    private Long currentApproverId;

    /**
     * 审批意见或驳回原因。
     *
     * <p>当事件类型为 APPROVE 或 REJECT 时，记录审批人的意见。
     */
    private String comment;

    /**
     * 请求追踪ID。
     *
     * <p>对应 HTTP 请求头 X-Request-ID，用于全链路追踪。
     */
    private String requestId;

    /**
     * 幂等性Key。
     *
     * <p>对应 HTTP 请求头 X-Idempotency-Key，防止重复提交。
     */
    private String idempotencyKey;

    /**
     * 事件发生的客户端IP地址。
     *
     * <p>用于安全审计追溯。
     */
    private String clientIp;

    /**
     * 事件发生时间。
     *
     * <p>精确到秒的时间戳，记录操作的实际发生时间。
     */
    private LocalDateTime createdAt;

    /**
     * 乐观锁版本号。
     *
     * <p>用于并发控制，防止脏写。
     */
    private Integer version;
}