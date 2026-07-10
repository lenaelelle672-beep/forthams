package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("doc_article")
public class DocArticle {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String title;
    private String category;
    private Integer version;
    private String status;
    private String authorName;
    private Integer attachmentCount;
    private String summary;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
