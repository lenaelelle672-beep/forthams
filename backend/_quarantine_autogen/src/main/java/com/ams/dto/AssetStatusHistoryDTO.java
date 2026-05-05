package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * 资产状态变更历史记录数据传输对象
 * 
 * 用于传输资产全生命周期中的状态变更记录，支持以下场景：
 * - 资产报废申请提交 (SCRAP_APPLY)
 * - 资产报废审批通过 (SCRAP_APPROVED)
 * - 资产报废审批驳回 (SCRAP_REJECTED)
 * - 以及其他资产状态变更场景
 * 
 * @since SWARM-002
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AssetStatusHistoryDTO {

    /**
     * 状态变更记录唯一标识符
     */
    private UUID id;

    /**
     * 关联的资产唯一标识符
     */
    private UUID assetId;

    /**
     * 状态变更类型
     * 
     * 支持的类型：
     * - SCRAP_APPLY: 报废申请提交
     * - SCRAP_APPROVED: 报废审批通过
     * - SCRAP_REJECTED: 报废审批驳回
     * - REGISTER: 资产登记
     * - RETIRE: 资产退役
     * - TRANSFER: 资产调拨
     * - MAINTENANCE: 资产维保
     */
    private String type;

    /**
     * 变更前的资产状态
     * 
     * 常见状态值：
     * - active: 在役
     * - idle: 闲置
     * - retired: 退役
     * - scrapped: 已报废
     * - maintenance: 维保中
     * - pending: 待处理（报废申请待审批）
     */
    private String fromStatus;

    /**
     * 变更后的资产状态
     * 
     * 参见 {@link #fromStatus} 状态值定义
     */
    private String toStatus;

    /**
     * 执行此次变更操作的操作人唯一标识符
     */
    private UUID operatorId;

    /**
     * 执行此次变更操作的操作人用户名
     * （可选字段，用于前端展示）
     */
    private String operatorName;

    /**
     * 状态变更操作时间
     * 
     * 格式：ISO8601 日期时间格式
     * 例如：2024-01-15T10:30:00Z
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    private LocalDateTime operatedAt;

    /**
     * 扩展数据字段
     * 
     * 用于存储与特定状态变更相关的附加信息，格式为键值对。
     * 例如报废申请时可能包含：
     * - reason: 报废原因
     * - rejectReason: 驳回原因（仅SCRAP_REJECTED时存在）
     * - approvalComment: 审批意见
     * - attachmentIds: 附件ID列表
     */
    private Map<String, Object> extraData;

    /**
     * 创建时间戳（记录入库时间）
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    private LocalDateTime createdAt;

    // ==================== 状态变更类型常量 ====================

    /** 报废申请提交 */
    public static final String TYPE_SCRAP_APPLY = "SCRAP_APPLY";

    /** 报废审批通过 */
    public static final String TYPE_SCRAP_APPROVED = "SCRAP_APPROVED";

    /** 报废审批驳回 */
    public static final String TYPE_SCRAP_REJECTED = "SCRAP_REJECTED";

    /** 资产登记 */
    public static final String TYPE_REGISTER = "REGISTER";

    /** 资产退役 */
    public static final String TYPE_RETIRE = "RETIRE";

    /** 资产调拨 */
    public static final String TYPE_TRANSFER = "TRANSFER";

    /** 资产维保 */
    public static final String TYPE_MAINTENANCE = "MAINTENANCE";

    // ==================== 资产状态常量 ====================

    /** 在役 */
    public static final String STATUS_ACTIVE = "active";

    /** 闲置 */
    public static final String STATUS_IDLE = "idle";

    /** 退役 */
    public static final String STATUS_RETIRED = "retired";

    /** 已报废 */
    public static final String STATUS_SCRAPPED = "scrapped";

    /** 维保中 */
    public static final String STATUS_MAINTENANCE = "maintenance";

    /** 待处理 */
    public static final String STATUS_PENDING = "pending";

    /**
     * 辅助方法：判断是否为报废相关操作
     * 
     * @return true 如果变更类型为报废相关类型
     */
    public boolean isScrapRelated() {
        return TYPE_SCRAP_APPLY.equals(type) 
            || TYPE_SCRAP_APPROVED.equals(type) 
            || TYPE_SCRAP_REJECTED.equals(type);
    }

    /**
     * 辅助方法：判断是否为终态（不可逆状态变更）
     * 
     * 报废状态为终态，不可变更回其他状态。
     * 
     * @return true 如果变更结果为终态
     */
    public boolean isTerminalStatus() {
        return STATUS_SCRAPPED.equals(toStatus);
    }

    /**
     * 辅助方法：获取变更描述信息
     * 
     * @return 格式化的状态变更描述
     */
    public String getChangeDescription() {
        return String.format("[%s] %s -> %s", 
            type != null ? type : "UNKNOWN",
            fromStatus != null ? fromStatus : "NONE", 
            toStatus != null ? toStatus : "NONE");
    }

    /**
     * 辅助方法：从 extraData 中安全获取扩展字段值
     * 
     * @param key 扩展字段键名
     * @param defaultValue 默认值
     * @return 扩展字段值或默认值
     */
    @SuppressWarnings("unchecked")
    public <T> T getExtraDataValue(String key, T defaultValue) {
        if (extraData == null || !extraData.containsKey(key)) {
            return defaultValue;
        }
        Object value = extraData.get(key);
        try {
            return (T) value;
        } catch (ClassCastException e) {
            return defaultValue;
        }
    }
}