package com.ams.dto;

import lombok.Data;

@Data
public class PurchaseOrderQueryDTO {

    private String keyword;
    private String orderNo;
    private String status;
    private Long vendorId;
    private String startDate;
    private String endDate;

    private Integer page = 1;
    private Integer pageSize = 10;
}
