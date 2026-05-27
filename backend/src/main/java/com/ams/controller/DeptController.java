package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.DeptCreateDTO;
import com.ams.dto.DeptUpdateDTO;
import com.ams.entity.Dept;
import com.ams.service.DeptService;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/depts")
@RequiredArgsConstructor
public class DeptController {
    private final DeptService deptService;

    @PreAuthorize("@ss.hasPermi('system:dept:query')")
    @GetMapping("/list")
    public Result<List<Map<String, Object>>> list(@RequestParam(required = false) String keyword) {
        return Result.success(deptService.queryDepts(keyword));
    }

    @PreAuthorize("@ss.hasPermi('system:dept:query')")
    @GetMapping("/tree")
    public Result<List<Dept>> tree() {
        return Result.success(deptService.listAllDepts());
    }

    @PreAuthorize("@ss.hasPermi('system:dept:query')")
    @GetMapping("/{id}")
    public Result<Dept> getById(@PathVariable Long id) {
        return Result.success(deptService.getDeptById(id));
    }

    @PreAuthorize("@ss.hasPermi('system:dept:add')")
    @PostMapping
    public Result<Dept> create(@Valid @RequestBody DeptCreateDTO dto) {
        return Result.success(deptService.createDept(dto));
    }

    @PreAuthorize("@ss.hasPermi('system:dept:edit')")
    @PutMapping("/{id}")
    public Result<Dept> update(@PathVariable Long id, @Valid @RequestBody DeptUpdateDTO dto) {
        return Result.success(deptService.updateDept(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('system:dept:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        deptService.deleteDept(id);
        return Result.success();
    }
}
