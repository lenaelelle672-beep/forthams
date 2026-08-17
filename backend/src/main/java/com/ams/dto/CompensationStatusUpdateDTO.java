package com.ams.dto;

import com.ams.enums.CompensationStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CompensationStatusUpdateDTO {

    @NotNull(message = "赔偿状态不能为空")
    private CompensationStatus status;
}
