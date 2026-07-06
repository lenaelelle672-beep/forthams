package com.ams.service;

import com.ams.dto.FileStorageAttachmentCatalogDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class FileStorageCatalogService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final String READONLY_NOTICE = "当前仅为 /system/file-storage/attachments/catalog 只读元数据目录，不支持上传/下载/预览/删除，不访问文件系统，不代表文件生命周期闭环。";
    private static final List<String> RISK_TIPS = List.of(
            READONLY_NOTICE,
            "仅查询 sys_attachment 中 deleted=0 的附件元数据，不写库、不生成文件链接。",
            "返回内容不包含存储位置、下载地址、预览地址或任何文件访问入口。"
    );

    private final JdbcTemplate jdbcTemplate;

    public FileStorageCatalogService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public FileStorageAttachmentCatalogDTO getAttachmentCatalog(
            String keyword,
            String businessType,
            String fileType,
            Integer page,
            Integer pageSize
    ) {
        FilterClause filterClause = buildFilterClause(keyword, businessType, fileType);
        int safePage = normalizePage(page);
        int safePageSize = normalizePageSize(pageSize);
        int offset = (safePage - 1) * safePageSize;

        FileStorageAttachmentCatalogDTO.FileStorageAttachmentSummaryDTO summary = loadSummary(filterClause);
        List<FileStorageAttachmentCatalogDTO.FileStorageAttachmentMetadataDTO> attachments = loadAttachments(filterClause, safePageSize, offset);
        summary.setCurrentPageAttachmentCount(attachments.size());

        FileStorageAttachmentCatalogDTO.FileStorageAttachmentPageDTO pageInfo = new FileStorageAttachmentCatalogDTO.FileStorageAttachmentPageDTO();
        pageInfo.setPage(safePage);
        pageInfo.setPageSize(safePageSize);
        pageInfo.setTotalCount(summary.getTotalAttachmentCount());
        pageInfo.setTotalPages(summary.getTotalAttachmentCount() == 0 ? 0 : (int) Math.ceil((double) summary.getTotalAttachmentCount() / safePageSize));

        FileStorageAttachmentCatalogDTO catalog = new FileStorageAttachmentCatalogDTO();
        catalog.setAttachments(attachments);
        catalog.setSummary(summary);
        catalog.setPage(pageInfo);
        catalog.setBusinessTypes(loadDistinctValues("business_type"));
        catalog.setFileTypes(loadDistinctValues("file_type"));
        catalog.setReadonlyNotice(READONLY_NOTICE);
        catalog.setRiskTips(RISK_TIPS);
        return catalog;
    }

    private FileStorageAttachmentCatalogDTO.FileStorageAttachmentSummaryDTO loadSummary(FilterClause filterClause) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) AS total_count,
                       COALESCE(SUM(COALESCE(file_size, 0)), 0) AS total_size,
                       COUNT(DISTINCT business_type) AS business_type_count,
                       COUNT(DISTINCT file_type) AS file_type_count
                FROM sys_attachment
                """ + filterClause.where(), (rs, rowNum) -> {
            FileStorageAttachmentCatalogDTO.FileStorageAttachmentSummaryDTO summary = new FileStorageAttachmentCatalogDTO.FileStorageAttachmentSummaryDTO();
            summary.setTotalAttachmentCount(rs.getInt("total_count"));
            summary.setTotalFileSize(rs.getLong("total_size"));
            summary.setBusinessTypeCount(rs.getInt("business_type_count"));
            summary.setFileTypeCount(rs.getInt("file_type_count"));
            return summary;
        }, filterClause.parameters().toArray());
    }

    private List<FileStorageAttachmentCatalogDTO.FileStorageAttachmentMetadataDTO> loadAttachments(FilterClause filterClause, int pageSize, int offset) {
        List<Object> parameters = new ArrayList<>(filterClause.parameters());
        parameters.add(pageSize);
        parameters.add(offset);
        return jdbcTemplate.query("""
                SELECT id, business_type, business_id, file_name, file_size, file_type, upload_by, create_time
                FROM sys_attachment
                """ + filterClause.where() + """
                ORDER BY create_time DESC, id DESC
                LIMIT ? OFFSET ?
                """, (rs, rowNum) -> {
            FileStorageAttachmentCatalogDTO.FileStorageAttachmentMetadataDTO attachment = new FileStorageAttachmentCatalogDTO.FileStorageAttachmentMetadataDTO();
            String safeFileName = safeDisplayName(rs.getString("file_name"));
            attachment.setId(rs.getLong("id"));
            attachment.setBusinessType(rs.getString("business_type"));
            attachment.setBusinessId(rs.getLong("business_id"));
            attachment.setFileName(safeFileName);
            attachment.setDisplayName(safeFileName);
            attachment.setFileSize(rs.getObject("file_size", Long.class));
            attachment.setFileType(rs.getString("file_type"));
            attachment.setUploadBy(rs.getObject("upload_by", Long.class));
            attachment.setCreateTime(readCreateTime(rs.getTimestamp("create_time")));
            return attachment;
        }, parameters.toArray());
    }

    private List<String> loadDistinctValues(String columnName) {
        return jdbcTemplate.queryForList("""
                SELECT DISTINCT %s
                FROM sys_attachment
                WHERE COALESCE(deleted, 0) = 0
                  AND %s IS NOT NULL
                  AND %s <> ''
                ORDER BY %s
                """.formatted(columnName, columnName, columnName, columnName), String.class);
    }

    private FilterClause buildFilterClause(String keyword, String businessType, String fileType) {
        List<String> conditions = new ArrayList<>();
        List<Object> parameters = new ArrayList<>();
        conditions.add("COALESCE(deleted, 0) = 0");

        String normalizedKeyword = normalize(keyword);
        if (normalizedKeyword != null) {
            conditions.add("(LOWER(file_name) LIKE ? OR LOWER(business_type) LIKE ? OR LOWER(file_type) LIKE ?)");
            String keywordPattern = "%" + normalizedKeyword.toLowerCase() + "%";
            parameters.add(keywordPattern);
            parameters.add(keywordPattern);
            parameters.add(keywordPattern);
        }

        String normalizedBusinessType = normalize(businessType);
        if (normalizedBusinessType != null) {
            conditions.add("business_type = ?");
            parameters.add(normalizedBusinessType);
        }

        String normalizedFileType = normalize(fileType);
        if (normalizedFileType != null) {
            conditions.add("file_type = ?");
            parameters.add(normalizedFileType);
        }

        return new FilterClause("WHERE " + String.join(" AND ", conditions) + "\n", parameters);
    }

    private int normalizePage(Integer page) {
        if (page == null || page < DEFAULT_PAGE) {
            return DEFAULT_PAGE;
        }
        return page;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private String normalize(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String safeDisplayName(String value) {
        String normalized = normalize(value);
        if (normalized == null) {
            return "未命名附件";
        }
        int slashIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
        return slashIndex >= 0 ? normalized.substring(slashIndex + 1) : normalized;
    }

    private LocalDateTime readCreateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private record FilterClause(String where, List<Object> parameters) {
    }
}
