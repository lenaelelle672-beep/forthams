package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.DocArticleDTO;
import com.ams.entity.DocArticle;
import com.ams.mapper.DocArticleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;

/** 文档中心只读 catalog 服务。全部只读，不编辑/发布/归档/删除/上传附件。 */
@Service
@RequiredArgsConstructor
public class DocCenterService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final DocArticleMapper docArticleMapper;

    public DocArticleDTO.PageResult list(String category, String status, String keyword, int page, int pageSize) {
        String tenantId = TenantContext.requireTenantId();
        int safePage = Math.max(page, 1);
        int safePageSize = pageSize <= 0 ? 20 : Math.min(pageSize, 100);
        int offset = (safePage - 1) * safePageSize;

        long total = docArticleMapper.count(tenantId, trim(category), trim(status), trim(keyword));
        List<DocArticle> records = docArticleMapper.selectPage(tenantId, trim(category), trim(status), trim(keyword), safePageSize, offset);

        DocArticleDTO.PageResult result = new DocArticleDTO.PageResult();
        result.setTotal(total);
        result.setRecords(records.stream().map(this::toDTO).toList());
        return result;
    }

    public DocArticleDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("文档 ID 不合法");
        }
        DocArticle record = docArticleMapper.selectByIdAndTenant(tenantId, id);
        if (record == null) {
            throw new BusinessException("文档不存在");
        }
        return toDTO(record);
    }

    public DocArticleDTO.Meta meta() {
        DocArticleDTO.Meta meta = new DocArticleDTO.Meta();
        meta.setCategories(List.of("GENERAL", "POLICY", "MANUAL", "FAQ", "ANNOUNCEMENT"));
        meta.setStatuses(List.of("DRAFT", "PUBLISHED", "ARCHIVED"));
        meta.setReadOnlyNotice("文档中心为只读 catalog；编辑、发布、归档、删除、附件上传等写操作不在 V3 只读边界内。附件安全与删除留痕需后续专项处理。");
        return meta;
    }

    private DocArticleDTO toDTO(DocArticle record) {
        DocArticleDTO dto = new DocArticleDTO();
        dto.setId(record.getId());
        dto.setTitle(record.getTitle());
        dto.setCategory(record.getCategory());
        dto.setCategoryLabel(categoryLabel(record.getCategory()));
        dto.setVersion(record.getVersion());
        dto.setStatus(record.getStatus());
        dto.setStatusLabel(statusLabel(record.getStatus()));
        dto.setAuthorName(record.getAuthorName());
        dto.setAttachmentCount(record.getAttachmentCount());
        dto.setSummary(record.getSummary());
        dto.setPublishedAt(record.getPublishedAt() != null ? record.getPublishedAt().format(ISO) : null);
        dto.setCreatedAt(record.getCreatedAt() != null ? record.getCreatedAt().format(ISO) : null);
        dto.setUpdatedAt(record.getUpdatedAt() != null ? record.getUpdatedAt().format(ISO) : null);
        return dto;
    }

    private String categoryLabel(String category) {
        if (category == null) return "通用";
        return switch (category.toUpperCase()) {
            case "POLICY" -> "制度规范";
            case "MANUAL" -> "操作手册";
            case "FAQ" -> "常见问题";
            case "ANNOUNCEMENT" -> "公告通知";
            default -> "通用";
        };
    }

    private String statusLabel(String status) {
        if (status == null) return "未知";
        return switch (status.toUpperCase()) {
            case "DRAFT" -> "草稿";
            case "PUBLISHED" -> "已发布";
            case "ARCHIVED" -> "已归档";
            default -> status;
        };
    }

    private String trim(String value) {
        return value == null ? null : value.trim().isEmpty() ? null : value.trim();
    }
}
