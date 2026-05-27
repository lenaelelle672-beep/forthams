package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SearchResultDTO;
import com.ams.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

/**
 * 全局搜索控制器。
 *
 * <p>提供跨资产、工单、供应商的统一搜索 API。
 * <ul>
 *   <li>SRC-01: GET /api/search?keyword=&type=all|asset|workorder|vendor&limit=10 — 全局搜索</li>
 * </ul>
 */
@RestController
@RequestMapping("/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    /**
     * SRC-01: 全局搜索。
     *
     * @param keyword 搜索关键词（必填，空字符串返回空列表）
     * @param type    搜索范围：all（全部）、asset（资产）、workorder（工单）、vendor（供应商）
     * @param limit   每类结果最大条数，默认 10
     * @return 统一格式的搜索结果列表
     */
    @PreAuthorize("@ss.hasPermi('search:query')")
    @GetMapping
    public Result<List<SearchResultDTO>> search(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "all") String type,
            @RequestParam(defaultValue = "10") int limit) {
        List<SearchResultDTO> results = searchService.search(keyword, type, limit);
        return Result.success(results);
    }
}
