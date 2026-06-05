package com.ams.enums;

/**
 * 位置层级类型枚举（与 V2_9__location_tree.sql 严格对齐）。
 *
 * <p>对应 location 表 location_type 字段，合法值集合：
 * PROVINCE / CITY / DISTRICT / BUILDING / FLOOR / ROOM。</p>
 *
 * <p>本枚举为 S0.5a 前置修复（R9 根治）配套常量，串联前端级联选择器
 * 与后端空间聚合 type 参数。</p>
 */
public enum LocationType {

    /** 省/直辖市 */
    PROVINCE("省"),

    /** 城市 */
    CITY("市"),

    /** 区/县 */
    DISTRICT("区"),

    /** 建筑 */
    BUILDING("建筑"),

    /** 楼层 */
    FLOOR("楼层"),

    /** 区域/房间 */
    ROOM("区域");

    private final String desc;

    LocationType(String desc) {
        this.desc = desc;
    }

    public String getDesc() {
        return desc;
    }

    /**
     * 大小写不敏感解析。传入 null 或非法值返回 null，由调用方决定 fallback。
     */
    public static LocationType of(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        for (LocationType t : values()) {
            if (t.name().equalsIgnoreCase(s)) {
                return t;
            }
        }
        return null;
    }
}
