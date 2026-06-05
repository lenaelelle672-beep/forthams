package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.IntakeOrderCreateDTO;
import com.ams.dto.IntakeOrderQueryDTO;
import com.ams.dto.IntakeOrderUpdateDTO;
import com.ams.entity.IntakeCheckItem;
import com.ams.entity.IntakeOrder;
import com.ams.service.IntakeOrderService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 入库验收 REST 控制器。
 */
@RestController
@RequestMapping("/intake-orders")
@RequiredArgsConstructor
public class IntakeOrderController {

    private final IntakeOrderService intakeOrderService;

    @PreAuthorize("@ss.hasPermi('asset:intake:query')")
    @GetMapping
    public Result<Page<IntakeOrder>> list(IntakeOrderQueryDTO queryDTO) {
        return Result.success(intakeOrderService.queryPage(queryDTO));
    }

    @PreAuthorize("@ss.hasPermi('asset:intake:query')")
    @GetMapping("/{id}")
    public Result<IntakeOrder> getById(@PathVariable Long id) {
        return Result.success(intakeOrderService.getDetail(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:intake:create')")
    @PostMapping
    public Result<IntakeOrder> create(@Valid @RequestBody IntakeOrderCreateDTO dto) {
        return Result.success(intakeOrderService.create(dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:intake:edit')")
    @PutMapping("/{id}")
    public Result<IntakeOrder> update(@PathVariable Long id, @Valid @RequestBody IntakeOrderUpdateDTO dto) {
        return Result.success(intakeOrderService.update(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:intake:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        intakeOrderService.delete(id);
        return Result.success();
    }

    // ── 验收流程操作 ─────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('asset:intake:edit')")
    @PostMapping("/{id}/submit")
    public Result<IntakeOrder> submit(@PathVariable Long id) {
        return Result.success(intakeOrderService.submit(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:intake:edit')")
    @PostMapping("/{id}/inspect")
    public Result<IntakeOrder> inspect(@PathVariable Long id, @RequestBody List<IntakeCheckItem> checkItems) {
        return Result.success(intakeOrderService.inspect(id, checkItems));
    }

    @PreAuthorize("@ss.hasPermi('asset:intake:edit')")
    @PostMapping("/{id}/accept")
    public Result<IntakeOrder> accept(@PathVariable Long id) {
        return Result.success(intakeOrderService.accept(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:intake:edit')")
    @PostMapping("/{id}/partial-accept")
    public Result<IntakeOrder> partialAccept(@PathVariable Long id, @RequestBody List<Long> assetIds) {
        return Result.success(intakeOrderService.partialAccept(id, assetIds));
    }

    @PreAuthorize("@ss.hasPermi('asset:intake:edit')")
    @PostMapping("/{id}/reject")
    public Result<IntakeOrder> reject(@PathVariable Long id, @RequestParam(required = false) String reason) {
        return Result.success(intakeOrderService.reject(id, reason));
    }

    @PreAuthorize("@ss.hasPermi('asset:intake:edit')")
    @PostMapping("/{id}/cancel")
    public Result<IntakeOrder> cancel(@PathVariable Long id) {
        return Result.success(intakeOrderService.cancel(id));
    }
}
