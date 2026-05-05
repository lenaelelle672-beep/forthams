package com.assetmanage.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 资产导出查询参数传输对象 (AssetExportQueryDTO).
 * <p>
 * 承载前端传递的多维筛选条件，用于资产台账按分类、状态、位置等条件检索后流式导出 Excel。
 * 所有字段均为可选，不传则表示不施加对应维度的过滤。
 */
@Data
public class ExportQueryDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 资产编号（支持精确或前缀匹配）
     */
    private String assetCode;

    /**
     * 资产名称关键字（模糊查询）
     */
    private String assetName;

    /**
     * 资产分类 ID（关联 AssetCategory 表）
     */
    private Long categoryId;

    /**
     * 资产状态编码（如 IN_USE、IDLE、MAINTENANCE、SCRAP 等）
     */
    private String status;

    /**
     * 存放位置 ID（关联 Location 表）
     */
    private Long locationId;

    /**
     * 使用部门 ID（关联 Dept 表）
     */
    private Long departmentId;

    /**
     * 供应商 ID（关联 Vendor 表）
     */
    private Long vendorId;

    /**
     * 资产负责人姓名（模糊查询）
     */
    private String ownerName;

    /**
     * 采购起始日期，格式 yyyy-MM-dd
     */
    private String startDate;

    /**
     * 采购截止日期，格式 yyyy-MM-dd
     */
    private String endDate;
}