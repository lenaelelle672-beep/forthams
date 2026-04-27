package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.DeptCreateDTO;
import com.ams.dto.DeptUpdateDTO;
import com.ams.entity.Dept;
import com.ams.service.DeptService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/depts")
@RequiredArgsConstructor
public class DeptController {
    private final DeptService deptService;

    @GetMapping("/list")
    public Result<List<Map<String, Object>>> list(@RequestParam(required = false) String keyword) {
        return Result.success(deptService.queryDepts(keyword));
    }

    @GetMapping("/tree")
    public Result<List<Dept>> tree() {
        return Result.success(deptService.listAllDepts());
    }

    @GetMapping("/{id}")
    public Result<Dept> getById(@PathVariable Long id) {
        return Result.success(deptService.getDeptById(id));
    }

    @PostMapping
    public Result<Dept> create(@RequestBody DeptCreateDTO dto) {
        return Result.success(deptService.createDept(dto));
    }

    @PutMapping("/{id}")
    public Result<Dept> update(@PathVariable Long id, @RequestBody DeptUpdateDTO dto) {
        return Result.success(deptService.updateDept(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        deptService.deleteDept(id);
        return Result.success();
    }
}
