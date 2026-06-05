package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.BusinessComment;
import com.ams.service.BusinessCommentService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/comments")
@RequiredArgsConstructor
@Tag(name = "评论管理", description = "业务评论 CRUD，支持 @mention 通知")
public class BusinessCommentController {

    private final BusinessCommentService businessCommentService;

    @Operation(summary = "分页查询评论列表", description = "按业务类型和业务ID查询评论，支持分页")
    @PreAuthorize("@ss.hasPermi('comment:query')")
    @GetMapping
    public Result<Page<BusinessComment>> list(
            @RequestParam String businessType,
            @RequestParam Long businessId,
            @RequestParam(required = false) Long parentCommentId,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize) {
        return Result.success(businessCommentService.listComments(
                businessType, businessId, parentCommentId, pageNum, pageSize));
    }

    @Operation(summary = "创建评论", description = "创建业务评论，支持 @mention 标记触发通知")
    @PreAuthorize("@ss.hasPermi('comment:create')")
    @PostMapping
    public Result<BusinessComment> create(@Valid @RequestBody BusinessComment comment) {
        return Result.success(businessCommentService.create(comment));
    }

    @Operation(summary = "删除评论", description = "逻辑删除指定评论")
    @PreAuthorize("@ss.hasPermi('comment:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        businessCommentService.delete(id);
        return Result.success();
    }
    
    @Operation(summary = "点赞评论", description = "对评论进行点赞，原子操作 likes + 1")
    @PreAuthorize("@ss.hasPermi('comment:edit')")
    @PostMapping("/{id}/like")
    public Result<BusinessComment> like(@PathVariable Long id) {
        return Result.success(businessCommentService.likeComment(id));
    }
}
