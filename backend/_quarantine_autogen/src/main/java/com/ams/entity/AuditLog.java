package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 审计日志实体类
 * 
 * <p>用于记录系统操作审计日志，支持按时间范围、操作用户、操作类型等维度查询。
 * 这是 SWARM-003 操作日志仪表板的核心数据实体。</p>
 * 
 * <p>使用示例:</p>
 * <pre>{@code
 * AuditLog auditLog = AuditLog.builder()
 *     .userId("user-001")
 *     .username("张三")
 *     .operationType(OperationType.CREATE)
 *     .operationDetail(Map.of("assetId", "A1001"))
 *     .ipAddress("192.168.1.100")
 *     .build();
 * }</pre>
 * 
 * @author AMS Team
 * @version 1.0
 * @since 2024-01-01
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("audit_logs")
public class AuditLog {

    /**
     * 日志记录唯一标识符 (UUID)
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 操作用户ID
     */
    @TableField("user_id")
    private String userId;

    /**
     * 操作用户名
     */
    @TableField("username")
    private String username;

    /**
     * 操作类型枚举值
     * 
     * @see OperationType
     */
    @TableField("operation_type")
    private String operationType;

    /**
     * 操作详情 (JSON 格式存储)
     * 
     * <p>用于存储操作的具体内容，如修改的字段、关联资源等信息。</p>
     */
    @TableField("operation_detail")
    private String operationDetail;

    /**
     * 操作来源 IP 地址
     */
    @TableField("ip_address")
    private String ipAddress;

    /**
     * 用户代理信息
     * 
     * <p>记录客户端浏览器或应用的相关信息，用于安全审计。</p>
     */
    @TableField("user_agent")
    private String userAgent;

    /**
     * 关联资源类型
     * 
     * <p>如: ASSET, WORK_ORDER, RETIREMENT 等</p>
     */
    @TableField("resource_type")
    private String resourceType;

    /**
     * 关联资源ID
     */
    @TableField("resource_id")
    private String resourceId;

    /**
     * 操作描述
     */
    @TableField("description")
    private String description;

    /**
     * 操作状态
     * 
     * <p>SUCCESS: 成功, FAILURE: 失败</p>
     */
    @TableField("status")
    private String status;

    /**
     * 错误信息 (如有)
     */
    @TableField("error_message")
    private String errorMessage;

    /**
     * 操作耗时 (毫秒)
     */
    @TableField("duration_ms")
    private Long durationMs;

    /**
     * 租户ID (用于多租户隔离)
     */
    @TableField("tenant_id")
    private String tenantId;

    /**
     * 记录创建时间 (自动填充)
     */
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    private LocalDateTime createdAt;

    /**
     * 记录更新时间 (自动填充)
     */
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    private LocalDateTime updatedAt;

    /**
     * 操作类型枚举
     * 
     * <p>定义了系统支持的所有操作类型，用于日志分类和筛选。</p>
     */
    public enum OperationType {
        /** 创建操作 */
        CREATE,
        /** 读取/查询操作 */
        READ,
        /** 更新操作 */
        UPDATE,
        /** 删除操作 */
        DELETE,
        /** 导出操作 */
        EXPORT,
        /** 导入操作 */
        IMPORT,
        /** 审批操作 */
        APPROVE,
        /** 拒绝操作 */
        REJECT,
        /** 审批通过 */
        APPROVED,
        /** 驳回 */
        REJECTED
    }

    /**
     * 操作状态枚举
     */
    public enum OperationStatus {
        /** 成功 */
        SUCCESS,
        /** 失败 */
        FAILURE,
        /** 部分成功 */
        PARTIAL_SUCCESS
    }
}