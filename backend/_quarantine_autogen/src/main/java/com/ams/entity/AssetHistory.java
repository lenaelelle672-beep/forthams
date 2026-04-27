package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 资产历史记录实体类
 * 
 * <p>用于记录资产状态变更的完整历史，支持追溯资产全生命周期。
 * 每次状态变更都会自动生成一条历史记录，保证数据可审计性。
 * 
 * <p>核心功能：
 * <ul>
 *   <li>记录资产状态转换轨迹</li>
 *   <li>支持变更原因和操作人追踪</li>
 *   <li>保留变更元数据用于问题排查</li>
 * </ul>
 *
 * @author AMS Team
 * @version 1.0
 * @since 2024
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("asset_history")
public class AssetHistory {

    /**
     * 主键ID
     */
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /**
     * 资产ID
     * 
     * <p>关联资产表的唯一标识符，用于查询特定资产的历史记录。
     */
    private Long assetId;

    /**
     * 变更前状态
     * 
     * <p>记录资产状态变更前的状态值，如：IN_USE, PENDING_RETIREMENT 等。
     * 用于构建状态转换链路图。
     */
    private String fromStatus;

    /**
     * 变更后状态
     * 
     * <p>记录资产状态变更后的状态值，如：RETIRED, SCRAPPED 等。
     * 该字段标识资产当前所处的状态。
     */
    private String toStatus;

    /**
     * 操作人ID
     * 
     * <p>记录执行状态变更操作的用户ID，用于审计追踪。
     * 如果为系统自动变更，应记录系统用户ID。
     */
    private Long operatorId;

    /**
     * 操作人姓名
     * 
     * <p>冗余字段，用于快速展示而不需要关联查询用户表。
     */
    private String operatorName;

    /**
     * 变更时间
     * 
     * <p>精确到秒的时间戳，记录状态变更发生的具体时间。
     * 用于按时间线排序和历史追溯。
     */
    private LocalDateTime changeTime;

    /**
     * 变更原因
     * 
     * <p>记录触发状态变更的原因描述，如"设备老化报废"、"正常退役"等。
     * 为空时表示标准流程触发的状态变更。
     */
    private String reason;

    /**
     * 关联业务ID
     * 
     * <p>用于关联触发此次状态变更的业务流程，如报废申请ID、审批记录ID等。
     * 便于追溯状态变更的业务上下文。
     */
    private String businessId;

    /**
     * 业务类型
     * 
     * <p>标识触发状态变更的业务类型，如：RETIREMENT_APPLICATION, APPROVAL 等。
     */
    private String businessType;

    /**
     * 变更元数据
     * 
     * <p>以JSON格式存储的扩展字段，用于记录额外的变更信息。
     * 可包含如：IP地址、终端设备、变更来源系统等。
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> metadata;

    /**
     * 备注
     * 
     * <p>可选的备注信息，用于记录特殊情况或补充说明。
     */
    private String remark;

    /**
     * 创建时间
     * 
     * <p>记录数据入库时间，由数据库自动维护。
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     * 
     * <p>记录数据最后更新时间，由数据库自动维护。
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /**
     * 逻辑删除标记
     * 
     * <p>0-未删除，1-已删除。
     * 历史记录不建议物理删除，保持数据完整性。
     */
    @TableLogic
    private Integer deleted;
}