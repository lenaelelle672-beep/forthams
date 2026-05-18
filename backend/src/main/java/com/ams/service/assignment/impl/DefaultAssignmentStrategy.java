package com.ams.service.assignment.impl;

import com.ams.dto.AssignmentContext;
import com.ams.service.assignment.AssignmentStrategy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Map;

/**
 * 默认分配策略实现。
 * 优先从业务上下文的显式处理人字段中解析分配对象；无法解析时返回空结果，交由上层策略链处理。
 */
@Service
public class DefaultAssignmentStrategy implements AssignmentStrategy {

    private static final Logger log = LoggerFactory.getLogger(DefaultAssignmentStrategy.class);
    private static final String[] ASSIGNEE_KEYS = {
            "assigneeId",
            "handlerId",
            "ownerId",
            "approverId",
            "executorId",
            "userId"
    };

    @Override
    public boolean supports(String entityType) {
        // 默认支持所有实体类型，实际可通过配置控制范围
        return true;
    }

    @Override
    public Optional<String> assign(AssignmentContext context) {
        log.info("Executing assignment strategy [Default] for {}#{} (ID: {})",
                context.getEntityType(),
                context.getStrategyType(),
                context.getTargetId());

        Optional<String> assigneeId = resolveAssignee(context);
        assigneeId.ifPresentOrElse(
                value -> log.info("Assignment successful: {} -> {}", context.getTargetId(), value),
                () -> log.warn("No assignment candidate found for {}#{} (ID: {})",
                        context.getEntityType(), context.getStrategyType(), context.getTargetId())
        );
        return assigneeId;
    }

    private Optional<String> resolveAssignee(AssignmentContext context) {
        Optional<String> fromArgs = resolveFromMap(context.getMethodArgs());
        if (fromArgs.isPresent()) {
            return fromArgs;
        }
        if (context.getResultSnapshot() instanceof Map<?, ?> resultMap) {
            return resolveFromMap(resultMap);
        }
        return Optional.empty();
    }

    private Optional<String> resolveFromMap(Map<?, ?> values) {
        if (values == null || values.isEmpty()) {
            return Optional.empty();
        }
        for (String key : ASSIGNEE_KEYS) {
            Object value = values.get(key);
            if (value != null && !String.valueOf(value).isBlank()) {
                return Optional.of(String.valueOf(value));
            }
        }
        return Optional.empty();
    }

    @Override
    public String getStrategyName() {
        return "DEFAULT";
    }
}
