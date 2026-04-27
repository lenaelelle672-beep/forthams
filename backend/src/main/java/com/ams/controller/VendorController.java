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
        return Result.success(java.util.Collections.emptyList());
    }

    @GetMapping("/{id}")
    public Result<Vendor> getById(@PathVariable Long id) {
        return Result.success(vendorService.getVendorById(id));
    }
}
