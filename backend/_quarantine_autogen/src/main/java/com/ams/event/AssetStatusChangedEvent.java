package com.ams.event;

import com.ams.state.AssetState;

import java.time.LocalDateTime;

/**
 * 资产状态变更事件。
 *
 * <p>当资产在状态流转引擎中发生合法的状态迁移时，由 {@link EventPublisher} 发布本事件。
 * 订阅者可通过监听该事件执行后续操作，例如持久化历史记录、发送通知、触发审批流等。</p>
 *
 * <p>支持的状态枚举：
 * <ul>
 *   <li>{@link AssetState#IN_USE}       — 正常使用</li>
 *   <li>{@link AssetState#PENDING_SCRAP} — 待报废</li>
 *   <li>{@link AssetState#SCRAPPED}     — 已报废</li>
 *   <li>{@link AssetState#DISPOSED}     — 已处置</li>
 * </ul>
 * </p>
 */
public class AssetStatusChangedEvent {

    /** 发生状态变更的资产唯一标识。 */
    private final Long assetId;

    /** 变更前的资产状态。 */
    private final AssetState previousStatus;

    /** 变更后的资产状态。 */
    private final AssetState currentStatus;

    /** 触发本次状态变更的操作人用户名或工号。 */
    private final String operatorId;

    /** 状态变更发生的时间戳，使用系统时区。 */
    private final LocalDateTime occurredAt;

    /** 状态变更的业务原因或备注，可为 {@code null}。 */
    private final String reason;

    /**
     * 构造资产状态变更事件。
     *
     * @param assetId        发生状态变更的资产 ID，不能为 {@code null}
     * @param previousStatus 变更前状态，不能为 {@code null}
     * @param currentStatus  变更后状态，不能为 {@code null}
     * @param operatorId     操作人标识，不能为空
     * @param occurredAt     事件发生时间，不能为 {@code null}
     * @param reason         变更原因，允许为 {@code null}
     */
    public AssetStatusChangedEvent(Long assetId,
                                   AssetState previousStatus,
                                   AssetState currentStatus,
                                   String operatorId,
                                   LocalDateTime occurredAt,
                                   String reason) {
        if (assetId == null) {
            throw new IllegalArgumentException("assetId 不能为 null");
        }
        if (previousStatus == null) {
            throw new IllegalArgumentException("previousStatus 不能为 null");
        }
        if (currentStatus == null) {
            throw new IllegalArgumentException("currentStatus 不能为 null");
        }
        if (operatorId == null || operatorId.isBlank()) {
            throw new IllegalArgumentException("operatorId 不能为空");
        }
        if (occurredAt == null) {
            throw new IllegalArgumentException("occurredAt 不能为 null");
        }

        this.assetId = assetId;
        this.previousStatus = previousStatus;
        this.currentStatus = currentStatus;
        this.operatorId = operatorId;
        this.occurredAt = occurredAt;
        this.reason = reason;
    }

    /**
     * 使用当前系统时间构造资产状态变更事件（便捷工厂方法）。
     *
     * @param assetId        发生状态变更的资产 ID
     * @param previousStatus 变更前状态
     * @param currentStatus  变更后状态
     * @param operatorId     操作人标识
     * @param reason         变更原因，允许为 {@code null}
     * @return 新建的 {@code AssetStatusChangedEvent} 实例
     */
    public static AssetStatusChangedEvent of(Long assetId,
                                             AssetState previousStatus,
                                             AssetState currentStatus,
                                             String operatorId,
                                             String reason) {
        return new AssetStatusChangedEvent(
                assetId, previousStatus, currentStatus,
                operatorId, LocalDateTime.now(), reason);
    }

    /**
     * 返回发生状态变更的资产 ID。
     *
     * @return 资产 ID
     */
    public Long getAssetId() {
        return assetId;
    }

    /**
     * 返回变更前的资产状态。
     *
     * @return 变更前状态
     */
    public AssetState getPreviousStatus() {
        return previousStatus;
    }

    /**
     * 返回变更后的资产状态。
     *
     * @return 变更后状态
     */
    public AssetState getCurrentStatus() {
        return currentStatus;
    }

    /**
     * 返回触发本次状态变更的操作人标识。
     *
     * @return 操作人 ID 或用户名
     */
    public String getOperatorId() {
        return operatorId;
    }

    /**
     * 返回状态变更事件的发生时间。
     *
     * @return 事件发生时间戳
     */
    public LocalDateTime getOccurredAt() {
        return occurredAt;
    }

    /**
     * 返回本次状态变更的业务原因或备注。
     *
     * @return 变更原因，可能为 {@code null}
     */
    public String getReason() {
        return reason;
    }

    /**
     * 返回事件的可读描述，便于日志追踪。
     *
     * @return 包含资产 ID、状态迁移路径及操作人的字符串
     */
    @Override
    public String toString() {
        return "AssetStatusChangedEvent{"
                + "assetId=" + assetId
                + ", " + previousStatus + " -> " + currentStatus
                + ", operatorId='" + operatorId + '\''
                + ", occurredAt=" + occurredAt
                + ", reason='" + reason + '\''
                + '}';
    }
}