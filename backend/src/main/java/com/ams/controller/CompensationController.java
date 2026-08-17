package com.ams.controller;

import com.ams.dto.CompensationCreateDTO;
import com.ams.dto.CompensationStatusUpdateDTO;
import com.ams.dto.CompensationUpdateDTO;
import com.ams.dto.CompensationValuationDTO;
import com.ams.dto.CompensationValuationRequestDTO;
import com.ams.entity.AssetCompensation;
import com.ams.service.CompensationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping({"/compensation", "/compensations"})
@RequiredArgsConstructor
@Validated
public class CompensationController {

    private final CompensationService compensationService;

    @GetMapping({"", "/list"})
    @PreAuthorize("hasAuthority('compensation:query')")
    public Result<Page<AssetCompensation>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(compensationService.queryCompensations(page, pageSize, null, null));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('compensation:query')")
    public Result<AssetCompensation> getById(@PathVariable @Positive Long id) {
        return Result.success(compensationService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('compensation:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<AssetCompensation> create(@Valid @RequestBody CompensationCreateDTO dto) {
        return Result.success(compensationService.createCompensation(dto));
    }

    @PostMapping("/valuation")
    @PreAuthorize("hasAuthority('compensation:query')")
    public Result<CompensationValuationDTO> valuation(@Valid @RequestBody CompensationValuationRequestDTO dto) {
        CompensationCreateDTO valuationRequest = new CompensationCreateDTO();
        valuationRequest.setAssetId(dto.getAssetId());
        valuationRequest.setCompensationType(dto.getCompensationType());
        return Result.success(compensationService.estimateCompensation(valuationRequest));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('compensation:update')")
    public Result<AssetCompensation> update(@PathVariable @Positive Long id, @Valid @RequestBody CompensationUpdateDTO dto) {
        return Result.success(compensationService.updateCompensation(id, dto));
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAuthority('compensation:approve')")
    public Result<AssetCompensation> updateStatus(@PathVariable @Positive Long id,
                                                    @Valid @RequestBody CompensationStatusUpdateDTO dto) {
        throw new AccessDeniedException("赔偿终态必须通过受控审批流程处理");
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('compensation:delete')")
    public Result<Void> delete(@PathVariable @Positive Long id) {
        compensationService.deleteCompensation(id);
        return Result.success();
    }
}
