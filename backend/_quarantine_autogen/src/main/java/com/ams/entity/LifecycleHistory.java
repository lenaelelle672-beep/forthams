package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * 资产生命周期历史记录实体
 * 
 * <p>用于记录资产从入库到报废的全链路状态变更与审批历史。
 * 支持报废/退役申请流程中的多级审批节点记录。</p>
 * 
 * <p>事件类型枚举：</p>
 * <ul>
 *   <li>CREATED - 资产创建</li>
 *   <li>STATUS_CHANGED - 资产状态变更</li>
 *   <li>RETIREMENT_CREATED - 报废/退役申请创建</li>
 *   <li>LEVEL_X_APPROVED - 第X级审批通过</li>
 *   <li>APPLICATION_REJECTED - 申请被驳回</li>
 *   <li>RETIREMENT_COMPLETED - 报废/退役流程完成</li>
 *   <li>APPLICATION_WITHDRAWN - 申请被撤销</li>
 * </ul>
 * 
 * @see RetirementApplication
 * @since SWARM-2026-Q2-002
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("asset_lifecycle_history")
public class LifecycleHistory {

    /**
     * 生命周期记录唯一标识
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 关联资产ID
     */
    @TableField("asset_id")
    private String assetId;

    /**
     * 关联资产实体（不存储，仅用于关联查询）
     */
    @TableField(exist = false)
    private Asset asset;

    /**
     * 事件类型
     * @see LifecycleEventType
     */
    @TableField("event_type")
    private String eventType;

    /**
     * 事件描述
     */
    @TableField("event_description")
    private String eventDescription;

    /**
     * 事件发生时间
     */
    @TableField("event_time")
    private LocalDateTime eventTime;

    /**
     * 操作用户ID
     */
    @TableField("operator_id")
    private String operatorId;

    /**
     * 操作用户姓名
     */
    @TableField("operator_name")
    private String operatorName;

    /**
     * 关联的报废/退役申请ID（可选）
     */
    @TableField("retirement_application_id")
    private String retirementApplicationId;

    /**
     * 关联的审批任务ID（可选，用于审批节点记录）
     */
    @TableField("approval_task_id")
    private String approvalTaskId;

    /**
     * 审批节点级别（1-5级，0表示非审批事件）
     */
    @TableField("approval_level")
    private Integer approvalLevel;

    /**
     * 审批意见（审批类事件记录）
     */
    @TableField("approval_comment")
    private String approvalComment;

    /**
     * 事件扩展数据（JSON格式，存储额外信息）
     */
    @TableField("extra_data")
    private String extraData;

    /**
     * 客户端IP地址
     */
    @TableField("client_ip")
    private String clientIp;

    /**
     * 记录创建时间
     */
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    /**
     * 乐观锁版本号
     */
    @Version
    @TableField("version")
    private Long version;

    /**
     * 逻辑删除标记
     */
    @TableLogic
    @TableField("deleted")
    private Boolean deleted;

    /**
     * 生命周期事件类型枚举
     */
    public static final class LifecycleEventType {
        /** 资产创建 */
        public static final String CREATED = "CREATED";
        
        /** 资产状态变更 */
        public static final String STATUS_CHANGED = "STATUS_CHANGED";
        
        /** 报废/退役申请创建 */
        public static final String RETIREMENT_CREATED = "RETIREMENT_CREATED";
        
        /** 第1级审批通过 */
        public static final String LEVEL_1_APPROVED = "LEVEL_1_APPROVED";
        
        /** 第2级审批通过 */
        public static final String LEVEL_2_APPROVED = "LEVEL_2_APPROVED";
        
        /** 第3级审批通过 */
        public static final String LEVEL_3_APPROVED = "LEVEL_3_APPROVED";
        
        /** 第4级审批通过 */
        public static final String LEVEL_4_APPROVED = "LEVEL_4_APPROVED";
        
        /** 第5级审批通过 */
        public static final String LEVEL_5_APPROVED = "LEVEL_5_APPROVED";
        
        /** 申请被驳回 */
        public static final String APPLICATION_REJECTED = "APPLICATION_REJECTED";
        
        /** 报废/退役流程完成 */
        public static final String RETIREMENT_COMPLETED = "RETIREMENT_COMPLETED";
        
        /** 申请被撤销 */
        public static final String APPLICATION_WITHDRAWN = "APPLICATION_WITHDRAWN";
        
        /** 资产转移 */
        public static final String ASSET_TRANSFERRED = "ASSET_TRANSFERRED";
        
        /** 资产借用 */
        public static final String ASSET_BORROWED = "ASSET_BORROWED";
        
        /** 资产归还 */
        public static final String ASSET_RETURNED = "ASSET_RETURNED";
        
        /** 维保记录 */
        public static final String MAINTENANCE_RECORDED = "MAINTENANCE_RECORDED";
        
        /** 盘点记录 */
        public static final String INVENTORY_CHECKED = "INVENTORY_CHECKED";
        
        /** 审批任务激活 */
        public static final String APPROVAL_TASK_ACTIVATED = "APPROVAL_TASK_ACTIVATED";
        
        /** 审批任务超时 */
        public static final String APPROVAL_TASK_EXPIRED = "APPROVAL_TASK_EXPIRED";
    }

    /**
     * 创建资产创建事件
     * 
     * @param assetId 资产ID
     * @param operatorId 操作用户ID
     * @param operatorName 操作用户姓名
     * @return LifecycleHistory实例
     */
    public static LifecycleHistory createAssetCreatedEvent(
            String assetId, 
            String operatorId, 
            String operatorName) {
        return LifecycleHistory.builder()
                .assetId(assetId)
                .eventType(LifecycleEventType.CREATED)
                .eventDescription("资产创建")
                .eventTime(LocalDateTime.now())
                .operatorId(operatorId)
                .operatorName(operatorName)
                .approvalLevel(0)
                .build();
    }

    /**
     * 创建报废申请创建事件
     * 
     * @param assetId 资产ID
     * @param applicationId 申请ID
     * @param operatorId 操作用户ID
     * @param operatorName 操作用户姓名
     * @param applicationType 申请类型（scrap/retirement）
     * @return LifecycleHistory实例
     */
    public static LifecycleHistory createRetirementCreatedEvent(
            String assetId,
            String applicationId,
            String operatorId,
            String operatorName,
            String applicationType) {
        String desc = "scrapp".equals(applicationType) ? "发起报废申请" : "发起退役申请";
        return LifecycleHistory.builder()
                .assetId(assetId)
                .eventType(LifecycleEventType.RETIREMENT_CREATED)
                .eventDescription(desc)
                .eventTime(LocalDateTime.now())
                .operatorId(operatorId)
                .operatorName(operatorName)
                .retirementApplicationId(applicationId)
                .approvalLevel(0)
                .build();
    }

    /**
     * 创建审批通过事件
     * 
     * @param assetId 资产ID
     * @param applicationId 申请ID
     * @param taskId 审批任务ID
     * @param level 审批级别（1-5）
     * @param operatorId 操作用户ID
     * @param operatorName 操作用户姓名
     * @param comment 审批意见
     * @return LifecycleHistory实例
     */
    public static LifecycleHistory createApprovalEvent(
            String assetId,
            String applicationId,
            String taskId,
            int level,
            String operatorId,
            String operatorName,
            String comment) {
        String eventType = "LEVEL_" + level + "_APPROVED";
        return LifecycleHistory.builder()
                .assetId(assetId)
                .eventType(eventType)
                .eventDescription("第" + level + "级审批通过")
                .eventTime(LocalDateTime.now())
                .operatorId(operatorId)
                .operatorName(operatorName)
                .retirementApplicationId(applicationId)
                .approvalTaskId(taskId)
                .approvalLevel(level)
                .approvalComment(comment)
                .build();
    }

    /**
     * 创建申请驳回事件
     * 
     * @param assetId 资产ID
     * @param applicationId 申请ID
     * @param taskId 审批任务ID
     * @param level 审批级别
     * @param operatorId 操作用户ID
     * @param operatorName 操作用户姓名
     * @param reason 驳回原因
     * @return LifecycleHistory实例
     */
    public static LifecycleHistory createRejectionEvent(
            String assetId,
            String applicationId,
            String taskId,
            int level,
            String operatorId,
            String operatorName,
            String reason) {
        return LifecycleHistory.builder()
                .assetId(assetId)
                .eventType(LifecycleEventType.APPLICATION_REJECTED)
                .eventDescription("申请被驳回：" + reason)
                .eventTime(LocalDateTime.now())
                .operatorId(operatorId)
                .operatorName(operatorName)
                .retirementApplicationId(applicationId)
                .approvalTaskId(taskId)
                .approvalLevel(level)
                .approvalComment(reason)
                .build();
    }

    /**
     * 创建流程完成事件
     * 
     * @param assetId 资产ID
     * @param applicationId 申请ID
     * @param operatorId 操作用户ID
     * @param operatorName 操作用户姓名
     * @param finalStatus 最终状态（scrapped/retired）
     * @return LifecycleHistory实例
     */
    public static LifecycleHistory createCompletionEvent(
            String assetId,
            String applicationId,
            String operatorId,
            String operatorName,
            String finalStatus) {
        String desc = "scrapped".equals(finalStatus) ? "资产已报废" : "资产已退役";
        return LifecycleHistory.builder()
                .assetId(assetId)
                .eventType(LifecycleEventType.RETIREMENT_COMPLETED)
                .eventDescription(desc)
                .eventTime(LocalDateTime.now())
                .operatorId(operatorId)
                .operatorName(operatorName)
                .retirementApplicationId(applicationId)
                .approvalLevel(0)
                .build();
    }

    /**
     * 创建申请撤销事件
     * 
     * @param assetId 资产ID
     * @param applicationId 申请ID
     * @param operatorId 操作用户ID
     * @param operatorName 操作用户姓名
     * @param reason 撤销原因
     * @return LifecycleHistory实例
     */
    public static LifecycleHistory createWithdrawalEvent(
            String assetId,
            String applicationId,
            String operatorId,
            String operatorName,
            String reason) {
        return LifecycleHistory.builder()
                .assetId(assetId)
                .eventType(LifecycleEventType.APPLICATION_WITHDRAWN)
                .eventDescription("申请被撤销：" + reason)
                .eventTime(LocalDateTime.now())
                .operatorId(operatorId)
                .operatorName(operatorName)
                .retirementApplicationId(applicationId)
                .approvalLevel(0)
                .build();
    }

    /**
     * 判断事件类型是否为审批相关
     * 
     * @return true如果是审批事件
     */
    public boolean isApprovalEvent() {
        return eventType != null && 
               (eventType.startsWith("LEVEL_") || 
                eventType.equals(LifecycleEventType.APPLICATION_REJECTED) ||
                eventType.equals(LifecycleEventType.APPLICATION_WITHDRAWN));
    }

    /**
     * 获取审批级别描述
     * 
     * @return 级别描述，如"一级审批"、"二级审批"等
     */
    public String getApprovalLevelDescription() {
        if (approvalLevel == null || approvalLevel == 0) {
            return "非审批事件";
        }
        String[] levels = {"", "一", "二", "三", "四", "五"};
        int idx = Math.min(approvalLevel, 5);
        return levels[idx] + "级审批";
    }
}