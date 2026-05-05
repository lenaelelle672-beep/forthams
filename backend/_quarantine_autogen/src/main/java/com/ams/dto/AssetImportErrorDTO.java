package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for representing a single validation error during asset import.
 * Provides structured error information including row number and field-level details.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class AssetImportErrorDTO {

    /**
     * 1-based row index in the uploaded file where the error occurred.
     */
    private int row;

    /**
     * Field name within the asset record that failed validation.
     */
    private String field;

    /**
     * Human-readable description of the validation failure.
     */
    private String message;

    /**
     * Optional error code for machine-readable error categorization.
     */
    private String errorCode;
}