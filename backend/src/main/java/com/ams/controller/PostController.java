package com.ams.controller;

import com.ams.annotation.OperBusinessType;
import com.ams.annotation.OperLog;
import com.ams.common.Result;
import com.ams.entity.SysPost;
import com.ams.service.PostService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @GetMapping("/list")
    @PreAuthorize("@ss.hasPermi('system:post:query')")
    public Result<Page<SysPost>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(postService.queryPosts(page, pageSize, keyword));
    }

    @GetMapping("/all")
    @PreAuthorize("@ss.hasPermi('system:post:query')")
    public Result<List<SysPost>> all() {
        return Result.success(postService.listAll());
    }

    @GetMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:post:query')")
    public Result<SysPost> getById(@PathVariable Long id) {
        return Result.success(postService.getById(id));
    }

    @PostMapping
    @PreAuthorize("@ss.hasPermi('system:post:add')")
    @OperLog(title = "岗位新增", businessType = OperBusinessType.INSERT)
    public Result<SysPost> create(@RequestBody SysPost post) {
        return Result.success(postService.create(post));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:post:edit')")
    @OperLog(title = "岗位修改", businessType = OperBusinessType.UPDATE)
    public Result<SysPost> update(@PathVariable Long id, @RequestBody SysPost post) {
        return Result.success(postService.update(id, post));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:post:delete')")
    @OperLog(title = "岗位删除", businessType = OperBusinessType.DELETE)
    public Result<Void> delete(@PathVariable Long id) {
        postService.delete(id);
        return Result.success();
    }

    @GetMapping("/users/{userId}")
    @PreAuthorize("@ss.hasPermi('system:post:query')")
    public Result<List<Long>> getUserPosts(@PathVariable Long userId) {
        return Result.success(postService.getUserPostIds(userId));
    }

    @PutMapping("/users/{userId}")
    @PreAuthorize("@ss.hasPermi('system:post:edit')")
    @OperLog(title = "用户岗位分配", businessType = OperBusinessType.GRANT)
    public Result<Void> assignUserPosts(@PathVariable Long userId, @RequestBody Map<String, List<Long>> body) {
        postService.assignUserPosts(userId, body.get("postIds"));
        return Result.success();
    }
}
