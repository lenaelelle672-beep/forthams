package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 物料/备件使用记录实体。
 *
 * <p>记录维保施工过程中消耗的物料和备件，包括物料名称、规格、数量、单价、合计金额等。
 * 每条记录关联到维保执行主记录（MaintenanceExecution）。
 */
@Data
@TableName("maintenance_execution_material")
public class MaintenanceExecutionMaterial implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long executionId;
    private String materialName;
    private String specification;
    private BigDecimal quantity;
    private BigDecimal unitPrice;
    private BigDecimal totalPrice;
    private String sourceWarehouse;
    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
