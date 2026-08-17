package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.DeptCreateDTO;
import com.ams.dto.DeptUpdateDTO;
import com.ams.entity.Dept;
import com.ams.service.DeptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import jakarta.validation.constraints.Positive;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/depts")
@RequiredArgsConstructor
@Validated
public class DeptController {
    private final DeptService deptService;

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('dept:query')")
    public Result<List<Map<String, Object>>> list(@RequestParam(required = false) String keyword) {
        return Result.success(deptService.queryDepts(keyword));
    }

    @GetMapping("/tree")
    @PreAuthorize("hasAuthority('dept:query')")
    public Result<List<Dept>> tree() {
        return Result.success(deptService.listAllDepts());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('dept:query')")
    public Result<Dept> getById(@PathVariable @Positive Long id) {
        return Result.success(deptService.getDeptById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('dept:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<Dept> create(@Valid @RequestBody DeptCreateDTO dto) {
        return Result.success(deptService.createDept(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('dept:update')")
    public Result<Dept> update(@PathVariable @Positive Long id, @Valid @RequestBody DeptUpdateDTO dto) {
        return Result.success(deptService.updateDept(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('dept:delete')")
    public Result<Void> delete(@PathVariable @Positive Long id) {
        deptService.deleteDept(id);
        return Result.success();
    }

    @GetMapping("/all")
    @PreAuthorize("hasAuthority('dept:query')")
    public Result<?> all() {
        return list(null);
    }
}
