package com.assetmanage.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 资产批量导入结果返回对象 (Import Result VO)
 * 用于承载导入操作的执行统计与详细错误报告
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportResultDTO {

    /**
     * 总处理行数（不含表头）
     */
    private int totalCount;

    /**
     * 成功导入的记录条数
     */
    private int successCount;

    /**
     * 校验失败或解析错误的记录条数
     */
    private int failCount;

    /**
     * 错误明细列表，包含具体的行号与对应的异常原因描述
     */
    private List<ImportErrorDetail> errorDetails;

    /**
     * 导入结果状态：SUCCESS (全部成功), PARTIAL_SUCCESS (部分成功), FAILED (全部失败)
     */
    private ImportStatus status;

    /**
     * 导入结果状态枚举
     */
    public enum ImportStatus {
        /** 全部行校验通过并成功导入 */
        SUCCESS,
        /** 部分行校验通过，部分行存在错误 */
        PARTIAL_SUCCESS,
        /** 全部行均校验失败或文件解析异常 */
        FAILED
    }

    /**
     * 单行错误明细对象
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportErrorDetail {

        /**
         * 发生错误的 Excel 行号（从1开始计数，对应用户看到的物理行）
         */
        private int rowNumber;

        /**
         * 具体错误原因描述（例如: "资产编号不能为空", "状态值'UNKNOWN'不在枚举范围内"）
         */
        private String errorMessage;

        /**
         * 发生错误的字段名称（可选，若为整行校验失败则为空）
         */
        private String fieldName;
    }
}