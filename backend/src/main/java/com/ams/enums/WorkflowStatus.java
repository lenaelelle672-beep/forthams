package com.ams.enums;

/**
 * 工作流定义状态枚举，定义流程定义的生命周期状态。
 *
 * <p>状态流转路径：
 * <ul>
 *   <li>UNCONFIGURED → DRAFT（首次保存草稿）</li>
 *   <li>DRAFT → PUBLISHED（发布）</li>
 *   <li>PUBLISHED → DRAFT（重新编辑）</li>
 *   <li>PUBLISHED → DISABLED（停用）</li>
 *   <li>DISABLED → PUBLISHED（重新启用）</li>
 *   <li>DRAFT / DISABLED → 删除</li>
 * </ul>
 */
public enum WorkflowStatus {

    /** 未配置：该业务类型尚未创建流程定义。仅用于 DTO 响应。 */
    UNCONFIGURED,

    /** 草稿：流程定义已保存但尚未发布。 */
    DRAFT,

    /** 已发布：流程定义已发布，可被业务使用。 */
    PUBLISHED,

    /** 已停用：流程定义已发布但被手动停用。 */
    DISABLED;

    /**
     * updateStatus 接口接受的输入值，映射到实际状态变更操作。
     * ENABLED 表示恢复为 PUBLISHED，DISABLED 表示停用。
     */
    public static final String ACTION_ENABLED = "ENABLED";
    public static final String ACTION_DISABLED = "DISABLED";
}
