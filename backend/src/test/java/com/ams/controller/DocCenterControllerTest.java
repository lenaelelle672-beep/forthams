package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.DocArticleDTO;
import com.ams.service.DocCenterService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DocCenterControllerTest {

    @Mock
    private DocCenterService docCenterService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new DocCenterController(docCenterService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listShouldReturnArticles() throws Exception {
        grant("system:doc-center:query");
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

        mockMvc.perform(get("/system/doc-center").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].title").value("资产管理制度"))
                .andExpect(jsonPath("$.data.records[0].categoryLabel").value("制度规范"));
    }

    @Test
    void detailShouldReturnArticleById() throws Exception {
        grant("system:doc-center:query");
        DocArticleDTO article = new DocArticleDTO();
        article.setId(5L);
        article.setTitle("操作手册");
        article.setStatus("DRAFT");
        article.setAttachmentCount(3);
        when(docCenterService.detail(5L)).thenReturn(article);

        mockMvc.perform(get("/system/doc-center/5").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(5))
                .andExpect(jsonPath("$.data.attachmentCount").value(3));
    }

    @Test
    void metaShouldReturnReadOnlyNotice() throws Exception {
        grant("system:doc-center:query");
        DocArticleDTO.Meta meta = new DocArticleDTO.Meta();
        meta.setCategories(List.of("POLICY"));
        meta.setReadOnlyNotice("只读");
        when(docCenterService.meta()).thenReturn(meta);

        mockMvc.perform(get("/system/doc-center/meta").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.categories[0]").value("POLICY"));
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
