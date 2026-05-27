package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.VendorCreateDTO;
import com.ams.dto.VendorUpdateDTO;
import com.ams.entity.Vendor;
import com.ams.service.VendorService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/vendors")
@RequiredArgsConstructor
public class VendorController {
    private final VendorService vendorService;

    @PreAuthorize("@ss.hasPermi('vendor:vendor:query')")
    @GetMapping({"", "/list"})
    public Result<Page<Vendor>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(vendorService.listPage(page, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('vendor:vendor:query')")
    @GetMapping("/{id}")
    public Result<Vendor> getById(@PathVariable Long id) {
        return Result.success(vendorService.getVendorById(id));
    }

    @PreAuthorize("@ss.hasPermi('vendor:vendor:add')")
    @PostMapping
    public Result<Vendor> create(@Valid @RequestBody VendorCreateDTO dto) {
        return Result.success(vendorService.createVendor(dto));
    }

    @PreAuthorize("@ss.hasPermi('vendor:vendor:edit')")
    @PutMapping("/{id}")
    public Result<Vendor> update(@PathVariable Long id, @Valid @RequestBody VendorUpdateDTO dto) {
        return Result.success(vendorService.updateVendor(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('vendor:vendor:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        vendorService.deleteVendor(id);
        return Result.success();
    }
}
