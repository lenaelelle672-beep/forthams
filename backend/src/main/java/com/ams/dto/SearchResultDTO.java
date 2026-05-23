package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 全局搜索结果统一 DTO。
 *
 * <p>由 SearchService 跨实体查询后返回统一格式的结果，
 * 前端根据 type 字段展示对应图标并导航到详情页。
 *
 * <p>type 枚举值：asset, workorder, vendor
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchResultDTO {

    /** 业务记录 ID */
    @JsonProperty("id")
    private Long id;

    /** 结果类型：asset / workorder / vendor */
    @JsonProperty("type")
    private String type;

    /** 结果标题（如资产名称、工单标题、供应商名称） */
    @JsonProperty("title")
    private String title;

    /** 结果副标题（如资产编号、工单号、供应商编码） */
    @JsonProperty("subtitle")
    private String subtitle;

    /** 前端路由路径（如 /assets/42） */
    @JsonProperty("path")
    private String path;
}
