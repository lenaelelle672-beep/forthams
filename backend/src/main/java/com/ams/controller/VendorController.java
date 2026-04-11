package com.ams.controller;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.Result;
import com.ams.entity.Vendor;
import com.ams.service.VendorService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/vendors")
@RequiredArgsConstructor
public class VendorController {

    private final VendorService vendorService;

    @GetMapping("/{id}")
    public Result<Vendor> getVendorById(@PathVariable Long id) {
        return Result.success(vendorService.getVendorById(id));
    }

    @PostMapping
    public Result<Vendor> createVendor(@RequestBody Vendor vendor) {
        return Result.success(vendorService.createVendor(vendor));
    }

    @PutMapping("/{id}")
    public Result<Vendor> updateVendor(@PathVariable Long id, @RequestBody Vendor updatedVendor) {
        return Result.success(vendorService.updateVendor(id, updatedVendor));
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteVendor(@PathVariable Long id) {
        vendorService.deleteVendor(id);
        return Result.success();
    }
}
