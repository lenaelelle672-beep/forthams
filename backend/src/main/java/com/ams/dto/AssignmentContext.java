package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 分配上下文 DTO。封装切面提取的业务实体元数据，作为分配策略引擎的输入参数。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentContext {

    /** 目标实体的唯一标识符 (如 WorkOrder ID) */
    private Long targetId;

    /** 业务实体类型（对应 @AutoAssign 中的 entityType） */
    private String entityType;

    /** 分配策略类型（对应 @AutoAssign 中的 strategyType） */
    private String strategyType;

    /** 触发分配的时间戳 */
    private LocalDateTime triggerTime;

    /** 当前租户 ID，用于多租户隔离校验 */
    private String tenantId;

    /** 业务方法执行后的返回值快照（可选），供策略引擎根据具体内容做决策 */
    private Object resultSnapshot;

    /** 方法调用时的原始参数列表（可选） */
    private Map<String, Object> methodArgs;

    /** 是否需要异步处理的标记位 */
    private boolean asyncRequested;

    @Override
    public String toString() {
        return "AssignmentContext{" +
                "targetId=" + targetId +
                ", entityType='" + entityType + '\'' +
                ", strategyType='" + strategyType + '\'' +
                ", triggerTime=" + triggerTime +
                ", tenantId='" + tenantId + '\'' +
                '}';
    }
}