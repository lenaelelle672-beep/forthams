package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;

@Data
@TableName("purchase_order_item")
public class PurchaseOrderItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long orderId;

    private String assetName;

    private Long categoryId;

    private Integer quantity;

    private BigDecimal unitPrice;

    private BigDecimal amount;

    private String specification;

    private String remark;

    @TableField(exist = false)
    private String categoryName;
}
