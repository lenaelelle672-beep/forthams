package com.ams.controller;

import com.ams.common.Result;
import com.ams.service.TestResultsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/test-results")
@RequiredArgsConstructor
public class TestResultsController {

    private final TestResultsService testResultsService;

    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping
    public Result<Map<String, Object>> getTestResults() {
        return Result.success(testResultsService.getTestResults());
    }
}
