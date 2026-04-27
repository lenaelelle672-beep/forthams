package com.ams.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Exception thrown when the requested date range is invalid or exceeds limits.
 * Specifically used for audit dashboard queries where:
 * 1. startDate > endDate
 * 2. Range exceeds maximum allowed duration (365 days)
 */
@Getter
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class InvalidDateRangeException extends RuntimeException {

    private final String errorCode;

    /**
     * Constructs an InvalidDateRangeException with default error code "INVALID_DATE_RANGE".
     *
     * @param message Error message describing the violation
     */
    public InvalidDateRangeException(String message) {
        super(message);
        this.errorCode = "INVALID_DATE_RANGE";
    }

    /**
     * Constructs an InvalidDateRangeException with a custom error code.
     *
     * @param message   Error message describing the violation
     * @param errorCode Custom error code for API response mapping (e.g. "DATE_RANGE_TOO_LARGE")
     */
    public InvalidDateRangeException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
    }

    @Override
    public String toString() {
        return String.format("InvalidDateRangeException[code=%s, message=%s]",
                errorCode, getMessage());
    }
}