package com.ams.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 空间单元类型枚举（gai2 W2 — 与 V2_9__location_tree.sql location_type VARCHAR(20) 严格对齐）。
 *
 * <p>层级说明：</p>
 * <ul>
 *   <li>PROVINCE / CITY / DISTRICT：行政区域，GIS 视角用于资产地图国家-省-市-区 4 级下钻</li>
 *   <li>BUILDING / FLOOR / ROOM：业务空间单元，能耗/平面图主战场</li>
 * </ul>
 *
 * <p>isAssetLevel() 用于区分"资产型"（BUILDING/FLOOR/ROOM — asset.location_id 直接挂载）vs
 * 行政型（PROVINCE/CITY/DISTRICT — 通常仅用于 GIS 区域选择，资产不一定直接挂载）。</p>
 */
public enum LocationType {
    PROVINCE("省"),
    CITY("市"),
    DISTRICT("区"),
    BUILDING("建筑"),
    FLOOR("楼层"),
    ROOM("区域");

    private final String desc;

    LocationType(String desc) {
        this.desc = desc;
    }

    @JsonValue
    public String getDesc() {
        return desc;
    }

    /**
     * 大小写不敏感解析；非法字符串返回 null。
     */
    public static LocationType of(String s) {
        if (s == null || s.isBlank()) return null;
        for (LocationType t : values()) {
            if (t.name().equalsIgnoreCase(s)) return t;
        }
        return null;
    }

    /**
     * 资产型空间（asset.location_id 可直接挂载），用于 cascade 聚合的 root 范围判断。
     */
    public boolean isAssetLevel() {
        return this == BUILDING || this == FLOOR || this == ROOM;
    }
}
