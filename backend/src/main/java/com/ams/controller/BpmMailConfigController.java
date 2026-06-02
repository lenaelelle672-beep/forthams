package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.BpmMailConfigCreateDTO;
import com.ams.dto.BpmMailConfigUpdateDTO;
import com.ams.dto.BpmMailVariableCreateDTO;
import com.ams.dto.BpmMailVariableUpdateDTO;
import com.ams.entity.BpmMailConfig;
import com.ams.entity.BpmMailVariable;
import com.ams.service.BpmMailConfigService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/bpm/mail-configs")
@RequiredArgsConstructor
public class BpmMailConfigController {

    private final BpmMailConfigService bpmMailConfigService;

    @PreAuthorize("@ss.hasPermi('bpm:mail:list')")
    @GetMapping
    public Result<List<BpmMailConfig>> list(
            @RequestParam(required = false) String processType) {
        return Result.success(bpmMailConfigService.list(processType));
    }

    @PreAuthorize("@ss.hasPermi('bpm:mail:list')")
    @GetMapping("/{id}")
    public Result<BpmMailConfig> getById(@PathVariable Long id) {
        return Result.success(bpmMailConfigService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('bpm:mail:add')")
    @PostMapping
    public Result<BpmMailConfig> create(@Valid @RequestBody BpmMailConfigCreateDTO dto) {
        return Result.success(bpmMailConfigService.create(dto));
    }

    @PreAuthorize("@ss.hasPermi('bpm:mail:edit')")
    @PutMapping("/{id}")
    public Result<BpmMailConfig> update(@PathVariable Long id, @Valid @RequestBody BpmMailConfigUpdateDTO dto) {
        return Result.success(bpmMailConfigService.update(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('bpm:mail:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        bpmMailConfigService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('bpm:mail:list')")
    @GetMapping("/variables")
    public Result<List<BpmMailVariable>> listVariables() {
        return Result.success(bpmMailConfigService.listVariables());
    }

    @PreAuthorize("@ss.hasPermi('bpm:mail:add')")
    @PostMapping("/variables")
    public Result<BpmMailVariable> createVariable(@Valid @RequestBody BpmMailVariableCreateDTO dto) {
        return Result.success(bpmMailConfigService.createVariable(dto));
    }

    @PreAuthorize("@ss.hasPermi('bpm:mail:edit')")
    @PutMapping("/variables/{id}")
    public Result<BpmMailVariable> updateVariable(@PathVariable Long id, @Valid @RequestBody BpmMailVariableUpdateDTO dto) {
        return Result.success(bpmMailConfigService.updateVariable(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('bpm:mail:remove')")
    @DeleteMapping("/variables/{id}")
    public Result<Void> deleteVariable(@PathVariable Long id) {
        bpmMailConfigService.deleteVariable(id);
        return Result.success();
    }
}
