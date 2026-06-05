package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.entity.BusinessComment;
import com.ams.entity.BusinessCommentLikeRecord;
import com.ams.entity.NotificationRecord;
import com.ams.entity.User;
import com.ams.mapper.BusinessCommentLikeRecordMapper;
import com.ams.mapper.BusinessCommentMapper;
import com.ams.mapper.UserMapper;
import com.ams.service.BusinessCommentService;
import com.ams.service.NotificationService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BusinessCommentServiceImpl implements BusinessCommentService {

    private final BusinessCommentMapper businessCommentMapper;
    private final BusinessCommentLikeRecordMapper businessCommentLikeRecordMapper;
    private final UserMapper userMapper;
    private final NotificationService notificationService;

    private static final Pattern MENTION_PATTERN = Pattern.compile("@(\\S+?)(?=[\\s,，、。！？：；）)\\n]|$)");

    @Override
    public Page<BusinessComment> listComments(String businessType, Long businessId, Long parentCommentId,
                                              Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<BusinessComment> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<BusinessComment> wrapper = new LambdaQueryWrapper<BusinessComment>()
                .eq(BusinessComment::getTenantId, tenantId)
                .eq(BusinessComment::getBusinessType, businessType)
                .eq(BusinessComment::getBusinessId, businessId);
        if (parentCommentId != null) {
            wrapper.eq(BusinessComment::getParentCommentId, parentCommentId);
        } else {
            wrapper.isNull(BusinessComment::getParentCommentId);
        }
        wrapper.orderByAsc(BusinessComment::getCreateTime);
        return businessCommentMapper.selectPage(page, wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BusinessComment create(BusinessComment comment) {
        String tenantId = TenantContext.requireTenantId();
        comment.setTenantId(tenantId);
        comment.setCreateTime(LocalDateTime.now());
        businessCommentMapper.insert(comment);

        // 检测是否为回复评论，发送回复通知
        if (comment.getParentCommentId() != null) {
            BusinessComment parentComment = businessCommentMapper.selectById(comment.getParentCommentId());
            if (parentComment != null && !parentComment.getUserId().equals(comment.getUserId())) {
                // 发送回复通知给被回复的用户
                NotificationRecord replyRecord = new NotificationRecord();
                replyRecord.setUserId(parentComment.getUserId());
                replyRecord.setTitle("回复通知");
                replyRecord.setContent(comment.getUserName() + " 回复了你的评论：" +
                        (comment.getContent().length() > 100 ? comment.getContent().substring(0, 100) + "..." : comment.getContent()));
                replyRecord.setType("COMMENT_REPLY");
                replyRecord.setCategory("COMMENT");
                replyRecord.setRefId(comment.getId());
                replyRecord.setRefType("COMMENT");
                notificationService.create(replyRecord);
            }
        }

        // 解析 @mention 并发送通知
        String content = comment.getContent();
        if (content != null && content.contains("@")) {
            List<Long> mentionedUserIds = parseMentions(content, tenantId);
            for (Long mentionedUserId : mentionedUserIds) {
                // 不给自己发通知
                if (mentionedUserId.equals(comment.getUserId())) continue;

                // 发送 @mention 通知
                NotificationRecord record = new NotificationRecord();
                record.setUserId(mentionedUserId);
                record.setTitle("有人@了你");
                record.setContent(comment.getUserName() + " 在 " + comment.getBusinessType()
                        + " 中@了你：" + (content.length() > 100 ? content.substring(0, 100) + "..." : content));
                record.setType("COMMENT_MENTION");
                record.setCategory("COMMENT");
                record.setRefId(comment.getId());
                record.setRefType("COMMENT");
                notificationService.create(record);
            }
        }

        return comment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        businessCommentMapper.delete(new LambdaQueryWrapper<BusinessComment>()
                .eq(BusinessComment::getId, id)
                .eq(BusinessComment::getTenantId, tenantId));
    }

    @Override
    public List<Long> parseMentions(String content, String tenantId) {
        if (content == null || content.isEmpty()) return List.of();
        Matcher matcher = MENTION_PATTERN.matcher(content);
        List<String> usernames = new ArrayList<>();
        while (matcher.find()) {
            usernames.add(matcher.group(1));
        }
        if (usernames.isEmpty()) return List.of();

        // 按用户名查询用户ID（User表无tenantId字段，全局查询）
        return userMapper.selectList(new LambdaQueryWrapper<User>()
                        .in(User::getUsername, usernames))
                .stream()
                .map(User::getId)
                .collect(Collectors.toList());
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public BusinessComment likeComment(Long commentId) {
        String tenantId = TenantContext.requireTenantId();
        
        // 从 SecurityContext 获取当前用户ID
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("用户未登录");
        }
        
        // 假设用户ID存储在 principal 中（具体实现取决于项目的安全配置）
        // 这里假设 principal 是用户ID（Long类型），或者从 User 对象中获取
        Long userId = null;
        Object principal = authentication.getPrincipal();
        if (principal instanceof Long) {
            userId = (Long) principal;
        } else if (principal instanceof User) {
            userId = ((User) principal).getId();
        } else if (principal instanceof org.springframework.security.core.userdetails.UserDetails) {
            // 如果是 UserDetails，需要从数据库查询用户ID
            String username = ((org.springframework.security.core.userdetails.UserDetails) principal).getUsername();
            User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username));
            if (user != null) {
                userId = user.getId();
            }
        }
        
        if (userId == null) {
            throw new RuntimeException("无法获取用户ID");
        }
        
        // 检查评论是否存在且属于当前租户
        BusinessComment comment = businessCommentMapper.selectOne(
                new LambdaQueryWrapper<BusinessComment>()
                        .eq(BusinessComment::getId, commentId)
                        .eq(BusinessComment::getTenantId, tenantId)
        );
        
        if (comment == null) {
            throw new RuntimeException("评论不存在或无权操作");
        }
        
        // 检查是否已点赞（防重复）
        BusinessCommentLikeRecord existingRecord = businessCommentLikeRecordMapper.selectOne(
                new LambdaQueryWrapper<BusinessCommentLikeRecord>()
                        .eq(BusinessCommentLikeRecord::getCommentId, commentId)
                        .eq(BusinessCommentLikeRecord::getUserId, userId)
                        .eq(BusinessCommentLikeRecord::getTenantId, tenantId)
                        .eq(BusinessCommentLikeRecord::getDeleted, 0)
        );
        
        if (existingRecord != null) {
            // 已点赞，取消点赞（逻辑删除记录，likes - 1）
            businessCommentLikeRecordMapper.update(null,
                    new LambdaUpdateWrapper<BusinessCommentLikeRecord>()
                            .eq(BusinessCommentLikeRecord::getId, existingRecord.getId())
                            .set(BusinessCommentLikeRecord::getDeleted, 1)
            );
            
            // 使用原子操作更新 likes 字段（likes = likes - 1，但不能小于0）
            businessCommentMapper.update(null,
                    new LambdaUpdateWrapper<BusinessComment>()
                            .eq(BusinessComment::getId, commentId)
                            .eq(BusinessComment::getTenantId, tenantId)
                            .setSql("likes = GREATEST(likes - 1, 0)")
            );
        } else {
            // 未点赞，新增点赞记录
            BusinessCommentLikeRecord newRecord = new BusinessCommentLikeRecord();
            newRecord.setCommentId(commentId);
            newRecord.setUserId(userId);
            newRecord.setTenantId(tenantId);
            newRecord.setCreateTime(LocalDateTime.now());
            newRecord.setDeleted(0);
            businessCommentLikeRecordMapper.insert(newRecord);
            
            // 使用原子操作更新 likes 字段（likes = likes + 1）
            businessCommentMapper.update(null,
                    new LambdaUpdateWrapper<BusinessComment>()
                            .eq(BusinessComment::getId, commentId)
                            .eq(BusinessComment::getTenantId, tenantId)
                            .setSql("likes = likes + 1")
            );
        }
        
        // 查询更新后的评论
        comment = businessCommentMapper.selectById(commentId);
        return comment;
    }
}
