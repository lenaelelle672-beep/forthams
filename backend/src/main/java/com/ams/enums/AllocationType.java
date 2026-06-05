package com.ams.enums;

import java.util.Arrays;
import java.util.List;

/**
 * 资产领用类型枚举。
 * <p>定义四种领用场景：长期领用、短期借用、归还入库、调拨转移。</p>
 *
 * <ul>
 *   <li>{@link #ASSIGNMENT} — 资产长期分配给某人/部门使用</li>
 *   <li>{@link #BORROW}     — 资产短期借用，可关联到期提醒</li>
 *   <li>{@link #RETURN}     — 资产退还仓库</li>
 *   <li>{@link #TRANSFER}   — 资产在不同部门间调拨</li>
 * </ul>
 */
public enum AllocationType {

    /** 长期领用：资产长期分配给某人/部门使用 */
    ASSIGNMENT("ASSIGNMENT", "长期领用", "资产长期分配给某人/部门使用"),

    /** 短期借用：资产短期借用，可关联到期提醒 */
    BORROW("BORROW", "短期借用", "资产短期借用，可关联到期提醒"),

    /** 归还入库：资产退还仓库 */
    RETURN("RETURN", "归还入库", "资产退还仓库"),

    /** 调拨转移：资产在不同部门间调拨 */
    TRANSFER("TRANSFER", "调拨转移", "资产在不同部门间调拨");

    private final String code;
    private final String label;
    private final String description;

    AllocationType(String code, String label, String description) {
        this.code = code;
        this.label = label;
        this.description = description;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }

    /**
     * 根据名称解析枚举值（大小写不敏感）。
     *
     * @param name 枚举名称
     * @return 匹配的枚举值
     * @throws IllegalArgumentException 当名称无效时抛出
     */
    public static AllocationType fromName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("AllocationType must not be blank");
        }
        String normalized = name.trim().toUpperCase(java.util.Locale.ROOT);
        for (AllocationType type : values()) {
            if (type.code.equals(normalized)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Invalid AllocationType: " + name);
    }

    /**
     * 根据名称解析枚举值，解析失败时返回默认值。
     *
     * @param name         枚举名称
     * @param defaultValue 默认值
     * @return 匹配的枚举值或默认值
     */
    public static AllocationType fromNameOrDefault(String name, AllocationType defaultValue) {
        if (name == null || name.isBlank()) {
            return defaultValue;
        }
        try {
            return fromName(name);
        } catch (IllegalArgumentException e) {
            return defaultValue;
        }
    }

    /**
     * 返回所有枚举值列表。
     *
     * @return 不可变列表
     */
    public static List<AllocationType> getAll() {
        return Arrays.asList(values());
    }
}
