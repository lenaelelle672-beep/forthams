package com.ams.enums;

/**
 * 分配状态枚举。记录分配任务的生命周期阶段。
 */
public enum AssignmentStatus {
    /** 待分配：业务实体已创建，尚未触发或正在等待分配逻辑执行 */
    PENDING,

    /** 已分配：分配策略成功找到处理人并完成绑定 */
    ASSIGNED,

    /** 分配失败：分配过程中发生异常且降级处理（记录错误日志） */
    FAILED;

    @Override
    public String toString() {
        return name();
    }
}