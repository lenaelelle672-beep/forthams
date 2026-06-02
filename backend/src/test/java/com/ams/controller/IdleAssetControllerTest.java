package com.ams.controller;

import com.ams.entity.IdleAssetNotice;
import com.ams.common.exception.BusinessException;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.service.IdleAssetService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Idle Asset Controller Tests")
class IdleAssetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private IdleAssetService idleAssetService;

    @MockBean
    private UserMapper userMapper;

    @BeforeEach
    void setUpSecurityContext() {
        User mockUser = new User();
        mockUser.setId(42L);
        mockUser.setUsername("testuser");
        mockUser.setStatus(1);
        when(userMapper.selectOne(any())).thenReturn(mockUser);

        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken("testuser", null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Should claim idle asset with user id from SecurityContext")
    void claimUsesSecurityContextUserId() throws Exception {
        IdleAssetNotice notice = new IdleAssetNotice();
        when(idleAssetService.claimAsset(eq(9L), eq(42L))).thenReturn(notice);

        mockMvc.perform(post("/api/idle-assets/{id}/claim", 9L)
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(idleAssetService).claimAsset(9L, 42L);
    }

    @Test
    @DisplayName("Should return business error when publishing missing or cross-tenant asset")
    void createMissingOrCrossTenantAssetReturnsBusinessError() throws Exception {
        when(idleAssetService.publishNotice(any(), eq(42L)))
                .thenThrow(new BusinessException(400, "资产不存在或不属于当前租户"));

        mockMvc.perform(post("/api/idle-assets")
                        .contextPath("/api")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":10,\"idleDays\":45,\"reason\":\"当前租户不可见\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("资产不存在或不属于当前租户"));

        verify(idleAssetService).publishNotice(any(), eq(42L));
    }

    @Test
    @DisplayName("Should approve idle asset claim with user id from SecurityContext")
    void approveClaimUsesSecurityContextUserId() throws Exception {
        IdleAssetNotice notice = new IdleAssetNotice();
        when(idleAssetService.approveClaim(eq(9L), eq(42L), eq("同意认领"))).thenReturn(notice);

        mockMvc.perform(post("/api/idle-assets/{id}/claim/approve", 9L)
                        .contextPath("/api")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"opinion\":\"同意认领\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(idleAssetService).approveClaim(9L, 42L, "同意认领");
    }

    @Test
    @DisplayName("Should reject idle asset claim with user id from SecurityContext")
    void rejectClaimUsesSecurityContextUserId() throws Exception {
        IdleAssetNotice notice = new IdleAssetNotice();
        when(idleAssetService.rejectClaim(eq(9L), eq(42L), eq("库存保留"))).thenReturn(notice);

        mockMvc.perform(post("/api/idle-assets/{id}/claim/reject", 9L)
                        .contextPath("/api")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"opinion\":\"库存保留\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(idleAssetService).rejectClaim(9L, 42L, "库存保留");
    }
}
