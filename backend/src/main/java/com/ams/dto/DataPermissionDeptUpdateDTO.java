package com.ams.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class DataPermissionDeptUpdateDTO {
    @NotNull
    private List<Long> deptIds = new ArrayList<>();
}
