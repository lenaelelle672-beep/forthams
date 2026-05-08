package com.ams.service.assignment.impl;

import com.ams.dto.AssignmentContext;
import com.ams.service.assignment.AssignmentStrategy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 默认分配策略实现。采用简单的轮询算法（Round Robin）模拟资源分配逻辑。
 * 在生产环境中应替换为基于负载、技能匹配或权重计算的复杂引擎。
 */
@Service
public class DefaultAssignmentStrategy implements AssignmentStrategy {

    private static final Logger log = LoggerFactory.getLogger(DefaultAssignmentStrategy.class);

    // 模拟可用处理人池（实际应用中从数据库/Redis动态获取）
    private static final String[] MOCK_ASSIGNEES = {"user-001", "user-002", "user-003"};
    private final AtomicInteger counter = new AtomicInteger(0);

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

        // 模拟分配逻辑：轮询选择下一个处理人
        int index = Math.abs(counter.getAndIncrement() % MOCK_ASSIGNEES.length);
        String assigneeId = MOCK_ASSIGNEES[index];

        log.info("Assignment successful: {} -> {}", context.getTargetId(), assigneeId);
        return Optional.of(assigneeId);
    }

    @Override
    public String getStrategyName() {
        return "DEFAULT";
    }
}