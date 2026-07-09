package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.NumberingRuleDTO;
import com.ams.dto.NumberingRuleMetaDTO;
import com.ams.dto.NumberingRulePreviewRequestDTO;
import com.ams.dto.NumberingRulePreviewRespDTO;
import com.ams.service.NumberingRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/numbering-rules")
@RequiredArgsConstructor
public class NumberingRuleController {

    private final NumberingRuleService numberingRuleService;

    @GetMapping
    public Result<List<NumberingRuleDTO>> list() {
        return Result.success(numberingRuleService.list());
    }

    @GetMapping("/meta")
    public Result<NumberingRuleMetaDTO> meta() {
        return Result.success(numberingRuleService.meta());
    }

    @GetMapping("/{ruleKey}")
    public Result<NumberingRuleDTO> get(@PathVariable String ruleKey) {
        return Result.success(numberingRuleService.get(ruleKey));
    }

    @PostMapping("/preview")
    public Result<NumberingRulePreviewRespDTO> preview(@RequestBody NumberingRulePreviewRequestDTO request) {
        return Result.success(numberingRuleService.preview(request));
    }
}
