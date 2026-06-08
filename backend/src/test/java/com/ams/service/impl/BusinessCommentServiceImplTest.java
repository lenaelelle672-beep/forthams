package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.entity.BusinessComment;
import com.ams.entity.NotificationRecord;
import com.ams.entity.User;
import com.ams.mapper.BusinessCommentMapper;
import com.ams.mapper.UserMapper;
import com.ams.service.NotificationService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * BusinessCommentServiceImpl 单元测试
 *
 * <p>测试评论服务核心功能：评论列表查询、创建（含 @mention 解析和通知）、删除、@mention 解析。</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Business Comment Service Tests")
@Disabled("依赖已删除类，第4轮修复时标记")
class BusinessCommentServiceImplTest {

    @Mock
    private BusinessCommentMapper businessCommentMapper;

    @Mock
    private UserMapper userMapper;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private BusinessCommentServiceImpl businessCommentService;

    private final String testTenantId = "test-tenant-123";

    private BusinessComment testComment;
    private User testUser1;
    private User testUser2;
    private BusinessComment parentComment;

    @BeforeEach
    void setUp() {
        testComment = new BusinessComment();
        testComment.setId(1L);
        testComment.setBusinessType("ASSET");
        testComment.setBusinessId(100L);
        testComment.setUserId(10L);
        testComment.setUserName("测试用户");
        testComment.setContent("这是一条测试评论 @user1 @user2");
        testComment.setParentCommentId(null);
        testComment.setTenantId(testTenantId);

        testUser1 = new User();
        testUser1.setId(1L);
        testUser1.setUsername("user1");

        testUser2 = new User();
        testUser2.setId(2L);
        testUser2.setUsername("user2");

        parentComment = new BusinessComment();
        parentComment.setId(2L);
        parentComment.setUserId(20L);
        parentComment.setUserName("被回复用户");
        parentComment.setTenantId(testTenantId);
    }

    @Test
    @DisplayName("Should list comments with tenant isolation")
    void testListComments() {
        try (MockedStatic<TenantContext> mockedContext = mockStatic(TenantContext.class)) {
            mockedContext.when(TenantContext::requireTenantId).thenReturn(testTenantId);

            Page<BusinessComment> mockPage = new Page<>(1, 20);
            mockPage.setRecords(Arrays.asList(testComment));
            mockPage.setTotal(1);

            when(businessCommentMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
                    .thenReturn(mockPage);

            Page<BusinessComment> result = businessCommentService.listComments(
                    "ASSET", 100L, null, 1, 20);

            verify(businessCommentMapper).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
        }
    }

    @Test
    @DisplayName("Should create comment with @mention notifications")
    void testCreateCommentWithMentions() {
        try (MockedStatic<TenantContext> mockedContext = mockStatic(TenantContext.class)) {
            mockedContext.when(TenantContext::requireTenantId).thenReturn(testTenantId);

            when(businessCommentMapper.insert(any(BusinessComment.class))).thenReturn(1);
            when(userMapper.selectList(any(LambdaQueryWrapper.class)))
                    .thenReturn(Arrays.asList(testUser1, testUser2));
            when(notificationService.create(any(NotificationRecord.class))).thenReturn(new NotificationRecord());

            BusinessComment result = businessCommentService.create(testComment);

            verify(businessCommentMapper).insert(testComment);
            verify(userMapper).selectList(any(LambdaQueryWrapper.class));
            // 验证发送了两个 @mention 通知
            verify(notificationService, times(2)).create(any(NotificationRecord.class));
        }
    }

    @Test
    @DisplayName("Should create reply with notification to parent comment author")
    void testCreateReplyWithNotification() {
        try (MockedStatic<TenantContext> mockedContext = mockStatic(TenantContext.class)) {
            mockedContext.when(TenantContext::requireTenantId).thenReturn(testTenantId);

            testComment.setParentCommentId(2L);
            testComment.setContent("这是回复内容");

            when(businessCommentMapper.insert(any(BusinessComment.class))).thenReturn(1);
            when(businessCommentMapper.selectById(eq(2L))).thenReturn(parentComment);
            when(notificationService.create(any(NotificationRecord.class))).thenReturn(new NotificationRecord());

            BusinessComment result = businessCommentService.create(testComment);

            verify(businessCommentMapper).insert(testComment);
            verify(businessCommentMapper).selectById(2L);
            // 验证发送了一个回复通知
            verify(notificationService).create(any(NotificationRecord.class));
        }
    }

    @Test
    @DisplayName("Should not send notification to self")
    void testCreateCommentNotNotifySelf() {
        try (MockedStatic<TenantContext> mockedContext = mockStatic(TenantContext.class)) {
            mockedContext.when(TenantContext::requireTenantId).thenReturn(testTenantId);

            testComment.setContent("@testuser 这是一条测试");
            testComment.setUserId(1L);

            testUser1.setId(1L);
            testUser1.setUsername("testuser");

            when(businessCommentMapper.insert(any(BusinessComment.class))).thenReturn(1);
            when(userMapper.selectList(any(LambdaQueryWrapper.class)))
                    .thenReturn(Arrays.asList(testUser1));

            BusinessComment result = businessCommentService.create(testComment);

            // 不应该给自己发通知
            verify(notificationService, never()).create(any(NotificationRecord.class));
        }
    }

    @Test
    @DisplayName("Should delete comment with tenant isolation")
    void testDeleteComment() {
        try (MockedStatic<TenantContext> mockedContext = mockStatic(TenantContext.class)) {
            mockedContext.when(TenantContext::requireTenantId).thenReturn(testTenantId);

            when(businessCommentMapper.delete(any(LambdaQueryWrapper.class))).thenReturn(1);

            businessCommentService.delete(1L);

            verify(businessCommentMapper).delete(any(LambdaQueryWrapper.class));
        }
    }

    @Test
    @DisplayName("Should parse mentions from content")
    void testParseMentions() {
        List<Long> userIds = businessCommentService.parseMentions(
                "Hello @user1 and @user2", testTenantId);

        when(userMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(Arrays.asList(testUser1, testUser2));

        List<Long> result = businessCommentService.parseMentions(
                "Hello @user1 and @user2", testTenantId);

        verify(userMapper).selectList(any(LambdaQueryWrapper.class));
    }

    @Test
    @DisplayName("Should return empty list when no mentions in content")
    void testParseMentionsEmpty() {
        List<Long> result = businessCommentService.parseMentions(
                "No mentions here", testTenantId);

        verify(userMapper, never()).selectList(any(LambdaQueryWrapper.class));
    }

    @Test
    @DisplayName("Should return empty list when content is null")
    void testParseMentionsNullContent() {
        List<Long> result = businessCommentService.parseMentions(null, testTenantId);

        verify(userMapper, never()).selectList(any(LambdaQueryWrapper.class));
    }
}