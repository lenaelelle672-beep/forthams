package com.ams.dto.auditdashboard;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Standardized error response DTO for Audit Dashboard API endpoints.
 *
 * <p>Used by {@code DashboardExceptionHandler} to return consistent error
 * structures across all dashboard aggregation APIs. The JSON shape matches
 * the ATB-004 contract: {@code {"error": "CODE", "message": "..."}}.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DashboardError {

    /** Machine-readable error code, e.g. "INVALID_DATE_RANGE". */
    private String error;

    /** Human-readable error description. */
    private String message;

    /** ISO-8601 timestamp of when the error occurred. */
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    /** Optional additional details (e.g. field-level validation errors). */
    private Object details;

    // ------------------------------------------------------------------
    // Convenience constructors matching DashboardExceptionHandler usage
    // ------------------------------------------------------------------

    /**
     * Creates an error with code and message (no timestamp / details).
     * Used by: {@code new DashboardError("INVALID_DATE_RANGE", e.getMessage())}
     */
    public DashboardError(String error, String message) {
        this.error = error;
        this.message = message;
        this.timestamp = LocalDateTime.now();
    }

    // ------------------------------------------------------------------
    // Static factory methods
    // ------------------------------------------------------------------

    /**
     * Creates a simple error response.
     *
     * @param error   machine-readable error code
     * @param message human-readable description
     * @return a new DashboardError instance
     */
    public static DashboardError of(String error, String message) {
        return DashboardError.builder()
                .error(error)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Creates an error response with additional details.
     *
     * @param error   machine-readable error code
     * @param message human-readable description
     * @param details extra context (validation map, original cause, etc.)
     * @return a new DashboardError instance
     */
    public static DashboardError of(String error, String message, Object details) {
        return DashboardError.builder()
                .error(error)
                .message(message)
                .timestamp(LocalDateTime.now())
                .details(details)
                .build();
    }

    // ------------------------------------------------------------------
    // Domain-specific factory methods aligned with ATB error codes
    // ------------------------------------------------------------------

    /**
     * INVALID_DATE_RANGE — startDate must be before endDate.
     */
    public static DashboardError invalidDateRange(String message) {
        return of("INVALID_DATE_RANGE", message);
    }

    /**
     * DATE_RANGE_TOO_LARGE — range exceeds 365 days.
     */
    public static DashboardError dateRangeTooLarge(String message) {
        return of("DATE_RANGE_TOO_LARGE", message);
    }

    /**
     * INVALID_GRANULARITY — granularity not in [daily, weekly, monthly].
     */
    public static DashboardError invalidGranularity(String message) {
        return of("INVALID_GRANULARITY", message);
    }

    /**
     * BAD_REQUEST — generic client error with optional details.
     */
    public static DashboardError badRequest(String message, Object details) {
        return of("BAD_REQUEST", message, details);
    }

    /**
     * VALIDATION_FAILED — one or more parameters failed validation.
     */
    public static DashboardError validationFailed(java.util.Map<String, String> fieldErrors) {
        return of("VALIDATION_FAILED", "One or more parameters failed validation", fieldErrors);
    }

    /**
     * INTERNAL_SERVER_ERROR — unexpected server-side failure.
     */
    public static DashboardError internalServerError() {
        return of("INTERNAL_SERVER_ERROR",
                "An unexpected error occurred while processing the dashboard request");
    }
}