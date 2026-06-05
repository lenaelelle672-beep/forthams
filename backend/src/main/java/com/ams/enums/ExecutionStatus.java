package com.ams.enums;

/**
 * 维保执行状态枚举。
 *
 * <p>合法状态流转：
 * <ul>
 *   <li>IDLE（待开始）→ RUNNING（执行中）</li>
 *   <li>RUNNING（执行中）→ PAUSED（已暂停）</li>
 *   <li>PAUSED（已暂停）→ RUNNING（执行中）</li>
 *   <li>RUNNING（执行中）→ COMPLETED（已完成）</li>
 * </ul>
 */
public enum ExecutionStatus {

    /** 待开始：执行记录已创建但尚未开始施工。 */
    IDLE,

    /** 执行中：施工正在进行。 */
    RUNNING,

    /** 已暂停：施工因故暂停。 */
    PAUSED,

    /** 已完成：施工执行完毕。 */
    COMPLETED;

    /**
     * 判断给定状态是否为终态。
     */
    public static boolean isTerminal(ExecutionStatus status) {
        return status == COMPLETED;
    }

    /**
     * 判断当前状态是否为终态。
     */
    public boolean isTerminal() {
        return isTerminal(this);
    }
}
