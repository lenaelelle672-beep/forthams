package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.DocArticleDTO;
import com.ams.service.DocCenterService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 文档中心只读 controller。全部只读。 */
@RestController
@RequestMapping("/system/doc-center")
@RequiredArgsConstructor
public class DocCenterController {

    private final DocCenterService docCenterService;

    @GetMapping
    public Result<DocArticleDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return Result.success(docCenterService.list(category, status, keyword, page, pageSize));
    }

    @GetMapping("/{id}")
    public Result<DocArticleDTO> detail(@PathVariable Long id) {
        return Result.success(docCenterService.detail(id));
    }

    @GetMapping("/meta")
    public Result<DocArticleDTO.Meta> meta() {
        return Result.success(docCenterService.meta());
    }
}
