package com.ams.controller;

import com.ams.common.Result;
import com.ams.service.DepreciationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/depreciation")
@RequiredArgsConstructor
public class DepreciationController {

    private final DepreciationService depreciationService;

    @GetMapping("/schedules")
    public Result<DepreciationService.DepreciationSchedulePage> schedules(
            @RequestParam(required = false) String assetNo,
            @RequestParam(required = false) String period,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return Result.success(depreciationService.getSchedules(assetNo, period, page, size));
    }

    @PostMapping("/calculate")
    public Result<DepreciationService.BatchCalculateResponse> calculate(@RequestBody BatchCalculateRequest request) {
        return Result.success(depreciationService.calculate(request.assetIds()));
    }

    public record BatchCalculateRequest(List<Long> assetIds) {
    }
}
