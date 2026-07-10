package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** 文档中心只读 catalog DTO。只读：不提供编辑/发布/归档/删除/附件上传。 */
@Data
public class DocArticleDTO {
    private Long id;
    private String title;
    private String category;
    private String categoryLabel;
    private Integer version;
    private String status;
    private String statusLabel;
    private String authorName;
    private Integer attachmentCount;
    private String summary;
    private String publishedAt;
    private String createdAt;
    private String updatedAt;

    @Data
    public static class PageResult {
        private List<DocArticleDTO> records = new ArrayList<>();
        private long total;
    }

    @Data
    public static class Meta {
        private List<String> categories = new ArrayList<>();
        private List<String> statuses = new ArrayList<>();
        private String readOnlyNotice;
    }
}
