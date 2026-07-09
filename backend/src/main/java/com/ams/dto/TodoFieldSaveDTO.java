package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class TodoFieldSaveDTO {
    private List<TodoFieldConfigDTO> fields = new ArrayList<>();
    private Long operatorId;
    private Boolean confirmed;
    private String reason;
    private String auditEvidence;
}
