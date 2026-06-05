package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 资产主附属关系（父子关系）实体。
 * <p>对应表 asset_parent_child，记录父资产与子资产之间的关联关系。</p>
 * <ul>
 *   <li>支持一对多：一个父资产可有多个子资产</li>
 *   <li>树形查询：通过 getTree() 构建父子关系树</li>
 *   <li>循环引用校验：addRelation 时执行 DFS 向上遍历</li>
 * </ul>
 */
@Data
@TableName("asset_parent_child")
public class AssetParentChild implements Serializable {

    /** 统一深度限制，防止无限递归 */
    public static final int MAX_TREE_DEPTH = 10;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 父资产 ID */
    private Long parentAssetId;

    /** 子资产 ID */
    private Long childAssetId;

    /** 关系类型：SPARE_PART/ACCESSORY/UPGRADE/ATTACHMENT/OTHER */
    private String relationType;

    /** 数量（默认 1） */
    private Integer quantity;

    /** 备注 */
    private String remark;

    /** 租户 ID */
    private String tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableLogic
    private Integer deleted;

}
