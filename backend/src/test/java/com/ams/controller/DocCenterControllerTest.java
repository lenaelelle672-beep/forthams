package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.DocArticleDTO;
import com.ams.service.DocCenterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DocCenterControllerTest {

    @Mock
    private DocCenterService docCenterService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new DocCenterController(docCenterService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnArticles() throws Exception {
        DocArticleDTO.PageResult page = new DocArticleDTO.PageResult();
        page.setTotal(1);
        DocArticleDTO article = new DocArticleDTO();
        article.setId(1L);
        article.setTitle("资产管理制度");
        article.setCategory("POLICY");
        article.setCategoryLabel("制度规范");
        article.setStatus("PUBLISHED");
        article.setStatusLabel("已发布");
        article.setVersion(2);
        page.setRecords(List.of(article));
        when(docCenterService.list(null, null, null, 1, 20)).thenReturn(page);

        mockMvc.perform(get("/system/doc-center"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].title").value("资产管理制度"))
                .andExpect(jsonPath("$.data.records[0].categoryLabel").value("制度规范"));
    }

    @Test
    void detailShouldReturnArticleById() throws Exception {
        DocArticleDTO article = new DocArticleDTO();
        article.setId(5L);
        article.setTitle("操作手册");
        article.setStatus("DRAFT");
        article.setAttachmentCount(3);
        when(docCenterService.detail(5L)).thenReturn(article);

        mockMvc.perform(get("/system/doc-center/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(5))
                .andExpect(jsonPath("$.data.attachmentCount").value(3));
    }

    @Test
    void metaShouldReturnReadOnlyNotice() throws Exception {
        DocArticleDTO.Meta meta = new DocArticleDTO.Meta();
        meta.setCategories(List.of("POLICY"));
        meta.setReadOnlyNotice("只读");
        when(docCenterService.meta()).thenReturn(meta);

        mockMvc.perform(get("/system/doc-center/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.categories[0]").value("POLICY"));
    }
}
