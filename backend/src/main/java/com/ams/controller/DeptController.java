package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.DeptCreateDTO;
import com.ams.dto.DeptUpdateDTO;
import com.ams.entity.Dept;
import com.ams.service.DeptService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/depts")
public class DeptController {

    private final DeptService deptService;

    public DeptController(DeptService deptService) {
        this.deptService = deptService;
    }

    @Auditable
    @GetMapping("/tree")
    public Result<List<Map<String, Object>>> tree(@RequestParam(required = false) String keyword) {
        return Result.success(deptService.queryDepts(keyword));
    }

    @Auditable
    @GetMapping("/all")
    public Result<List<Dept>> all() {
        return Result.success(deptService.listAllDepts());
    }

    @Auditable
    @Auditable
    @GetMapping("/{id}")
    public Result<Dept> getById(@PathVariable Long id) {
        return Result.success(deptService.getDeptById(id));
    }

    @Auditable
    @Auditable
    @PostMapping
    public Result<Dept> create(@Valid @RequestBody DeptCreateDTO dto) {
        return Result.success("创建成功", deptService.createDept(dto));
    }

    @Auditable
    @Auditable
    @PutMapping("/{id}")
    public Result<Dept> update(@PathVariable Long id, @Valid @RequestBody DeptUpdateDTO dto) {
        return Result.success("更新成功", deptService.updateDept(id, dto));
    }

    @Auditable
    @Auditable
    @DeleteMapping("/{id}")
    public Result<String> delete(@PathVariable Long id) {
        deptService.deleteDept(id);
        return Result.success("删除成功");
    }
}
