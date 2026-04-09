package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;

@Data
public class InventoryTaskCreateDTO {

    @NotBlank(message = "盘点任务名称不能为空")
    private String taskName;

    @NotBlank(message = "盘点类型不能为空")
    private String inventoryType;

    private String deptIds;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer totalCount;
    private Long executorId;
}
