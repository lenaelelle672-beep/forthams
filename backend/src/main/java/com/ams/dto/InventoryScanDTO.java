package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class InventoryScanDTO {

    private Long assetId;
    private String rfidTag;
    private String status;
    private String expectedLocation;
    private String actualLocation;
    private LocalDateTime scanTime;
    private String remark;
}
