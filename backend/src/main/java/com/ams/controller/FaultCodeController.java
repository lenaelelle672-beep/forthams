package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.FaultCode;
import com.ams.service.FaultCodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/fault-codes")
@RequiredArgsConstructor
public class FaultCodeController {

    private final FaultCodeService faultCodeService;

    @PreAuthorize("@ss.hasPermi('fault-code:query')")
    @GetMapping("/tree")
    public Result<List<FaultCode>> getTree() {
        return Result.success(faultCodeService.getTree());
    }

    @PreAuthorize("@ss.hasPermi('fault-code:query')")
    @GetMapping("/level/{level}")
    public Result<List<FaultCode>> getByLevel(@PathVariable Integer level) {
        return Result.success(faultCodeService.getByLevel(level));
    }

    @PreAuthorize("@ss.hasPermi('fault-code:query')")
    @GetMapping("/{id}/children")
    public Result<List<FaultCode>> getChildren(@PathVariable Long id) {
        return Result.success(faultCodeService.getChildren(id));
    }

    @PreAuthorize("@ss.hasPermi('fault-code:query')")
    @GetMapping("/{id}")
    public Result<FaultCode> getById(@PathVariable Long id) {
        return Result.success(faultCodeService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('fault-code:create')")
    @PostMapping
    public Result<FaultCode> create(@RequestBody FaultCode faultCode) {
        return Result.success(faultCodeService.create(faultCode));
    }

    @PreAuthorize("@ss.hasPermi('fault-code:edit')")
    @PutMapping("/{id}")
    public Result<FaultCode> update(@PathVariable Long id, @RequestBody FaultCode faultCode) {
        return Result.success(faultCodeService.update(id, faultCode));
    }

    @PreAuthorize("@ss.hasPermi('fault-code:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        faultCodeService.delete(id);
        return Result.success();
    }
}
