package com.assetmanage.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * RowError DTO 用于承载 Excel 导入过程中单行数据的校验错误信息。
 * 根据 SPEC 要求，在批量导入时需记录每一行失败的具体原因并返回给前端。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RowError {

    /**
     * 出错的行号（从 1 开始计数，通常包含表头）。
     * 对应 ATB-003 中对 Row 2、Row 5、Row 8 的精确定位需求。
     */
    private Integer rowNumber;

    /**
     * 错误字段名称或列名（如：资产编号、资产名称、分类、状态）。
     * 便于前端高亮定位具体列。
     */
    private String fieldName;

    /**
     * 具体错误原因描述（如："必填字段为空"、"日期格式越界"、"状态枚举不存在"）。
     * 对应 ATB-003 中对精确错误原因描述的要求。
     */
    private String errorMessage;

    /**
     * 该行原始数据快照（可选，便于前端展示以便用户修改）。
     * 序列化为简短的可读字符串形式。
     */
    private String rowDataSnapshot;
}