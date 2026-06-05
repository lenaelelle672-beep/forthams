package com.ams.enums;

/**
 * 资产主附属关系类型枚举。
 * <p>定义父资产与子资产之间的关系分类。</p>
 */
public enum AssetRelationType {

    /** 备件 */
    SPARE_PART,
    /** 配件/附件 */
    ACCESSORY,
    /** 升级件 */
    UPGRADE,
    /** 附属物 */
    ATTACHMENT,
    /** 其他 */
    OTHER

}
