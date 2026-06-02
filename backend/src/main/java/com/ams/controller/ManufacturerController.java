package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Manufacturer;
import com.ams.service.ManufacturerService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/manufacturers")
@RequiredArgsConstructor
public class ManufacturerController {

    private final ManufacturerService manufacturerService;

    @PreAuthorize("@ss.hasPermi('manufacturer:query')")
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        Page<Manufacturer> result = manufacturerService.getPage(page, pageSize, keyword, status);
        return Result.success(Map.of("records", result.getRecords(), "total", result.getTotal()));
    }

    @PreAuthorize("@ss.hasPermi('manufacturer:query')")
    @GetMapping("/options")
    public Result<List<Manufacturer>> options() {
        return Result.success(manufacturerService.getOptions());
    }

    @PreAuthorize("@ss.hasPermi('manufacturer:query')")
    @GetMapping("/{id}")
    public Result<Manufacturer> detail(@PathVariable Long id) {
        return Result.success(manufacturerService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('manufacturer:create')")
    @PostMapping
    public Result<Manufacturer> create(@RequestBody Manufacturer m) {
        return Result.success(manufacturerService.create(m));
    }

    @PreAuthorize("@ss.hasPermi('manufacturer:edit')")
    @PutMapping("/{id}")
    public Result<Manufacturer> update(@PathVariable Long id, @RequestBody Manufacturer m) {
        return Result.success(manufacturerService.update(id, m));
    }

    @PreAuthorize("@ss.hasPermi('manufacturer:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        manufacturerService.delete(id);
        return Result.success();
    }
}
