package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SystemPostDTO;
import com.ams.dto.SystemPostMetaDTO;
import com.ams.dto.SystemPostPreviewRequestDTO;
import com.ams.dto.SystemPostPreviewRespDTO;
import com.ams.dto.SystemPostQueryDTO;
import com.ams.service.PostManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/system/posts")
@RequiredArgsConstructor
public class PostManagementController {

    private final PostManagementService postManagementService;

    @GetMapping
    public Result<SystemPostDTO.PageResult> list(@ModelAttribute SystemPostQueryDTO query) {
        return Result.success(postManagementService.list(query));
    }

    @GetMapping("/all")
    public Result<List<SystemPostDTO>> all(@ModelAttribute SystemPostQueryDTO query) {
        return Result.success(postManagementService.all(query));
    }

    @GetMapping("/meta")
    public Result<SystemPostMetaDTO> meta() {
        return Result.success(postManagementService.meta());
    }

    @GetMapping("/{id}")
    public Result<SystemPostDTO> detail(@PathVariable Long id) {
        return Result.success(postManagementService.detail(id));
    }

    @PostMapping("/preview")
    public Result<SystemPostPreviewRespDTO> preview(@RequestBody SystemPostPreviewRequestDTO request) {
        return Result.success(postManagementService.preview(request));
    }
}
