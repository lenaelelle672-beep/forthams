package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.LicenseAssignment;
import com.ams.entity.SoftwareLicense;
import com.ams.service.SoftwareLicenseService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/licenses")
@RequiredArgsConstructor
public class SoftwareLicenseController {

    private final SoftwareLicenseService licenseService;

    @PreAuthorize("@ss.hasPermi('license:query')")
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        Page<SoftwareLicense> result = licenseService.getPage(page, pageSize, keyword, status);
        return Result.success(Map.of("records", result.getRecords(), "total", result.getTotal()));
    }

    @PreAuthorize("@ss.hasPermi('license:query')")
    @GetMapping("/expiring")
    public Result<List<SoftwareLicense>> expiring(@RequestParam(defaultValue = "30") Integer days) {
        return Result.success(licenseService.getExpiring(days));
    }

    @PreAuthorize("@ss.hasPermi('license:query')")
    @GetMapping("/summary")
    public Result<Map<String, Object>> summary() {
        return Result.success(licenseService.getSummary());
    }

    @PreAuthorize("@ss.hasPermi('license:query')")
    @GetMapping("/{id}")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        SoftwareLicense l = licenseService.getById(id);
        int usedSeats = licenseService.getUsedSeats(id);
        List<LicenseAssignment> assignments = licenseService.getActiveAssignments(id);
        return Result.success(Map.of("license", l, "usedSeats", usedSeats, "assignments", assignments));
    }

    @PreAuthorize("@ss.hasPermi('license:query')")
    @GetMapping("/{id}/assignments")
    public Result<List<LicenseAssignment>> assignments(@PathVariable Long id) {
        return Result.success(licenseService.getActiveAssignments(id));
    }

    @PreAuthorize("@ss.hasPermi('license:create')")
    @PostMapping
    public Result<SoftwareLicense> create(@RequestBody SoftwareLicense l) {
        return Result.success(licenseService.create(l));
    }

    @PreAuthorize("@ss.hasPermi('license:edit')")
    @PutMapping("/{id}")
    public Result<SoftwareLicense> update(@PathVariable Long id, @RequestBody SoftwareLicense l) {
        return Result.success(licenseService.update(id, l));
    }

    @PreAuthorize("@ss.hasPermi('license:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        licenseService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('license:assign')")
    @PostMapping("/{id}/assign")
    public Result<LicenseAssignment> assign(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long assetId = body.get("assetId") != null ? Long.valueOf(body.get("assetId").toString()) : null;
        Long userId = body.get("userId") != null ? Long.valueOf(body.get("userId").toString()) : null;
        String notes = (String) body.get("notes");
        return Result.success(licenseService.assign(id, assetId, userId, notes));
    }

    @PreAuthorize("@ss.hasPermi('license:assign')")
    @PostMapping("/{id}/return")
    public Result<Void> returnLicense(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long assignmentId = Long.valueOf(body.get("assignmentId").toString());
        String notes = (String) body.get("notes");
        licenseService.returnLicense(assignmentId, notes);
        return Result.success();
    }
}
