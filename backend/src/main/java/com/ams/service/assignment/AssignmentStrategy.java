package com.ams.service.assignment;

import com.ams.dto.AssignmentContext;
import java.util.Optional;

/**
 * 分配策略接口。定义了分配引擎的核心契约：识别支持的实体类型并执行具体的分配算法。
 */
public interface AssignmentStrategy {

    /**
     * 检查当前策略是否支持该业务实体类型（如 "WORK_ORDER"）
     */
    boolean supports(String entityType);

    /**
     * 执行分配逻辑：根据上下文信息决定将资源指派给哪个处理人，并返回结果。
     * @param context 分配所需的元数据上下文
     * @return 返回包含 assigneeId 的 Optional 容器；若无法找到合适处理人则返回 empty
     */
    Optional<String> assign(AssignmentContext context);

    /**
     * 获取策略标识符，用于在配置或注解中指定
     */
    default String getStrategyName() {
        return this.getClass().getSimpleName();
    }
}