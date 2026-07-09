package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SystemPostDTO;
import com.ams.dto.SystemPostMetaDTO;
import com.ams.dto.SystemPostPreviewRespDTO;
import com.ams.service.PostManagementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PostManagementControllerTest {

    @Mock
    private PostManagementService postManagementService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new PostManagementController(postManagementService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyListAllDetailMetaAndPreviewRoutes() throws Exception {
        when(postManagementService.list(any())).thenReturn(page());
        when(postManagementService.all(any())).thenReturn(List.of(postDto()));
        when(postManagementService.detail(8L)).thenReturn(postDto());
        when(postManagementService.meta()).thenReturn(meta());
        when(postManagementService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/system/posts?page=1&pageSize=20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].postCode").value("POST-ENGINEER"))
                .andExpect(jsonPath("$.data.records[0].postName").value("工程师"))
                .andExpect(jsonPath("$.data.tenantScoped").value(true))
                .andExpect(jsonPath("$.data.readOnly").value(true));

        mockMvc.perform(get("/system/posts/all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].postCode").value("POST-ENGINEER"))
                .andExpect(jsonPath("$.data[0].readonlyBoundary").exists());

        mockMvc.perform(get("/system/posts/8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.postName").value("工程师"))
                .andExpect(jsonPath("$.data.status").value("ENABLED"));

        mockMvc.perform(get("/system/posts/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.previewPolicy.noPersistence").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.noAssignment").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.noPermissionEffect").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.runtimeEffect").value(false))
                .andExpect(jsonPath("$.data.previewPolicy.cacheRefreshed").value(false));

        mockMvc.perform(post("/system/posts/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"postCode\":\"POST-ENGINEER\",\"postName\":\"工程师\",\"sortOrder\":10,\"status\":\"ENABLED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistence").value(true))
                .andExpect(jsonPath("$.data.noAssignment").value(true))
                .andExpect(jsonPath("$.data.noPermissionEffect").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false))
                .andExpect(jsonPath("$.data.cacheRefreshed").value(false));

        verify(postManagementService).list(any());
        verify(postManagementService).all(any());
        verify(postManagementService).detail(8L);
        verify(postManagementService).meta();
        verify(postManagementService).preview(any());

        for (var builder : List.of(
                post("/system/posts"),
                put("/system/posts/8"),
                patch("/system/posts/8"),
                delete("/system/posts/8"),
                post("/system/posts/8/assign"),
                post("/system/posts/users/1")
        )) {
            mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(result -> assertNotEquals(200, result.getResponse().getStatus()));
        }
    }

    @Test
    void shouldReturnForbiddenWhenTenantBoundaryFailsClosedInService() throws Exception {
        when(postManagementService.list(any())).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/system/posts"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private SystemPostDTO.PageResult page() {
        return SystemPostDTO.PageResult.builder()
                .records(List.of(postDto()))
                .total(1)
                .page(1)
                .pageSize(20)
                .pages(1)
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary("只读岗位目录")
                .build();
    }

    private SystemPostDTO postDto() {
        return SystemPostDTO.builder()
                .id(8L)
                .postCode("POST-ENGINEER")
                .postName("工程师")
                .sortOrder(10)
                .status("ENABLED")
                .remark("metadata-only")
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary("只读岗位目录")
                .build();
    }

    private SystemPostMetaDTO meta() {
        return SystemPostMetaDTO.builder()
                .previewPolicy(SystemPostMetaDTO.PreviewPolicy.builder()
                        .noPersistence(true)
                        .noAssignment(true)
                        .noPermissionEffect(true)
                        .runtimeEffect(false)
                        .cacheRefreshed(false)
                        .build())
                .tenantScoped(true)
                .readOnly(true)
                .build();
    }

    private SystemPostPreviewRespDTO preview() {
        return SystemPostPreviewRespDTO.builder()
                .previewAccepted(true)
                .duplicateRisk(false)
                .referenceImpact("masked-reference-risk:none")
                .acceptedFields(List.of("postCode", "postName", "sortOrder", "status"))
                .rejectedInputs(List.of())
                .warnings(List.of("dry-run preview only"))
                .tenantScoped(true)
                .readOnly(true)
                .noPersistence(true)
                .noAssignment(true)
                .noPermissionEffect(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .readonlyBoundary("只读岗位目录")
                .build();
    }
}
