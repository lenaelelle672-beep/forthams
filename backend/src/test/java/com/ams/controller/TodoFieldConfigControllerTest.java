package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.TodoFieldConfigDTO;
import com.ams.dto.TodoFieldPreviewDTO;
import com.ams.service.TodoFieldConfigService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class TodoFieldConfigControllerTest {

    @Mock
    private TodoFieldConfigService todoFieldConfigService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new TodoFieldConfigController(todoFieldConfigService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldExposeListSaveSortRoleOverridesResetAndPreview() throws Exception {
        grant("workflow:todo-field:list", "workflow:todo-field:update", "workflow:todo-field:reset");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(todoFieldConfigService.listFields("APPROVER")).thenReturn(List.of(field("processName", false)));
        when(todoFieldConfigService.saveFields(any())).thenReturn(List.of(field("processName", false)));
        when(todoFieldConfigService.saveSortOrder(any())).thenReturn(List.of(field("processName", false)));
        when(todoFieldConfigService.saveRoleOverride(eq("APPROVER"), any())).thenReturn(List.of(field("processName", false)));
        when(todoFieldConfigService.resetDefaults(any())).thenReturn(List.of(field("processName", false)));
        TodoFieldPreviewDTO preview = new TodoFieldPreviewDTO();
        preview.setRoleCode("APPROVER");
        preview.setVisibleFields(List.of(field("processName", false)));
        preview.setReadOnly(true);
        preview.setTenantScoped(true);
        when(todoFieldConfigService.preview("APPROVER")).thenReturn(preview);

        mockMvc.perform(get("/todo-fields?roleCode=APPROVER").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].fieldKey").value("processName"));
        mockMvc.perform(put("/todo-fields").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(saveJson(42L)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/todo-fields/sort-order").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(saveJson(42L)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/todo-fields/role-overrides/APPROVER").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(roleJson(42L)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/todo-fields/reset-defaults").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(operationJson(42L)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/todo-fields/preview?roleCode=APPROVER").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.readOnly").value(true));
    }

    @Test
    void shouldRejectMissingBearerUserAuthenticationPermissionAndAuditPayloadBeforeService() throws Exception {
        mockMvc.perform(get("/todo-fields"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:todo-field:list");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(null);
        mockMvc.perform(get("/todo-fields").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        SecurityContextHolder.clearContext();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        mockMvc.perform(get("/todo-fields").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:todo-field:list");
        mockMvc.perform(put("/todo-fields").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(saveJson(42L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:todo-field:update");
        mockMvc.perform(put("/todo-fields").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(saveJson(99L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(500));

        mockMvc.perform(put("/todo-fields/sort-order").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content("{\"confirmed\":false,\"operatorId\":42,\"reason\":\"排序\",\"fields\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(500));

        verifyNoInteractions(todoFieldConfigService);
    }

    @Test
    void superAdminShouldBypassOnlyPermissionCodeButNotLoginOrReason() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(88L);
        when(todoFieldConfigService.resetDefaults(any())).thenReturn(List.of(field("processName", false)));

        mockMvc.perform(post("/todo-fields/reset-defaults").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(operationJson(88L)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/todo-fields/reset-defaults").contentType(MediaType.APPLICATION_JSON).content(operationJson(88L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        mockMvc.perform(post("/todo-fields/reset-defaults").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content("{\"confirmed\":true,\"operatorId\":88}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(500));
    }

    private TodoFieldConfigDTO field(String key, boolean sensitive) {
        TodoFieldConfigDTO dto = new TodoFieldConfigDTO();
        dto.setFieldKey(key);
        dto.setFieldLabel("流程名称");
        dto.setVisible(true);
        dto.setSortOrder(10);
        dto.setSensitive(sensitive);
        return dto;
    }

    private String saveJson(Long operatorId) {
        return "{\"confirmed\":true,\"operatorId\":" + operatorId + ",\"reason\":\"待办字段保存复核\",\"fields\":[{\"fieldKey\":\"processName\",\"fieldLabel\":\"流程名称\",\"visible\":true,\"sortOrder\":10}]}";
    }

    private String roleJson(Long operatorId) {
        return "{\"confirmed\":true,\"operatorId\":" + operatorId + ",\"reason\":\"角色覆盖复核\",\"fields\":[{\"fieldKey\":\"processName\",\"visible\":true,\"sortOrder\":10}]}";
    }

    private String operationJson(Long operatorId) {
        return "{\"confirmed\":true,\"operatorId\":" + operatorId + ",\"reason\":\"默认恢复复核\",\"auditEvidence\":\"TODO_FIELD_GATE\"}";
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
