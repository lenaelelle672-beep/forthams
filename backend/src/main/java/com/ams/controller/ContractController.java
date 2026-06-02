package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Contract;
import com.ams.service.ContractService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/contracts")
@RequiredArgsConstructor
public class ContractController {

    private final ContractService contractService;

    @PreAuthorize("@ss.hasPermi('contract:query')")
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String contractType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long vendorId) {
        Page<Contract> result = contractService.getPage(page, pageSize, keyword, contractType, status, vendorId);
        return Result.success(Map.of("records", result.getRecords(), "total", result.getTotal()));
    }

    @PreAuthorize("@ss.hasPermi('contract:query')")
    @GetMapping("/expiring")
    public Result<List<Contract>> expiring(@RequestParam(defaultValue = "30") Integer days) {
        return Result.success(contractService.getExpiring(days));
    }

    @PreAuthorize("@ss.hasPermi('contract:edit')")
    @PostMapping("/expiring/notify")
    public Result<Map<String, Object>> notifyExpiring(
            @RequestParam(defaultValue = "30") Integer days) {
        List<Contract> expiring = contractService.getExpiring(days);
        int notified = contractService.notifyExpiringContracts(expiring);
        return Result.success(Map.of("total", expiring.size(), "notified", notified));
    }

    @PreAuthorize("@ss.hasPermi('contract:query')")
    @GetMapping("/{id}")
    public Result<Contract> detail(@PathVariable Long id) {
        return Result.success(contractService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('contract:create')")
    @PostMapping
    public Result<Contract> create(@RequestBody Contract c) {
        return Result.success(contractService.create(c));
    }

    @PreAuthorize("@ss.hasPermi('contract:edit')")
    @PutMapping("/{id}")
    public Result<Contract> update(@PathVariable Long id, @RequestBody Contract c) {
        return Result.success(contractService.update(id, c));
    }

    @PreAuthorize("@ss.hasPermi('contract:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        contractService.delete(id);
        return Result.success();
    }
}
