package com.ams.dto;

import lombok.Data;

/**
 * 入库验收查询 DTO — 分页+过滤参数。
 */
@Data
public class IntakeOrderQueryDTO {
    private String keyword;
    private String orderNo;
    private String status;
    private Long vendorId;
    private String startDate;
    private String endDate;
    private Integer page = 1;
    private Integer pageSize = 10;
}
