package com.ams.service;

import com.ams.dto.SearchResultDTO;
import com.ams.entity.Asset;
import com.ams.entity.Vendor;
import com.ams.entity.WorkOrder;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.VendorMapper;
import com.ams.mapper.WorkOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * 全局搜索服务。
 *
 * <p>跨资产、工单、供应商等模块执行并行搜索，
 * 返回统一格式的 SearchResultDTO 列表。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final AssetMapper assetMapper;
    private final WorkOrderMapper workOrderMapper;
    private final VendorMapper vendorMapper;

    /**
     * 执行全局搜索。
     *
     * @param keyword 搜索关键词
     * @param type    搜索范围（all / asset / workorder / vendor）
     * @param limit   每类结果最大条数
     * @return 合并排序后的搜索结果列表
     */
    public List<SearchResultDTO> search(String keyword, String type, int limit) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return Collections.emptyList();
        }

        String kw = keyword.trim();
        List<CompletableFuture<List<SearchResultDTO>>> futures = new ArrayList<>();

        // 按 type 参数并行查询各模块
        if ("all".equals(type) || "asset".equals(type)) {
            futures.add(CompletableFuture.supplyAsync(() -> searchAssets(kw, limit)));
        }
        if ("all".equals(type) || "workorder".equals(type)) {
            futures.add(CompletableFuture.supplyAsync(() -> searchWorkOrders(kw, limit)));
        }
        if ("all".equals(type) || "vendor".equals(type)) {
            futures.add(CompletableFuture.supplyAsync(() -> searchVendors(kw, limit)));
        }

        try {
            // 等待所有查询完成并合并结果
            List<SearchResultDTO> allResults = CompletableFuture
                    .allOf(futures.toArray(new CompletableFuture[0]))
                    .thenApply(v -> futures.stream()
                            .map(CompletableFuture::join)
                            .flatMap(List::stream)
                            .collect(Collectors.toList()))
                    .get();

            // 排序：优先展示资产，其次工单，最后供应商
            allResults.sort((a, b) -> {
                int orderA = typeOrder(a.getType());
                int orderB = typeOrder(b.getType());
                if (orderA != orderB) return Integer.compare(orderA, orderB);
                return a.getTitle().compareTo(b.getTitle());
            });

            return allResults;
        } catch (Exception e) {
            log.error("Global search failed for keyword: {}", kw, e);
            return Collections.emptyList();
        }
    }

    /**
     * 搜索资产。
     */
    private List<SearchResultDTO> searchAssets(String keyword, int limit) {
        try {
            List<Asset> assets = assetMapper.selectList(
                    new QueryWrapper<Asset>()
                            .like("asset_name", keyword)
                            .or()
                            .like("asset_no", keyword)
                            .or()
                            .like("model", keyword)
                            .or()
                            .like("brand", keyword)
                            .last("LIMIT " + limit)
            );

            return assets.stream().map(a -> SearchResultDTO.builder()
                    .id(a.getId())
                    .type("asset")
                    .title(a.getAssetName())
                    .subtitle(a.getAssetNo())
                    .path("/assets/" + a.getId())
                    .build()).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Asset search failed", e);
            return Collections.emptyList();
        }
    }

    /**
     * 搜索工单。
     */
    private List<SearchResultDTO> searchWorkOrders(String keyword, int limit) {
        try {
            List<WorkOrder> orders = workOrderMapper.selectList(
                    new QueryWrapper<WorkOrder>()
                            .like("title", keyword)
                            .or()
                            .like("work_order_no", keyword)
                            .or()
                            .like("description", keyword)
                            .last("LIMIT " + limit)
            );

            return orders.stream().map(w -> SearchResultDTO.builder()
                    .id(w.getId())
                    .type("workorder")
                    .title(w.getTitle())
                    .subtitle(w.getWorkOrderNo())
                    .path("/workorders/" + w.getId())
                    .build()).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("WorkOrder search failed", e);
            return Collections.emptyList();
        }
    }

    /**
     * 搜索供应商。
     */
    private List<SearchResultDTO> searchVendors(String keyword, int limit) {
        try {
            List<Vendor> vendors = vendorMapper.selectList(
                    new QueryWrapper<Vendor>()
                            .like("name", keyword)
                            .or()
                            .like("vendor_code", keyword)
                            .or()
                            .like("contact_person", keyword)
                            .last("LIMIT " + limit)
            );

            return vendors.stream().map(v -> SearchResultDTO.builder()
                    .id(v.getId())
                    .type("vendor")
                    .title(v.getName())
                    .subtitle(v.getVendorCode())
                    .path("/vendors")
                    .build()).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Vendor search failed", e);
            return Collections.emptyList();
        }
    }

    /**
     * 类型排序权重：asset=0, workorder=1, vendor=2
     */
    private int typeOrder(String type) {
        return switch (type) {
            case "asset" -> 0;
            case "workorder" -> 1;
            case "vendor" -> 2;
            default -> 99;
        };
    }
}
