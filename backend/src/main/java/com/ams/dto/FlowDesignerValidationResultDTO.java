package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class FlowDesignerValidationResultDTO {
    private boolean valid;
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
    private int nodeCount;
    private int edgeCount;
}
