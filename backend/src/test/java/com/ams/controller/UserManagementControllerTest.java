package com.ams.controller;

import com.ams.dto.UserCreateDTO;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.User;
import com.ams.service.UserManagementService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("UserManagement Controller Tests")
class UserManagementControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserManagementService userManagementService;

    @Test
    @DisplayName("Should return paginated user list")
    void testList() throws Exception {
        Page<User> mockPage = new Page<>(1, 10);
        User u1 = new User();
        u1.setId(1L);
        u1.setUsername("admin");
        mockPage.setRecords(List.of(u1));

        when(userManagementService.queryUsers(anyInt(), anyInt(), any(), any(), any())).thenReturn(mockPage);

        mockMvc.perform(get("/user-management/list")
                .param("page", "1")
                .param("pageSize", "10")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(userManagementService).queryUsers(1, 10, null, null, null);
    }

    @Test
    @DisplayName("Should return paginated user list from root endpoint")
    void testRootList() throws Exception {
        Page<User> mockPage = new Page<>(1, 10);
        User u1 = new User();
        u1.setId(1L);
        u1.setUsername("admin");
        mockPage.setRecords(List.of(u1));

        when(userManagementService.queryUsers(anyInt(), anyInt(), any(), any(), any())).thenReturn(mockPage);

        mockMvc.perform(get("/user-management")
                .param("page", "1")
                .param("pageSize", "10")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(userManagementService).queryUsers(1, 10, null, null, null);
    }

    @Test
    @DisplayName("Should search users by keyword")
    void testSearch() throws Exception {
        User u1 = new User();
        u1.setId(1L);
        u1.setUsername("admin");

        when(userManagementService.searchUsers("admin")).thenReturn(List.of(u1));

        mockMvc.perform(get("/user-management/search")
                .param("keyword", "admin")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray());

        verify(userManagementService).searchUsers("admin");
    }

    @Test
    @DisplayName("Should return user by ID")
    void testGetById() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setUsername("admin");

        when(userManagementService.getUserById(1L)).thenReturn(user);

        mockMvc.perform(get("/user-management/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.id").value(1));

        verify(userManagementService).getUserById(1L);
    }

    @Test
    @DisplayName("Should create user successfully")
    void testCreate() throws Exception {
        UserCreateDTO dto = new UserCreateDTO();
        dto.setUsername("newuser");
        dto.setPassword("password123");
        dto.setRealName("New User");

        User saved = new User();
        saved.setId(10L);
        saved.setUsername("newuser");

        when(userManagementService.createUser(any(UserCreateDTO.class))).thenReturn(saved);

        mockMvc.perform(post("/user-management")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(userManagementService).createUser(any(UserCreateDTO.class));
    }

    @Test
    @DisplayName("Should update user successfully")
    void testUpdate() throws Exception {
        UserUpdateDTO dto = new UserUpdateDTO();
        dto.setRealName("Updated Name");

        User updated = new User();
        updated.setId(1L);
        updated.setRealName("Updated Name");

        when(userManagementService.updateUser(eq(1L), any(UserUpdateDTO.class))).thenReturn(updated);

        mockMvc.perform(put("/user-management/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(userManagementService).updateUser(eq(1L), any(UserUpdateDTO.class));
    }

    @Test
    @DisplayName("Should delete user successfully")
    void testDelete() throws Exception {
        mockMvc.perform(delete("/user-management/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(userManagementService).deleteUser(1L);
    }

    @Test
    @DisplayName("Should reset password successfully")
    void testResetPassword() throws Exception {
        mockMvc.perform(put("/user-management/{id}/reset-password", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(userManagementService).resetPassword(1L);
    }
}
