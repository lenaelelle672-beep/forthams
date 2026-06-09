package com.ams.controller;

import com.ams.dto.RoleCreateDTO;
import com.ams.dto.RoleUpdateDTO;
import com.ams.entity.Role;
import com.ams.service.RoleService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Role Controller Tests")
class RoleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RoleService roleService;

    @Test
    @DisplayName("Should protect role management endpoints with RuoYi permissions")
    void shouldUseSeededRolePermissions() throws Exception {
        Map<String, String> expected = Map.of(
                "list", "@ss.hasPermi('system:role:query')",
                "all", "@ss.hasPermi('system:role:query')",
                "getById", "@ss.hasPermi('system:role:query')",
                "create", "@ss.hasPermi('system:role:add')",
                "update", "@ss.hasPermi('system:role:edit')",
                "delete", "@ss.hasPermi('system:role:delete')",
                "assignMenus", "@ss.hasPermi('system:role:edit')",
                "assignDepts", "@ss.hasPermi('system:role:edit')");

        for (Map.Entry<String, String> entry : expected.entrySet()) {
            Method method = findMethod(entry.getKey());
            PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
            assertNotNull(preAuthorize, entry.getKey() + " should declare @PreAuthorize");
            assertEquals(entry.getValue(), preAuthorize.value());
        }
    }

    @Test
    @DisplayName("Should return paginated role list")
    void testList() throws Exception {
        Page<Role> mockPage = new Page<>(1, 10);
        Role role = new Role();
        role.setId(1L);
        role.setRoleName("ADMIN");
        mockPage.setRecords(List.of(role));

        when(roleService.queryRoles(anyInt(), anyInt(), any())).thenReturn(mockPage);

        mockMvc.perform(get("/roles/list")
                .param("page", "1")
                .param("pageSize", "10")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(roleService).queryRoles(1, 10, null);
    }

    @Test
    @DisplayName("Should return all roles")
    void testGetAll() throws Exception {
        Role r1 = new Role();
        r1.setId(1L);
        r1.setRoleName("ADMIN");
        Role r2 = new Role();
        r2.setId(2L);
        r2.setRoleName("USER");

        when(roleService.listAllRoles()).thenReturn(Arrays.asList(r1, r2));

        mockMvc.perform(get("/roles/all")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data.length()").value(2));

        verify(roleService).listAllRoles();
    }

    @Test
    @DisplayName("Should return role by ID")
    void testGetById() throws Exception {
        Role role = new Role();
        role.setId(1L);
        role.setRoleName("ADMIN");
        role.setRoleCode("SUPER_ADMIN");

        when(roleService.getRoleById(1L)).thenReturn(role);

        mockMvc.perform(get("/roles/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.id").value(1));

        verify(roleService).getRoleById(1L);
    }

    @Test
    @DisplayName("Should create role successfully")
    void testCreate() throws Exception {
        RoleCreateDTO dto = new RoleCreateDTO();
        dto.setRoleName("New Role");
        dto.setRoleCode("NEW_ROLE");

        Role saved = new Role();
        saved.setId(3L);
        saved.setRoleName("New Role");

        when(roleService.createRole(any(RoleCreateDTO.class))).thenReturn(saved);

        mockMvc.perform(post("/roles")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(roleService).createRole(any(RoleCreateDTO.class));
    }

    @Test
    @DisplayName("Should update role successfully")
    void testUpdate() throws Exception {
        RoleUpdateDTO dto = new RoleUpdateDTO();
        dto.setRoleName("Updated Role");

        Role updated = new Role();
        updated.setId(1L);
        updated.setRoleName("Updated Role");

        when(roleService.updateRole(eq(1L), any(RoleUpdateDTO.class))).thenReturn(updated);

        mockMvc.perform(put("/roles/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(roleService).updateRole(eq(1L), any(RoleUpdateDTO.class));
    }

    @Test
    @DisplayName("Should delete role successfully")
    void testDelete() throws Exception {
        mockMvc.perform(delete("/roles/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(roleService).deleteRole(1L);
    }

    private Method findMethod(String methodName) throws Exception {
        for (Method method : RoleManagementController.class.getDeclaredMethods()) {
            if (method.getName().equals(methodName)) {
                return method;
            }
        }
        throw new NoSuchMethodException("RoleManagementController." + methodName);
    }
}
