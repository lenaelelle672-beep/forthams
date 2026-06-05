package com.ams.service;

import com.ams.entity.BusinessComment;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

public interface BusinessCommentService {
    Page<BusinessComment> listComments(String businessType, Long businessId, Long parentCommentId,
                                       Integer pageNum, Integer pageSize);
    BusinessComment create(BusinessComment comment);
    void delete(Long id);
    List<Long> parseMentions(String content, String tenantId);
    
    /**
     * 点赞评论（原子操作 likes + 1）
     * @param commentId 评论ID
     * @return 更新后的评论
     */
    BusinessComment likeComment(Long commentId);
}
