package com.ams.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@DisplayName("Controller API Prefix Mapping Tests")
class ControllerApiPrefixMappingTest {

    @Test
    @DisplayName("Should not duplicate global /api context path in controller mappings")
    void shouldNotDuplicateGlobalApiContextPath() {
        Map<Class<?>, String> expectedMappings = Map.of(
            ABCClassificationController.class, "/abc",
            BarcodeController.class, "/barcodes",
            StocktakingCycleController.class, "/stocktaking/cycles",
            StocktakingTaskController.class, "/stocktaking/tasks",
            TestResultsController.class, "/test-results");

        expectedMappings.forEach((controllerClass, expected) -> {
            RequestMapping requestMapping = controllerClass.getAnnotation(RequestMapping.class);
            assertNotNull(requestMapping, controllerClass.getSimpleName() + " should declare @RequestMapping");
            assertEquals(expected, requestMapping.value()[0]);
            assertFalse(requestMapping.value()[0].startsWith("/api/"),
                    controllerClass.getSimpleName() + " should rely on server.servlet.context-path=/api");
        });
    }
}
