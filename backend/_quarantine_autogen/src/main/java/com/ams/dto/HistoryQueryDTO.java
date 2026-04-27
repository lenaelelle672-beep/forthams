package com.ams.dto;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 资产生命周期历史记录查询DTO
 * 
 * <p>用于资产报废退役模块(SWARM-002)中，查询资产状态变更的生命周期历史记录。
 * 支持多维度过滤、分页查询、字段脱敏等查询场景。</p>
 * 
 * <p>使用示例:</p>
 * <pre>{@code
 * HistoryQueryDTO query = HistoryQueryDTO.builder()
 *     .assetId("AST-2024-001")
 *     .startDate(LocalDateTime.of(2024, 1, 1, 0, 0))
 *     .endDate(LocalDateTime.now())
 *     .page(1)
 *     .pageSize(20)
 *     .build();
 * }</pre>
 * 
 * @author AMS Team
 * @version 1.0
 * @since SWARM-002
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class HistoryQueryDTO {
    
    /**
     * 资产ID
     * 用于精确查询指定资产的生命周期历史记录
     */
    private String assetId;
    
    /**
     * 操作人ID
     * 用于查询指定操作人发起的所有变更记录
     */
    private String operatorId;
    
    /**
     * 资产状态列表
     * 用于过滤特定状态的历史记录
     */
    private List<String> statusList;
    
    /**
     * 查询起始时间
     * ISO8601格式: yyyy-MM-ddTHH:mm:ss
     */
    private LocalDateTime startDate;
    
    /**
     * 查询结束时间
     * ISO8601格式: yyyy-MM-ddTHH:mm:ss
     */
    private LocalDateTime endDate;
    
    /**
     * 页码
     * 从1开始，默认为1
     */
    @Builder.Default
    private Integer page = 1;
    
    /**
     * 每页记录数
     * 默认20条，最大100条
     */
    @Builder.Default
    private Integer pageSize = 20;
    
    /**
     * 是否包含敏感财务字段
     * 默认为false（脱敏模式）
     */
    @Builder.Default
    private Boolean includeSensitiveFields = false;
    
    /**
     * 排序字段
     * 支持: timestamp, assetId, operatorId
     * 默认为timestamp
     */
    @Builder.Default
    private String sortBy = "timestamp";
    
    /**
     * 排序方向
     * ASC: 升序（时间由远及近）
     * DESC: 降序（时间由近及远）
     * 默认为DESC
     */
    @Builder.Default
    private String sortOrder = "DESC";
    
    /**
     * 验证查询参数的有效性
     * 
     * @return 验证结果，true表示参数有效
     */
    public boolean isValid() {
        if (page != null && page < 1) {
            return false;
        }
        if (pageSize != null && (pageSize < 1 || pageSize > 100)) {
            return false;
        }
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            return false;
        }
        return true;
    }
    
    /**
     * 计算分页偏移量
     * 
     * @return 偏移量，用于数据库查询
     */
    public int getOffset() {
        if (page == null || pageSize == null) {
            return 0;
        }
        return (page - 1) * pageSize;
    }
    
    /**
     * 构建分页信息摘要
     * 
     * @return 分页摘要字符串，格式: "Showing X-Y"
     */
    public String getPaginationSummary() {
        if (page == null || pageSize == null) {
            return "Showing 1-20";
        }
        int start = (page - 1) * pageSize + 1;
        int end = page * pageSize;
        return String.format("Showing %d-%d", start, end);
    }
}