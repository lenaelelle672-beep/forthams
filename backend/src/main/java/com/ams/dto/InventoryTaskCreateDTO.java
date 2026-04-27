package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.time.LocalDate;

@Data
public class InventoryTaskCreateDTO {
    @JsonAlias({"name", "taskName"})
    private String taskName;
    @JsonAlias({"method", "taskType", "type"})
    private String inventoryType;
    private String deptIds;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer totalCount;
    private Long executorId;
}
