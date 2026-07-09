package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class FormStorageSaveDTO {
    private String formKey;
    private Integer definitionVersion;
    private String businessKey;
    private Long operatorId;
    private List<FormStorageFieldValueDTO> fieldValues = new ArrayList<>();
    private List<FormStorageAttachmentDTO> attachments = new ArrayList<>();
}
