package com.ams.dto;

import java.util.List;

/**
 * DTO for the result of a batch asset import operation.
 * <p>
 * Provides a summary of the import, including the number of rows processed,
 * successfully created assets, and detailed error information for any failures.
 * </p>
 */
public class AssetImportResultDTO {

    /** Total number of rows processed in the import request. */
    private int totalRows;

    /** Number of rows successfully created as assets. */
    private int successfulRows;

    /** Number of rows that failed validation or processing. */
    private int failedRows;

    /** List of detailed error reports for rows that failed validation. */
    private List<ErrorDetailDTO> errors;

    /**
     * Constructs a new import result with the given summary and errors.
     *
     * @param totalRows      total rows processed
     * @param successfulRows rows successfully imported
     * @param failedRows     rows that failed
     * @param errors         detailed error information
     */
    public AssetImportResultDTO(int totalRows, int successfulRows, int failedRows, List<ErrorDetailDTO> errors) {
        this.totalRows = totalRows;
        this.successfulRows = successfulRows;
        this.failedRows = failedRows;
        this.errors = errors;
    }

    /** Default constructor for deserialization frameworks. */
    public AssetImportResultDTO() {}

    public int getTotalRows() {
        return totalRows;
    }

    public void setTotalRows(int totalRows) {
        this.totalRows = totalRows;
    }

    public int getSuccessfulRows() {
        return successfulRows;
    }

    public void setSuccessfulRows(int successfulRows) {
        this.successfulRows = successfulRows;
    }

    public int getFailedRows() {
        return failedRows;
    }

    public void setFailedRows(int failedRows) {
        this.failedRows = failedRows;
    }

    public List<ErrorDetailDTO> getErrors() {
        return errors;
    }

    public void setErrors(List<ErrorDetailDTO> errors) {
        this.errors = errors;
    }

    /**
     * DTO for a single validation error detail.
     */
    public static class ErrorDetailDTO {
        /** 1-based line number in the source file where the error occurred. */
        private int lineNumber;

        /** Field name within the row that caused the error. */
        private String field;

        /** Human-readable description of the validation failure. */
        private String message;

        public ErrorDetailDTO() {}

        public ErrorDetailDTO(int lineNumber, String field, String message) {
            this.lineNumber = lineNumber;
            this.field = field;
            this.message = message;
        }

        public int getLineNumber() {
            return lineNumber;
        }

        public void setLineNumber(int lineNumber) {
            this.lineNumber = lineNumber;
        }

        public String getField() {
            return field;
        }

        public void setField(String field) {
            this.field = field;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }
}