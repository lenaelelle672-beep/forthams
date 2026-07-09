package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.FormDefinitionDTO;
import com.ams.dto.FormDefinitionOperationDTO;
import com.ams.dto.FormDefinitionPreviewDTO;
import com.ams.dto.FormDefinitionSaveDTO;
import com.ams.dto.FormDefinitionSchemaValidationResultDTO;
import com.ams.dto.FormDefinitionVersionDTO;
import com.ams.service.FormDefinitionService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FormDefinitionControllerTest {

    @Mock
    private FormDefinitionService formDefinitionService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new FormDefinitionController(formDefinitionService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldExposeElevenEndpointsWithFailClosedPermissions() throws Exception {
        grant("workflow:form:list", "workflow:form:view", "workflow:form:update", "workflow:form:publish", "workflow:form:disable", "workflow:form:rollback");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(formDefinitionService.listDefinitions()).thenReturn(List.of(definition()));
        when(formDefinitionService.getDefinition("ASSET_FORM")).thenReturn(definition());
        when(formDefinitionService.saveDraft(eq("ASSET_FORM"), any())).thenReturn(definition());
        when(formDefinitionService.validateSchema(any(FormDefinitionSaveDTO.class))).thenReturn(validation(true));
        when(formDefinitionService.publish(eq("ASSET_FORM"), any())).thenReturn(definition("PUBLISHED", 1));
        when(formDefinitionService.disable(eq("ASSET_FORM"), any())).thenReturn(definition("DISABLED", 2));
        when(formDefinitionService.listVersions("ASSET_FORM")).thenReturn(List.of(version(1)));
        when(formDefinitionService.getVersion("ASSET_FORM", 1)).thenReturn(version(1));
        when(formDefinitionService.rollback(eq("ASSET_FORM"), eq(1), any())).thenReturn(definition("PUBLISHED", 3));
        when(formDefinitionService.preview("ASSET_FORM")).thenReturn(preview());
        when(formDefinitionService.references("ASSET_FORM")).thenReturn(Map.of("referenceCount", 0, "references", List.of()));

        mockMvc.perform(get("/form-definitions").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].formKey").value("ASSET_FORM"));
        mockMvc.perform(get("/form-definitions/ASSET_FORM").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.formKey").value("ASSET_FORM"));
        mockMvc.perform(put("/form-definitions/ASSET_FORM/draft")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"资产表单\",\"schema\":{\"sections\":[]}}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/form-definitions/ASSET_FORM/schema/validate")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"schema\":{\"sections\":[]}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(true));
        mockMvc.perform(post("/form-definitions/ASSET_FORM/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
        mockMvc.perform(post("/form-definitions/ASSET_FORM/disable")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));
        mockMvc.perform(get("/form-definitions/ASSET_FORM/versions").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].version").value(1));
        mockMvc.perform(get("/form-definitions/ASSET_FORM/versions/1").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(1));
        mockMvc.perform(post("/form-definitions/ASSET_FORM/versions/1/rollback")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(3));
        mockMvc.perform(get("/form-definitions/ASSET_FORM/preview").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sensitiveFieldCount").value(1));
        mockMvc.perform(get("/form-definitions/ASSET_FORM/references").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.referenceCount").value(0));

        ArgumentCaptor<FormDefinitionSaveDTO> draftCaptor = ArgumentCaptor.forClass(FormDefinitionSaveDTO.class);
        verify(formDefinitionService).saveDraft(eq("ASSET_FORM"), draftCaptor.capture());
        assertEquals(42L, draftCaptor.getValue().getOperatorId());
    }

    @Test
    void shouldRejectMissingBearerUserAuthenticationAndPermission() throws Exception {
        mockMvc.perform(get("/form-definitions"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:form:list");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(null);
        mockMvc.perform(get("/form-definitions").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        SecurityContextHolder.clearContext();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        mockMvc.perform(get("/form-definitions").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:form:view");
        mockMvc.perform(put("/form-definitions/ASSET_FORM/draft")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"资产表单\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(formDefinitionService);
    }

    @Test
    void superAdminShouldBypassOnlySpecificPermissionButNotLoginState() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(99L);
        when(formDefinitionService.publish(eq("ASSET_FORM"), any())).thenReturn(definition("PUBLISHED", 1));

        mockMvc.perform(post("/form-definitions/ASSET_FORM/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(99L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));

        mockMvc.perform(post("/form-definitions/ASSET_FORM/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(99L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void highRiskOperationShouldRequireConfirmedOperatorReasonImpactAndRollbackPlan() throws Exception {
        grant("workflow:form:publish");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(post("/form-definitions/ASSET_FORM/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"reason\":\"发布\",\"impactScope\":\"后续\",\"rollbackPlan\":\"恢复\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        mockMvc.perform(post("/form-definitions/ASSET_FORM/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":false,\"operatorId\":42,\"reason\":\"发布\",\"impactScope\":\"后续\",\"rollbackPlan\":\"恢复\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        mockMvc.perform(post("/form-definitions/ASSET_FORM/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"operatorId\":42,\"impactScope\":\"后续\",\"rollbackPlan\":\"恢复\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        mockMvc.perform(post("/form-definitions/ASSET_FORM/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"operatorId\":42,\"reason\":\"发布\",\"rollbackPlan\":\"恢复\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        mockMvc.perform(post("/form-definitions/ASSET_FORM/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"operatorId\":42,\"reason\":\"发布\",\"impactScope\":\"后续\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        verifyNoInteractions(formDefinitionService);
    }

    private FormDefinitionDTO definition() {
        return definition("DRAFT", 0);
    }

    private FormDefinitionDTO definition(String status, int version) {
        FormDefinitionDTO dto = new FormDefinitionDTO();
        dto.setFormKey("ASSET_FORM");
        dto.setName("资产表单");
        dto.setDescription("资产流程表单");
        dto.setSchema(Map.of("sections", List.of()));
        dto.setStatus(status);
        dto.setVersion(version);
        return dto;
    }

    private FormDefinitionSchemaValidationResultDTO validation(boolean valid) {
        FormDefinitionSchemaValidationResultDTO dto = new FormDefinitionSchemaValidationResultDTO();
        dto.setValid(valid);
        dto.setFieldCount(1);
        dto.setSensitiveFieldCount(1);
        dto.setSanitizedSchema(Map.of("sections", List.of()));
        return dto;
    }

    private FormDefinitionVersionDTO version(int version) {
        FormDefinitionVersionDTO dto = new FormDefinitionVersionDTO();
        dto.setFormKey("ASSET_FORM");
        dto.setVersion(version);
        dto.setActionType("PUBLISH");
        dto.setStatus("PUBLISHED");
        dto.setSchema(Map.of("sections", List.of()));
        return dto;
    }

    private FormDefinitionPreviewDTO preview() {
        FormDefinitionPreviewDTO dto = new FormDefinitionPreviewDTO();
        dto.setFormKey("ASSET_FORM");
        dto.setName("资产表单");
        dto.setFieldCount(2);
        dto.setSensitiveFieldCount(1);
        dto.setWarnings(List.of("已剥离危险字段"));
        dto.setSchema(Map.of("sections", List.of()));
        return dto;
    }

    private String operationJson(Long operatorId) {
        return "{\"confirmed\":true,\"operatorId\":" + operatorId + ",\"reason\":\"发布稳定版本\",\"impactScope\":\"仅影响后续实例\",\"rollbackPlan\":\"恢复上一版本\"}";
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
