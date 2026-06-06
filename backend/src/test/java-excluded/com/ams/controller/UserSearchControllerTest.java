package com.ams.controller;

import com.ams.entity.User;
import com.ams.service.AssetService;
import com.ams.service.UserManagementService;
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

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * UserSearchController 单元测试
 *
 * <p>测试用户搜索接口，主要用于 @mention 自动补全功能。</p>
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("User Search Controller Tests")
class UserSearchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserManagementService userManagementService;

    @MockBean
    private AssetService assetService;

    private User testUser1;
    private User testUser2;

    private final List<Long> testDeptIds = Arrays.asList(1L, 2L);

    @BeforeEach
    void setUp() {
        testUser1 = new User();
        testUser1.setId(1L);
        testUser1.setUsername("testuser1");
        testUser1.setRealName("测试用户1");
        testUser1.setEmail("test1@example.com");
        testUser1.setPhone("13800138001");
        testUser1.setStatus(1);

        testUser2 = new User();
        testUser2.setId(2L);
        testUser2.setUsername("testuser2");
        testUser2.setRealName("测试用户2");
        testUser2.setEmail("test2@example.com");
        testUser2.setPhone("13800138002");
        testUser2.setStatus(1);

        when(assetService.getDeptIdsByTenant(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(testDeptIds);
    }

    @Test
    @DisplayName("Should search users with keyword")
    void testSearchUsersWithKeyword() throws Exception {
        List<User> mockUsers = Arrays.asList(testUser1, testUser2);
        when(userManagementService.searchUsersByDepts(eq("test"), anyList())).thenReturn(mockUsers);

        mockMvc.perform(get("/users/search")
                        .param("keyword", "test")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].username").value("testuser1"))
                .andExpect(jsonPath("$.data[0].realName").value("测试用户1"))
                .andExpect(jsonPath("$.data[1].username").value("testuser2"));

        verify(userManagementService).searchUsersByDepts(eq("test"), anyList());
    }

    @Test
    @DisplayName("Should return empty list when no keyword")
    void testSearchUsersWithoutKeyword() throws Exception {
        List<User> mockUsers = Collections.emptyList();
        when(userManagementService.searchUsersByDepts(eq(null), anyList())).thenReturn(mockUsers);

        mockMvc.perform(get("/users/search")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));

        verify(userManagementService).searchUsersByDepts(eq(null), anyList());
    }

    @Test
    @DisplayName("Should return empty list when no users found")
    void testSearchUsersNoResults() throws Exception {
        List<User> mockUsers = Collections.emptyList();
        when(userManagementService.searchUsersByDepts(eq("nonexistent"), anyList())).thenReturn(mockUsers);

        mockMvc.perform(get("/users/search")
                        .param("keyword", "nonexistent")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));

        verify(userManagementService).searchUsersByDepts(eq("nonexistent"), anyList());
    }
}
