package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.EnergyConsumption;
import com.ams.entity.EnergyMeter;
import com.ams.service.EnergyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/energy")
@RequiredArgsConstructor
public class EnergyController {

    private final EnergyService energyService;

    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/meters")
    public Result<List<EnergyMeter>> getMeters(
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String meterType,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : null;
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : null;
        return Result.success(energyService.getReadings(assetId, meterType, start, end));
    }

    @PreAuthorize("@ss.hasPermi('asset:create')")
    @PostMapping("/meters")
    public Result<EnergyMeter> addMeter(@RequestBody EnergyMeter meter) {
        return Result.success(energyService.addReading(meter));
    }

    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/consumption")
    public Result<List<EnergyConsumption>> getConsumption(
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String meterType,
            @RequestParam(required = false) String periodType,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : null;
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : null;
        return Result.success(energyService.getConsumptionSummary(assetId, meterType, periodType, start, end));
    }

    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/dashboard")
    public Result<Map<String, Object>> dashboard() {
        return Result.success(energyService.getDashboardData());
    }

    @PreAuthorize("@ss.hasPermi('asset:edit')")
    @PostMapping("/calculate-monthly")
    public Result<EnergyConsumption> calculateMonthly(
            @RequestParam Long assetId,
            @RequestParam String meterType,
            @RequestParam int year,
            @RequestParam int month) {
        EnergyConsumption result = energyService.calculateMonthlyConsumption(assetId, meterType, year, month);
        if (result == null) {
            return Result.error("该月份没有读数记录");
        }
        return Result.success(result);
    }
}
