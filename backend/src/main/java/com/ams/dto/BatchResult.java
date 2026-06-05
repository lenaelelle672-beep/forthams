package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 批量操作结果（BatchResult）
 *
 * <p>用途：
 * 通用批量操作结果类，记录总数、成功数、失败数和消息。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchResult {
    /**
     * 总数
     */
    private int total;

    /**
     * 成功数
     */
    private int success;

    /**
     * 失败数
     */
    private int failure;

    /**
     * 消息
     */
    private String message;
}