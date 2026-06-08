package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.BusinessComment;
import com.ams.service.BusinessCommentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * BusinessCommentController 单元测试
 *
 * <p>测试评论管理 API：列表查询、创建、删除。</p>
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Business Comment Controller Tests")
class BusinessCommentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private BusinessCommentService businessCommentService;

    private BusinessComment testComment1;
    private BusinessComment testComment2;
    private com.baomidou.mybatisplus.extension.plugins.pagination.Page<BusinessComment> testPage;

    @BeforeEach
    void setUp() {
        testComment1 = new BusinessComment();
        testComment1.setId(1L);
        testComment1.setBusinessType("ASSET");
        testComment1.setBusinessId(100L);
        testComment1.setUserId(10L);
        testComment1.setUserName("测试用户1");
        testComment1.setContent("这是一条测试评论");
        testComment1.setParentCommentId(null);
        testComment1.setTenantId("test-tenant-123");
        testComment1.setCreateTime(LocalDateTime.now());

        testComment2 = new BusinessComment();
        testComment2.setId(2L);
        testComment2.setBusinessType("ASSET");
        testComment2.setBusinessId(100L);
        testComment2.setUserId(20L);
        testComment2.setUserName("测试用户2");
        testComment2.setContent("这是另一条测试评论");
        testComment2.setParentCommentId(null);
        testComment2.setTenantId("test-tenant-123");
        testComment2.setCreateTime(LocalDateTime.now());

        testPage = new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(1, 20);
        testPage.setRecords(Arrays.asList(testComment1, testComment2));
        testPage.setTotal(2);
    }

    @Test
    @DisplayName("Should list comments by business type and id")
    void testListComments() throws Exception {
        when(businessCommentService.listComments(
                eq("ASSET"), eq(100L), eq(null), eq(1), eq(20)
        )).thenReturn(testPage);

        mockMvc.perform(get("/comments")
                        .param("businessType", "ASSET")
                        .param("businessId", "100")
                        .param("pageNum", "1")
                        .param("pageSize", "20")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records").isArray())
                .andExpect(jsonPath("$.data.records.length()").value(2))
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.records[0].userName").value("测试用户1"))
                .andExpect(jsonPath("$.data.records[1].userName").value("测试用户2"));

        verify(businessCommentService).listComments(
                eq("ASSET"), eq(100L), eq(null), eq(1), eq(20)
        );
    }

    @Test
    @DisplayName("Should create new comment")
    void testCreateComment() throws Exception {
        when(businessCommentService.create(any(BusinessComment.class))).thenReturn(testComment1);

        String commentJson = objectMapper.writeValueAsString(testComment1);

        mockMvc.perform(post("/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.userName").value("测试用户1"))
                .andExpect(jsonPath("$.data.content").value("这是一条测试评论"));

        verify(businessCommentService).create(any(BusinessComment.class));
    }

    @Test
    @DisplayName("Should delete comment")
    void testDeleteComment() throws Exception {
        mockMvc.perform(delete("/comments/1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(businessCommentService).delete(1L);
    }

    @Test
    @DisplayName("Should return empty list when no comments")
    void testListCommentsEmpty() throws Exception {
        com.baomidou.mybatisplus.extension.plugins.pagination.Page<BusinessComment> emptyPage =
                new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(1, 20);
        emptyPage.setRecords(Collections.emptyList());
        emptyPage.setTotal(0);

        when(businessCommentService.listComments(
                eq("ASSET"), eq(999L), eq(null), eq(1), eq(20)
        )).thenReturn(emptyPage);

        mockMvc.perform(get("/comments")
                        .param("businessType", "ASSET")
                        .param("businessId", "999")
                        .param("pageNum", "1")
                        .param("pageSize", "20")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records").isArray())
                .andExpect(jsonPath("$.data.records.length()").value(0))
                .andExpect(jsonPath("$.data.total").value(0));

        verify(businessCommentService).listComments(
                eq("ASSET"), eq(999L), eq(null), eq(1), eq(20)
        );
    }

    @Test
    @DisplayName("Should list comments with parent comment filter")
    void testListCommentsWithParentFilter() throws Exception {
        com.baomidou.mybatisplus.extension.plugins.pagination.Page<BusinessComment> replyPage =
                new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(1, 20);
        replyPage.setRecords(Arrays.asList(testComment1));
        replyPage.setTotal(1);

        when(businessCommentService.listComments(
                eq("ASSET"), eq(100L), eq(1L), eq(1), eq(20)
        )).thenReturn(replyPage);

        mockMvc.perform(get("/comments")
                        .param("businessType", "ASSET")
                        .param("businessId", "100")
                        .param("parentCommentId", "1")
                        .param("pageNum", "1")
                        .param("pageSize", "20")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records").isArray())
                .andExpect(jsonPath("$.data.records.length()").value(1));

        verify(businessCommentService).listComments(
                eq("ASSET"), eq(100L), eq(1L), eq(1), eq(20)
        );
    }
}