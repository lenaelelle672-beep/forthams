package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Vendor;
import com.ams.service.VendorService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/vendors")
@RequiredArgsConstructor
public class VendorController {
    private final VendorService vendorService;

    @GetMapping("/list")
    public Result<List<Vendor>> list() {
        return Result.success(vendorService.list());
    }

    @GetMapping("/{id}")
    public Result<Vendor> getById(@PathVariable Long id) {
        return Result.success(vendorService.getVendorById(id));
    }

    @PostMapping
    public Result<Vendor> create(@RequestBody Vendor vendor) {
        // 防止 mass assignment：清除客户端不应设置的字段
        vendor.setId(null);
        vendor.setDeleted(0);
        vendor.setCreateTime(null);
        vendor.setUpdateTime(null);
        return Result.success(vendorService.createVendor(vendor));
    }

    @PutMapping("/{id}")
    public Result<Vendor> update(@PathVariable Long id, @RequestBody Vendor vendor) {
        // 防止 mass assignment：清除客户端不应设置的字段，强制使用路径 id
        vendor.setId(id);
        vendor.setDeleted(0);
        vendor.setCreateTime(null);
        vendor.setUpdateTime(null);
        return Result.success(vendorService.updateVendor(id, vendor));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        vendorService.deleteVendor(id);
        return Result.success();
    }
}
