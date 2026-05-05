package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 盘点明细实盘录入数据传输对象 (Inventory Detail Record DTO)
 *
 * <p>对应接口: {@code PUT /api/v1/inventories/{id}/details/{detailId}/record}</p>
 * <p>用于提交单条盘点明细的实盘数量、实盘状态及备注信息。</p>
 *
 * <p>规格参考: [SWARM-P3-010-BE] 资产盘点管理后端规格说明书 - ATB-2 盘点结果逐条录入测试</p>
 *
 * <ul>
 *   <li>调用后 {@code actual_status} 和 {@code actual_quantity} 更新为提交值</li>
 *   <li>明细行的 {@code is_counted} 标记更新为 {@code true}</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryDetailRecordDTO {

    /**
     * 实盘数量（物理清点数量）。
     * <p>规格要求默认值为 1。</p>
     */
    @NotNull(message = "实盘数量不能为空")
    @Min(value = 0, message = "实盘数量不能为负数")
    @Builder.Default
    private Integer actualQuantity = 1;

    /**
     * 实盘状态。
     * <p>对应资产主表的状态枚举值，如: IN_USE（使用中）、IDLE（闲置）、
     * DAMAGED（损坏）、LOST（丢失）等。</p>
     */
    @NotBlank(message = "实盘状态不能为空")
    private String actualStatus;

    /**
     * 操作人员备注 / 差异原因说明。
     * <p>可选字段，用于记录盘点时发现的特殊情况或差异说明。</p>
     */
    private String remarks;
}