package com.ams.enums;

import lombok.Getter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 资产盘点任务状态枚举。
 *
 * <p>定义盘点任务的完整生命周期状态，严格按照以下单向线性流转：
 * <pre>
 *   DRAFT → IN_PROGRESS → COMPLETED → APPROVED
 * </pre>
 * 任何非终端状态均可流转至 {@link #CANCELLED}。</p>
 *
 * <p>状态机边界约束（对准 SWARM-P3-010-BE 规格）：
 * <ul>
 *   <li>禁止跨越状态（如从 DRAFT 直达 COMPLETED）</li>
 *   <li>禁止逆向回退（如从 COMPLETED 回到 IN_PROGRESS）</li>
 *   <li>终态（APPROVED / CANCELLED）不接受任何状态变更</li>
 * </ul>
 * </p>
 */
@Getter
public enum InventoryStatus {

    /**
     * 草稿：盘点任务已创建，尚未发布/开始执行。
     * 关联资产清单已生成快照，但尚未锁定资产。
     */
    DRAFT("草稿", false),

    /**
     * 进行中：盘点任务已发布，实盘数据录入阶段。
     * 此状态下关联资产应处于隐式锁定状态，禁止报废、调拨等改变状态的操作。
     */
    IN_PROGRESS("进行中", false),

    /**
     * 盘点完成：所有明细的实盘数据已全部录入完毕。
     * 此状态下可触发账实比对（compare）接口，等待核准。
     */
    COMPLETED("盘点完成", false),

    /**
     * 已核准：盘点差异已确认，资产主数据的物理状态已按实盘结果自动修正。
     * 此为终态，不可再变更。
     */
    APPROVED("已核准", true),

    /**
     * 已取消：任务在执行前或执行中被手动终止。
     * 此为终态，不可再变更。
     */
    CANCELLED("已取消", true);

    /** 状态中文描述 */
    private final String description;

    /** 是否为终态（不可再流转） */
    private final boolean terminal;

    InventoryStatus(String description, boolean terminal) {
        this.description = description;
        this.terminal = terminal;
    }

    /**
     * 根据枚举名称获取实例，忽略大小写。
     *
     * @param name 枚举名称（如 "DRAFT"、"in_progress"）
     * @return 对应的 InventoryStatus 实例
     * @throws IllegalArgumentException 如果名称无法匹配任何枚举值
     */
    public static InventoryStatus fromName(String name) {
        if (name == null) {
            return null;
        }
        for (InventoryStatus status : values()) {
            if (status.name().equalsIgnoreCase(name)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown inventory status: " + name);
    }

    /**
     * 判断当前状态是否处于活跃（非终态）阶段，即允许继续盘点操作。
     *
     * @return true 表示活跃状态，false 表示已达终态
     */
    public boolean isActive() {
        return !terminal;
    }

    /**
     * 校验状态流转的合法性。
     *
     * <p>严格按照规格要求的单向线性流转：
     * <ul>
     *   <li>DRAFT → IN_PROGRESS / CANCELLED</li>
     *   <li>IN_PROGRESS → COMPLETED / CANCELLED</li>
     *   <li>COMPLETED → APPROVED</li>
     *   <li>APPROVED → （终态，不可流转）</li>
     *   <li>CANCELLED → （终态，不可流转）</li>
     * </ul>
     * </p>
     *
     * @param nextStatus 目标状态
     * @return true 表示允许流转
     */
    public boolean canTransitionTo(InventoryStatus nextStatus) {
        if (nextStatus == null) {
            return false;
        }
        // 允许保持在当前状态（幂等）
        if (this == nextStatus) {
            return true;
        }
        // 终态不可再流转
        if (this.terminal) {
            return false;
        }

        switch (this) {
            case DRAFT:
                return nextStatus == IN_PROGRESS || nextStatus == CANCELLED;
            case IN_PROGRESS:
                return nextStatus == COMPLETED || nextStatus == CANCELLED;
            case COMPLETED:
                return nextStatus == APPROVED;
            default:
                return false;
        }
    }

    /**
     * 获取当前状态下允许流转的所有目标状态列表（不可变）。
     *
     * @return 可流转的目标状态列表
     */
    public List<InventoryStatus> getNextPossibleStatuses() {
        List<InventoryStatus> next = new ArrayList<>();
        for (InventoryStatus status : values()) {
            if (this.canTransitionTo(status) && this != status) {
                next.add(status);
            }
        }
        return Collections.unmodifiableList(next);
    }
}