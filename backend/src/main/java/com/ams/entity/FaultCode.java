package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("fault_code")
public class FaultCode implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 故障编码 */
    private String code;

    /** 故障现象（level=1） */
    private String faultPhenomenon;

    /** 故障原因（level=2） */
    private String faultCause;

    /** 解决措施（level=3） */
    private String solution;

    /** 父节点ID */
    private Long parentId;

    /** 层级：1-现象，2-原因，3-措施 */
    private Integer level;

    /** 关联分类ID列表（逗号分隔） */
    private String categoryIds;

    /** 租户ID */
    private String tenantId;

    /** 状态：ENABLED/DISABLED */
    private String status;

    /** 排序号 */
    private Integer sortOrder;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    // ── 非持久化辅助字段 ─────────────────────────────────────────────────────────

    /** 子节点列表（树形结构） */
    @TableField(exist = false)
    private List<FaultCode> children;

    /** 父节点名称（展示用） */
    @TableField(exist = false)
    private String parentName;

    /** 父节点编码（展示用） */
    @TableField(exist = false)
    private String parentCode;
}
