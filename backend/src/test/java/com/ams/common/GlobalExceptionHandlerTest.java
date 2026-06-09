package com.ams.common;

import com.ams.common.exception.BusinessException;
import com.ams.common.exception.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.MessageSource;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;

import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        MessageSource messageSource = mock(MessageSource.class);
        when(messageSource.getMessage(anyString(), any(), any(Locale.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        handler = new GlobalExceptionHandler(messageSource);
    }

    @Test
    void shouldMapBusinessExceptionWithoutChangingResponseContract() {
        Result<Void> result = handler.handleBusinessException(new BusinessException(400, "业务规则不满足"));

        assertEquals(400, result.getCode());
        assertEquals("业务规则不满足", result.getMessage());
    }

    @Test
    void shouldMapConflictExceptionTo409() {
        Result<Void> result = handler.handleConflictException(new ConflictException("用户名已存在"));

        assertEquals(409, result.getCode());
        assertEquals("用户名已存在", result.getMessage());
    }

    @Test
    void shouldMapBindExceptionToValidationMessage() {
        BindException exception = new BindException(new Object(), "form");
        exception.addError(new FieldError("form", "name", "名称不能为空"));
        exception.addError(new FieldError("form", "code", "编码不能为空"));

        Result<Void> result = handler.handleBindException(exception);

        assertEquals(400, result.getCode());
        assertEquals("名称不能为空, 编码不能为空", result.getMessage());
    }

    @Test
    void shouldKeepUnexpectedExceptionAsSystemError() {
        Result<Void> result = handler.handleException(new IllegalStateException("boom"));

        assertEquals(500, result.getCode());
        assertEquals("exception.system.error", result.getMessage());
    }
}
