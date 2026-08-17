package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.time.LocalDate;

@Data
public class InventoryTaskCreateDTO {
    @JsonAlias({"name", "taskName"})
    @NotBlank(message = "盘点任务名称不能为空")
    @Size(max = 256, message = "盘点任务名称不能超过256个字符")
    private String taskName;
    @JsonAlias({"method", "taskType", "type", "inventoryType"})
    @NotBlank(message = "盘点类型不能为空")
    @Pattern(regexp = "(?i)FULL|PARTIAL|CYCLE", message = "盘点类型必须为FULL、PARTIAL或CYCLE")
    private String inventoryType;
    @JsonAlias({"department", "deptIds"})
    @Size(max = 2048, message = "盘点部门范围过长")
    @Pattern(regexp = "\\s*|[1-9]\\d*(\\s*,\\s*[1-9]\\d*)*", message = "盘点部门范围必须是逗号分隔的正整数ID")
    private String deptIds;
    @JsonAlias({"location"})
    @Size(max = 256, message = "盘点地点不能超过256个字符")
    private String location;
    @JsonAlias({"responsible", "executorId"})
    @Positive(message = "执行人ID必须为正整数")
    private Long executorId;
    @JsonAlias({"scope"})
    @Size(max = 512, message = "盘点范围描述不能超过512个字符")
    private String scope;
    @JsonAlias({"description"})
    @Size(max = 512, message = "盘点说明不能超过512个字符")
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    @PositiveOrZero(message = "盘点总数不能为负数")
    private Integer totalCount;

    @AssertTrue(message = "盘点结束日期不能早于开始日期")
    public boolean isDateRangeValid() {
        return startDate == null || endDate == null || !endDate.isBefore(startDate);
    }
}
