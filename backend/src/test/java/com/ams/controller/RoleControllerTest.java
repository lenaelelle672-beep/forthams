package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.RoleCreateDTO;
import com.ams.entity.Role;
import com.ams.service.RoleService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class RoleControllerTest {

    @Mock
    private RoleService roleService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new RoleController(roleService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnPaginatedRoles() throws Exception {
        when(roleService.queryRoles(eq(1), eq(10), eq(null))).thenReturn(page());

        mockMvc.perform(get("/roles/list?page=1&pageSize=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records[0].roleCode").value("ASSET_ADMIN"))
                .andExpect(jsonPath("$.data.records[0].roleName").value("资产管理员"))
                .andExpect(jsonPath("$.data.total").value(1));

        verify(roleService).queryRoles(eq(1), eq(10), eq(null));
    }

    @Test
    void allShouldReturnAllRoles() throws Exception {
        when(roleService.listAllRoles()).thenReturn(List.of(role(1L)));

        mockMvc.perform(get("/roles/all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].roleCode").value("ASSET_ADMIN"))
                .andExpect(jsonPath("$.data[0].roleName").value("资产管理员"));

        verify(roleService).listAllRoles();
    }

    @Test
    void getByIdShouldReturnRoleDetail() throws Exception {
        when(roleService.getRoleById(1L)).thenReturn(role(1L));

        mockMvc.perform(get("/roles/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.roleCode").value("ASSET_ADMIN"))
                .andExpect(jsonPath("$.data.roleName").value("资产管理员"));

        verify(roleService).getRoleById(1L);
    }

    @Test
    void createShouldSucceedWithValidPayload() throws Exception {
        when(roleService.createRole(any(RoleCreateDTO.class))).thenReturn(role(1L));

        mockMvc.perform(post("/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleName\":\"资产管理员\",\"roleCode\":\"ASSET_ADMIN\",\"description\":\"负责资产日常管理\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.roleCode").value("ASSET_ADMIN"));

        verify(roleService).createRole(any(RoleCreateDTO.class));
    }

    @Test
    void createShouldReturn400WhenRoleCodeMissing() throws Exception {
        mockMvc.perform(post("/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleName\":\"资产管理员\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void deleteShouldDelegateToService() throws Exception {
        mockMvc.perform(delete("/roles/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(roleService).deleteRole(1L);
    }

    private Page<Role> page() {
        Page<Role> page = new Page<>(1, 10);
        page.setRecords(List.of(role(1L)));
        page.setTotal(1);
        return page;
    }

    private Role role(Long id) {
        Role role = new Role();
        role.setId(id);
        role.setRoleCode("ASSET_ADMIN");
        role.setRoleName("资产管理员");
        role.setDescription("负责资产日常管理");
        role.setStatus(1);
        return role;
    }
}
