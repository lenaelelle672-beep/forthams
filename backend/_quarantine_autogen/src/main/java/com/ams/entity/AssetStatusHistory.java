package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产状态变更历史记录实体类
 * 
 * <p>用于记录资产在生命周期中的所有状态变更，包括但不限于：
 * <ul>
 *   <li>报废申请提交 (SCRAP_APPLY)</li>
 *   <li>报废审批通过 (SCRAP_APPROVED)</li>
 *   <li>报废审批驳回 (SCRAP_REJECTED)</li>
 * </ul>
 * 
 * <p>该实体支持审计追溯需求，确保资产状态变更的完整历史可查。
 * 
 * @author AMS Team
 * @since 1.0
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@TableName("asset_status_history")
public class AssetStatusHistory {

    /**
     * 主键ID
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private UUID id;

    /**
     * 关联的资产ID
     */
    private UUID assetId;

    /**
     * 变更类型
     * <p>可选值：SCRAP_APPLY, SCRAP_APPROVED, SCRAP_REJECTED</p>
     */
    private String type;

    /**
     * 变更前状态
     */
    private String fromStatus;

    /**
     * 变更后状态
     */
    private String toStatus;

    /**
     * 操作人ID
     */
    private UUID operatorId;

    /**
     * 操作时间
     */
    private LocalDateTime operatedAt;

    /**
     * 扩展数据（JSON格式）
     * <p>用于存储额外的变更上下文信息，如审批意见、报废原因等</p>
     */
    private String extraData;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;

    /**
     * 变更类型枚举
     */
    public static final class Type {
        /** 报废申请提交 */
        public static final String SCRAP_APPLY = "SCRAP_APPLY";
        /** 报废审批通过 */
        public static final String SCRAP_APPROVED = "SCRAP_APPROVED";
        /** 报废审批驳回 */
        public static final String SCRAP_REJECTED = "SCRAP_REJECTED";
    }
}