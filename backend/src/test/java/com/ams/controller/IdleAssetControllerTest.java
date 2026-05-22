package com.ams.controller;

import com.ams.entity.IdleAssetNotice;
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
}
