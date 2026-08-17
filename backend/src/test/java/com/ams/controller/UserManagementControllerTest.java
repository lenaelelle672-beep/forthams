package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.AuthResponse;
import com.ams.dto.UserCreateDTO;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.User;
import com.ams.service.AuditService;
import com.ams.service.UserManagementService;
import com.ams.utils.AuditHelper;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Standalone MockMvc tests for {@link UserManagementController}.
 *
 * <p>Note: the controller is annotated with {@code @PreAuthorize}. In standalone MockMvc
 * setup there is no Spring Security method-security infrastructure, so those annotations
 * are not enforced here — the same convention used by every other controller test in this
 * project. These tests focus on request wiring, {@code @Valid} handling, delegation to
 * the service, and that audit entries are recorded.</p>
 */
@ExtendWith(MockitoExtension.class)
class UserManagementControllerTest {

    @Mock
    private UserManagementService userManagementService;

    @Mock
    private AuditService auditService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AuditHelper auditHelper = new AuditHelper(jwtUtil);
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new UserManagementController(userManagementService, auditService, auditHelper))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void currentShouldReturnRolesPermissionsAndPlatformAdminWithoutPassword() throws Exception {
        when(userManagementService.getCurrentUser()).thenReturn(new AuthResponse(
                null, 7L, "alice", "爱丽丝", List.of("TENANT_ADMIN"), List.of("user:query"), Boolean.TRUE));

        mockMvc.perform(get("/user-management/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.userId").value(7))
                .andExpect(jsonPath("$.data.username").value("alice"))
                .andExpect(jsonPath("$.data.roles[0]").value("TENANT_ADMIN"))
                .andExpect(jsonPath("$.data.permissions[0]").value("user:query"))
                .andExpect(jsonPath("$.data.platformAdmin").value(true))
                .andExpect(jsonPath("$.data.password").doesNotExist());

        verify(userManagementService).getCurrentUser();
    }

    @Test
    void listShouldReturnPaginatedUsers() throws Exception {
        when(userManagementService.queryUsers(eq(1), eq(10), eq("alice"), eq(null), eq(null)))
                .thenReturn(page());

        mockMvc.perform(get("/users/list").param("page", "1").param("pageSize", "10").param("keyword", "alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records[0].username").value("alice"))
                .andExpect(jsonPath("$.data.total").value(1));

        verify(userManagementService).queryUsers(1, 10, "alice", null, null);
    }

    @Test
    void getByIdShouldReturnUserDetail() throws Exception {
        when(userManagementService.getUserById(7L)).thenReturn(user(7L, "alice"));

        mockMvc.perform(get("/users/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.username").value("alice"));

        verify(userManagementService).getUserById(7L);
    }

    @Test
    void createShouldSucceedWithValidPayload() throws Exception {
        when(userManagementService.createUser(any(UserCreateDTO.class))).thenReturn(user(11L, "bob"));

        mockMvc.perform(post("/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"bob\",\"password\":\"Secret123456\",\"realName\":\"Bob\",\"email\":\"bob@example.com\",\"phone\":\"13800000000\",\"deptId\":2}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(11))
                .andExpect(jsonPath("$.data.username").value("bob"));

        verify(userManagementService).createUser(any(UserCreateDTO.class));
        verify(auditService).save(any());
    }

    @Test
    void updateShouldSucceedWithValidPayload() throws Exception {
        when(userManagementService.updateUser(eq(7L), any(UserUpdateDTO.class))).thenReturn(user(7L, "alice"));

        mockMvc.perform(put("/users/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"realName\":\"Alice Updated\",\"email\":\"alice@example.com\",\"phone\":\"13900000000\",\"deptId\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(7));

        verify(userManagementService).updateUser(eq(7L), any(UserUpdateDTO.class));
        verify(userManagementService).requireTargetManagementAuthority(7L);
        verify(auditService).save(any());
    }

    @Test
    void resetPasswordShouldReturnTemporaryPasswordString() throws Exception {
        when(userManagementService.resetPassword(7L)).thenReturn("TempPwd12345");

        mockMvc.perform(put("/users/7/reset-password"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value("TempPwd12345"))
                .andExpect(jsonPath("$.message").value("临时密码已生成，请安全传达给用户"));

        verify(userManagementService).resetPassword(7L);
        verify(userManagementService).requireTargetManagementAuthority(7L);
        verify(auditService).save(any());
    }

    @Test
    void deleteShouldDelegateToService() throws Exception {
        mockMvc.perform(delete("/users/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(userManagementService).deleteUser(7L);
        verify(userManagementService).requireTargetManagementAuthority(7L);
        verify(auditService).save(any());
    }

    @Test
    void updateStatusShouldRejectPlatformAdminTargetBeforeServiceMutation() throws Exception {
        doThrow(new AccessDeniedException("需要平台管理员权限"))
                .when(userManagementService).requireTargetManagementAuthority(7L);

        mockMvc.perform(put("/users/7/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verify(userManagementService).requireTargetManagementAuthority(7L);
        verify(userManagementService, never()).updateStatus(7L, 0);
    }

    private Page<User> page() {
        Page<User> p = new Page<>(1, 10);
        p.setRecords(List.of(user(7L, "alice")));
        p.setTotal(1);
        return p;
    }

    private User user(Long id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setStatus(1);
        return user;
    }
}
